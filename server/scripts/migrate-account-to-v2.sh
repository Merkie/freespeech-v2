#!/usr/bin/env bash

# Copy one account from the normalized production FreeSpeech database into the
# blob-based FreeSpeech v2 database without ever running the blob converter
# against production. The default is a target-safe dry run; --apply is required
# before anything is inserted into freespeech_v2.

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SOURCE_DB='freespeech_api'
readonly TARGET_DB='freespeech_v2'
readonly APP_ROLE='myapp'
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly BUN_BIN='/root/.bun/bin/bun'

EMAIL=''
APPLY=false
KEEP_STAGING=false
STAGING_DB=''
STAGING_CREATED=false
TEMP_DIR=''

usage() {
	cat <<'USAGE'
Usage:
  bash scripts/migrate-account-to-v2.sh --email user@example.com [--apply] [--keep-staging]

Options:
  --email EMAIL     Account to copy from freespeech_api.
  --apply           Back up freespeech_v2 and insert the converted account.
                    Without this flag, the script only builds and validates an
                    isolated staging copy.
  --keep-staging    Do not drop the temporary staging database on exit.
  -h, --help        Show this help.

The source database is always read-only. The whole-database blob converter runs
only against a newly created, per-run staging database.
USAGE
}

die() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

run_psql() {
	local database="$1"
	shift
	sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname="$database" "$@"
}

query_scalar() {
	local database="$1"
	local sql="$2"
	printf '%s\n' "$sql" | run_psql "$database" -qAt -v email="$EMAIL"
}

copy_query_to_stage() {
	local table="$1"
	local query="$2"

	printf 'COPY (%s) TO STDOUT (FORMAT binary);\n' "$query" \
		| run_psql "$SOURCE_DB" -qAt -v email="$EMAIL" \
		| run_psql "$STAGING_DB" -qAt -c "COPY \"$table\" FROM STDIN (FORMAT binary)" \
		> /dev/null
}

database_url_for() {
	local base_url="$1"
	local database="$2"
	DATABASE_URL_VALUE="$base_url" DATABASE_NAME="$database" "$BUN_BIN" -e '
		const url = new URL(process.env.DATABASE_URL_VALUE!);
		url.pathname = `/${process.env.DATABASE_NAME}`;
		process.stdout.write(url.toString());
	'
}

validate_project_blobs() {
	local database_url="$1"
	(
		cd "$SERVER_DIR"
		DATABASE_URL="$database_url" MIGRATION_EMAIL="$EMAIL" "$BUN_BIN" -e '
			import prisma from "./src/resources/prisma.ts";
			import { ProjectBlobSchema } from "./src/utils/project-blob.ts";

			try {
				const user = await prisma.user.findFirst({
					where: { email: { equals: process.env.MIGRATION_EMAIL!, mode: "insensitive" } },
					select: { id: true },
				});
				if (!user) throw new Error("Migrated user is missing");

				const projects = await prisma.project.findMany({
					where: { userId: user.id },
					select: { id: true, blob: true, lastEditedAt: true },
				});

				for (const project of projects) {
					ProjectBlobSchema.parse({
						...(project.blob as Record<string, unknown>),
						id: project.id,
						lastEditedAt: project.lastEditedAt.toISOString(),
					});
				}

				console.log(`Validated ${projects.length} project blob(s) against the live v2 schema.`);
			} finally {
				await prisma.$disconnect();
			}
		'
	)
}

cleanup() {
	local status=$?
	set +e

	if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
		rm -f -- "$TEMP_DIR/account-data.sql"
		rmdir -- "$TEMP_DIR"
	fi

	if [[ "$STAGING_CREATED" == true ]]; then
		if [[ "$KEEP_STAGING" == true ]]; then
			printf 'Kept staging database: %s\n' "$STAGING_DB"
		else
			sudo -u postgres dropdb --if-exists "$STAGING_DB"
		fi
	fi

	return "$status"
}

trap cleanup EXIT

while (($# > 0)); do
	case "$1" in
		--email)
			(($# >= 2)) || die '--email requires a value'
			EMAIL="$2"
			shift 2
			;;
		--apply)
			APPLY=true
			shift
			;;
		--keep-staging)
			KEEP_STAGING=true
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			die "Unknown argument: $1"
			;;
	esac
done

[[ $EUID -eq 0 ]] || die 'Run this script as root so it can use the local postgres administrator.'
[[ -n "$EMAIL" ]] || die '--email is required'
[[ "$EMAIL" =~ ^[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}$ ]] \
	|| die 'Email contains unsupported characters or is malformed.'
[[ -x "$BUN_BIN" ]] || die "Bun was not found at $BUN_BIN"

for command in sudo psql pg_dump createdb dropdb gzip mktemp; do
	command -v "$command" > /dev/null || die "Required command not found: $command"
done

BASE_DATABASE_URL="$({
	cd "$SERVER_DIR"
	"$BUN_BIN" -e '
		if (!process.env.DATABASE_URL) process.exit(1);
		process.stdout.write(process.env.DATABASE_URL);
	'
})" || die 'Could not load DATABASE_URL from server/.env'

configured_target="$({
	DATABASE_URL_VALUE="$BASE_DATABASE_URL" "$BUN_BIN" -e '
		const name = new URL(process.env.DATABASE_URL_VALUE!).pathname.replace(/^\//, "");
		process.stdout.write(name);
	'
})"
[[ "$configured_target" == "$TARGET_DB" ]] \
	|| die "server/.env is not configured for the expected target database ($TARGET_DB)"

printf 'Preflight: %s -> %s for %s\n' "$SOURCE_DB" "$TARGET_DB" "$EMAIL"

preflight_result="$({
	run_psql "$SOURCE_DB" -qAt -F '|' -v email="$EMAIL" <<'SQL'
WITH account AS (
	SELECT id
	FROM "User"
	WHERE lower(email) = lower(:'email')
), account_projects AS (
	SELECT p.id
	FROM "Project" p
	JOIN account a ON a.id = p."userId"
), account_pages AS (
	SELECT DISTINCT l."tilePageId" AS id
	FROM "TilePageInProject" l
	JOIN account_projects p ON p.id = l."projectId"
)
SELECT
	(SELECT count(*) FROM account),
	(SELECT count(*) FROM account_projects),
	(SELECT count(*) FROM account_pages),
	(SELECT count(*) FROM "Tile" t JOIN account_pages p ON p.id = t."tilePageId"),
	(SELECT count(*) FROM "TilePage" tp JOIN account a ON a.id = tp."userId"
		WHERE tp.id NOT IN (SELECT id FROM account_pages)),
	(SELECT count(*) FROM account_pages ap
		WHERE (SELECT count(*) FROM "TilePageInProject" l WHERE l."tilePageId" = ap.id) > 1),
	(SELECT count(*) FROM "Tile" t JOIN account_pages ap ON ap.id = t."tilePageId"
		WHERE NULLIF(t.navigation, '') IS NOT NULL
		AND t.navigation NOT IN (SELECT id FROM account_pages)),
	(SELECT count(*) FROM "TilePage" tp JOIN account_pages ap ON ap.id = tp.id
		WHERE tp."userId" NOT IN (SELECT id FROM account)),
	(SELECT count(*) FROM "Project" p JOIN account_projects ap ON ap.id = p.id
		WHERE p.columns < 1 OR p.columns > 30 OR p.rows < 1 OR p.rows > 30),
	(SELECT count(*) FROM "PageTemplateLink" ptl
		WHERE ptl."tilePageId" IN (SELECT id FROM account_pages)
		AND ptl."templatePageId" IN (SELECT id FROM account_pages));
SQL
})"

IFS='|' read -r source_users source_projects source_pages source_tiles unmigrated_pages shared_pages \
	external_navigation owner_mismatches invalid_dimensions internal_template_links <<< "$preflight_result"

[[ "$source_users" == '1' ]] || die "Expected exactly one source account; found $source_users"
[[ "$unmigrated_pages" == '0' ]] || die "$unmigrated_pages account-owned page(s) would not be included"
[[ "$shared_pages" == '0' ]] || die "$shared_pages page(s) are shared across projects"
[[ "$external_navigation" == '0' ]] || die "$external_navigation tile(s) navigate outside the account's projects"
[[ "$owner_mismatches" == '0' ]] || die "$owner_mismatches linked page(s) are owned by another account"
[[ "$invalid_dimensions" == '0' ]] || die "$invalid_dimensions project(s) exceed v2's supported board dimensions"

target_users="$(query_scalar "$TARGET_DB" \
	"SELECT count(*) FROM \"User\" WHERE lower(email) = lower(:'email');")"
[[ "$target_users" == '0' ]] || die "The target already contains $target_users account(s) for $EMAIL"

printf '  Source account: %s project(s), %s page(s), %s tile(s)\n' \
	"$source_projects" "$source_pages" "$source_tiles"
if [[ "$internal_template_links" != '0' ]]; then
	printf '  Legacy template links: %s (v2 stores their pages and tiles as ordinary blob pages)\n' \
		"$internal_template_links"
fi
printf '  Target account: absent\n'

STAGING_DB="fsv2_account_stage_$(date -u +%Y%m%d_%H%M%S)_$$"
[[ "$STAGING_DB" =~ ^fsv2_account_stage_[0-9]{8}_[0-9]{6}_[0-9]+$ ]] \
	|| die 'Refusing to use an unexpected staging database name'

stage_exists="$(sudo -u postgres psql -X -qAt --dbname=postgres \
	-v stage="$STAGING_DB" <<'SQL'
SELECT count(*) FROM pg_database WHERE datname = :'stage';
SQL
)"
[[ "$stage_exists" == '0' ]] || die "Generated staging database already exists: $STAGING_DB"

printf 'Creating isolated staging database...\n'
sudo -u postgres createdb --owner="$APP_ROLE" --template=template0 "$STAGING_DB"
STAGING_CREATED=true

sudo -u postgres pg_dump --schema-only --no-owner --no-privileges "$SOURCE_DB" \
	| sudo -u postgres env PGOPTIONS="-c role=$APP_ROLE" \
		psql -X --set=ON_ERROR_STOP=1 --quiet --dbname="$STAGING_DB" \
	> /dev/null

copy_query_to_stage 'User' \
	"SELECT u.* FROM \"User\" u WHERE lower(u.email) = lower(:'email')"
copy_query_to_stage 'Project' \
	"SELECT p.* FROM \"Project\" p JOIN \"User\" u ON u.id = p.\"userId\" WHERE lower(u.email) = lower(:'email')"
copy_query_to_stage 'TilePage' \
	"SELECT tp.* FROM \"TilePage\" tp WHERE tp.id IN (
		SELECT l.\"tilePageId\" FROM \"TilePageInProject\" l
		JOIN \"Project\" p ON p.id = l.\"projectId\"
		JOIN \"User\" u ON u.id = p.\"userId\"
		WHERE lower(u.email) = lower(:'email')
	)"
copy_query_to_stage 'Tile' \
	"SELECT t.* FROM \"Tile\" t WHERE t.\"tilePageId\" IN (
		SELECT l.\"tilePageId\" FROM \"TilePageInProject\" l
		JOIN \"Project\" p ON p.id = l.\"projectId\"
		JOIN \"User\" u ON u.id = p.\"userId\"
		WHERE lower(u.email) = lower(:'email')
	)"
copy_query_to_stage 'TilePageInProject' \
	"SELECT l.* FROM \"TilePageInProject\" l
	JOIN \"Project\" p ON p.id = l.\"projectId\"
	JOIN \"User\" u ON u.id = p.\"userId\"
	WHERE lower(u.email) = lower(:'email')"
copy_query_to_stage 'PageTemplateLink' \
	"SELECT ptl.* FROM \"PageTemplateLink\" ptl
	WHERE ptl.\"tilePageId\" IN (
		SELECT l.\"tilePageId\" FROM \"TilePageInProject\" l
		JOIN \"Project\" p ON p.id = l.\"projectId\"
		JOIN \"User\" u ON u.id = p.\"userId\"
		WHERE lower(u.email) = lower(:'email')
	)
	AND ptl.\"templatePageId\" IN (
		SELECT l.\"tilePageId\" FROM \"TilePageInProject\" l
		JOIN \"Project\" p ON p.id = l.\"projectId\"
		JOIN \"User\" u ON u.id = p.\"userId\"
		WHERE lower(u.email) = lower(:'email')
	)"

run_psql "$STAGING_DB" --quiet <<'SQL'
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "blob" JSONB NOT NULL
	DEFAULT '{"name":"","description":null,"imageUrl":null,"columns":6,"rows":4,"homePageId":null,"pages":[]}';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
SQL

STAGING_DATABASE_URL="$(database_url_for "$BASE_DATABASE_URL" "$STAGING_DB")"

printf 'Running blob conversion dry run in staging...\n'
(
	cd "$SERVER_DIR"
	DATABASE_URL="$STAGING_DATABASE_URL" "$BUN_BIN" src/scripts/migrate-to-blob.ts --dry-run
)

if [[ "$APPLY" != true ]]; then
	printf '\nDry run complete. freespeech_v2 was not changed. Re-run with --apply to import.\n'
	exit 0
fi

printf 'Applying blob conversion in staging...\n'
(
	cd "$SERVER_DIR"
	DATABASE_URL="$STAGING_DATABASE_URL" "$BUN_BIN" src/scripts/migrate-to-blob.ts
)

stage_counts="$({
	run_psql "$STAGING_DB" -qAt -F '|' <<'SQL'
WITH blob_pages AS (
	SELECT page
	FROM "Project" p
	CROSS JOIN LATERAL jsonb_array_elements(p.blob->'pages') AS page
), blob_tiles AS (
	SELECT tile
	FROM blob_pages
	CROSS JOIN LATERAL jsonb_array_elements(page->'tiles') AS tile
)
SELECT
	(SELECT count(*) FROM "Project"),
	(SELECT count(*) FROM "TilePageInProject"),
	(SELECT count(*) FROM "Tile"),
	(SELECT count(*) FROM blob_pages),
	(SELECT count(*) FROM blob_tiles),
	(SELECT count(*) FROM "Project" p
		WHERE jsonb_array_length(p.blob->'pages') > 0
		AND NOT EXISTS (
			SELECT 1 FROM jsonb_array_elements(p.blob->'pages') page
			WHERE page->>'id' = p."homePageId"
		));
SQL
})"
IFS='|' read -r stage_projects stage_pages stage_tiles blob_pages blob_tiles invalid_home_pages \
	<<< "$stage_counts"

[[ "$stage_projects" == "$source_projects" ]] || die 'Staging project count changed during conversion'
[[ "$stage_pages" == "$source_pages" && "$blob_pages" == "$source_pages" ]] \
	|| die 'Staging page count does not match the generated blobs'
[[ "$stage_tiles" == "$source_tiles" && "$blob_tiles" == "$source_tiles" ]] \
	|| die 'Staging tile count does not match the generated blobs'
[[ "$invalid_home_pages" == '0' ]] || die "$invalid_home_pages project(s) have an invalid migrated home page"

validate_project_blobs "$STAGING_DATABASE_URL"

stage_user_id="$(run_psql "$STAGING_DB" -qAt -c 'SELECT id FROM "User";')"
[[ "$stage_user_id" =~ ^[[:alnum:]_-]+$ ]] || die 'Unexpected source user ID format'
user_id_collision="$(query_scalar "$TARGET_DB" \
	"SELECT count(*) FROM \"User\" WHERE id = '$stage_user_id';")"
[[ "$user_id_collision" == '0' ]] || die 'The source user ID already exists in the target'

while IFS= read -r project_id; do
	[[ "$project_id" =~ ^[[:alnum:]_-]+$ ]] || die 'Unexpected source project ID format'
	project_id_collision="$(query_scalar "$TARGET_DB" \
		"SELECT count(*) FROM \"Project\" WHERE id = '$project_id';")"
	[[ "$project_id_collision" == '0' ]] || die "Project ID already exists in target: $project_id"
done < <(run_psql "$STAGING_DB" -qAt -c 'SELECT id FROM "Project" ORDER BY id;')

backup_dir='/var/backups/postgresql'
backup_path="$backup_dir/freespeech_v2-pre-account-migration-$(date -u +%Y%m%d-%H%M%S)-$$.sql.gz"
[[ -d "$backup_dir" ]] || die "Backup directory does not exist: $backup_dir"

printf 'Backing up freespeech_v2...\n'
sudo -u postgres pg_dump --no-owner --no-privileges "$TARGET_DB" | gzip -c > "$backup_path"
gzip -t "$backup_path"
printf '  Backup: %s\n' "$backup_path"

TEMP_DIR="$(mktemp -d /tmp/freespeech-account-migration.XXXXXX)"
data_dump="$TEMP_DIR/account-data.sql"

sudo -u postgres pg_dump --data-only --column-inserts --no-owner --no-privileges \
	--table='public."User"' "$STAGING_DB" > "$data_dump"
sudo -u postgres pg_dump --data-only --column-inserts --no-owner --no-privileges \
	--table='public."Project"' "$STAGING_DB" >> "$data_dump"

printf 'Importing account into freespeech_v2 in one transaction...\n'
# The dump stays root-only in its 0700 temporary directory. Open it in this
# shell and stream it to psql so the postgres subprocess never needs filesystem
# access to the protected file.
run_psql "$TARGET_DB" --single-transaction < "$data_dump" > /dev/null

target_counts="$({
	run_psql "$TARGET_DB" -qAt -F '|' -v email="$EMAIL" <<'SQL'
WITH account AS (
	SELECT id FROM "User" WHERE lower(email) = lower(:'email')
), projects AS (
	SELECT p.* FROM "Project" p JOIN account a ON a.id = p."userId"
), blob_pages AS (
	SELECT page FROM projects p
	CROSS JOIN LATERAL jsonb_array_elements(p.blob->'pages') AS page
), blob_tiles AS (
	SELECT tile FROM blob_pages
	CROSS JOIN LATERAL jsonb_array_elements(page->'tiles') AS tile
)
SELECT
	(SELECT count(*) FROM account),
	(SELECT count(*) FROM projects),
	(SELECT count(*) FROM blob_pages),
	(SELECT count(*) FROM blob_tiles);
SQL
})"
IFS='|' read -r imported_users imported_projects imported_pages imported_tiles <<< "$target_counts"

[[ "$imported_users" == '1' ]] || die 'Target verification did not find exactly one migrated account'
[[ "$imported_projects" == "$source_projects" ]] || die 'Target project count does not match the source'
[[ "$imported_pages" == "$source_pages" ]] || die 'Target page count does not match the source'
[[ "$imported_tiles" == "$source_tiles" ]] || die 'Target tile count does not match the source'

validate_project_blobs "$BASE_DATABASE_URL"

printf '\nMigration complete: %s\n' "$EMAIL"
printf '  Imported: %s project(s), %s page(s), %s tile(s)\n' \
	"$imported_projects" "$imported_pages" "$imported_tiles"
printf '  Source database was read-only throughout.\n'
printf '  Rollback backup: %s\n' "$backup_path"
