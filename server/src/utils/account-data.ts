import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import prisma from '@/resources/prisma';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';
import slugify from '@/utils/slugify';

const MEDIA_HOSTS = new Set(['media.freespeechaac.com']);

/** Everything a user can download about their account. Secrets are reported only as present/absent. */
export async function buildAccountExport(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			Project: {
				orderBy: { createdAt: 'asc' },
				include: {
					collaborators: {
						select: { status: true, invitedAt: true, respondedAt: true, user: { select: { name: true, email: true } } },
					},
				},
			},
			projectCollaborations: {
				select: {
					status: true,
					isFavorite: true,
					invitedAt: true,
					respondedAt: true,
					project: { select: { id: true, name: true, user: { select: { name: true } } } },
				},
			},
		},
	});
	if (!user) return null;

	return {
		exportedAt: new Date().toISOString(),
		format: 'freespeech-account-export/1',
		account: {
			id: user.id,
			email: user.email,
			name: user.name,
			profileImgUrl: user.profileImgUrl,
			hasPassword: !!user.password,
			hasElevenLabsApiKey: !!user.elevenLabsApiKey,
			usePersonalElevenLabsKey: user.usePersonalElevenLabsKey,
			accessControls: {
				enabled: user.editPinEnabled,
				mode: user.editPinMode,
				updatedAt: user.editPinUpdatedAt,
			},
			collaborationEnabled: user.collaborationEnabled,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
		projects: user.Project.map((project) => ({
			id: project.id,
			name: project.name,
			description: project.description,
			imageUrl: project.imageUrl,
			columns: project.columns,
			rows: project.rows,
			homePageId: project.homePageId,
			isFavorite: project.isFavorite,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			lastEditedAt: project.lastEditedAt,
			collaborators: project.collaborators.map((collaborator) => ({
				name: collaborator.user.name,
				email: collaborator.user.email,
				status: collaborator.status,
				invitedAt: collaborator.invitedAt,
				respondedAt: collaborator.respondedAt,
			})),
			blob: project.blob,
		})),
		sharedWithMe: user.projectCollaborations.map((membership) => ({
			projectId: membership.project.id,
			projectName: membership.project.name,
			ownerName: membership.project.user.name,
			status: membership.status,
			isFavorite: membership.isFavorite,
			invitedAt: membership.invitedAt,
			respondedAt: membership.respondedAt,
		})),
	};
}

/** R2 key for a media URL, or null for other hosts. Accepts absolute URLs and stored `/key` paths. */
export function mediaKey(value: string): string | null {
	if (!value) return null;
	if (value.startsWith('/')) return decodeURIComponent(value.replace(/^\/+/, '')) || null;
	try {
		const url = new URL(value);
		return MEDIA_HOSTS.has(url.hostname) ? decodeURIComponent(url.pathname.replace(/^\/+/, '')) || null : null;
	} catch {
		// Uploaded profile pictures are stored as bare keys.
		return /^[\w.-]+\/[\w./-]+$/.test(value) ? value : null;
	}
}

/**
 * Keys this app wrote on the user's behalf: presigned uploads and thumbnails under
 * `{name-slug}-{userId}/`, and board imports under `user-imports/{userId}/`. Starter-template
 * assets, root-level keys, and anything under another account are never treated as owned.
 */
export function isOwnedKey(key: string, userId: string): boolean {
	if (key.startsWith(`user-imports/${userId}/`)) return true;
	const [prefix, ...rest] = key.split('/');
	return rest.length > 0 && !prefix.startsWith('template-') && prefix.endsWith(`-${userId}`);
}

function collectStrings(value: unknown, into: string[]) {
	if (typeof value === 'string') into.push(value);
	else if (Array.isArray(value)) for (const item of value) collectStrings(item, into);
	else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, into);
}

async function listKeys(prefix: string): Promise<string[]> {
	const keys: string[] = [];
	let token: string | undefined;
	do {
		const page = await s3.send(
			new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token }),
		);
		for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);
	return keys;
}

/** Candidate keys, gathered while the user's rows still exist. */
export async function collectOwnedMediaKeys(userId: string): Promise<string[]> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, profileImgUrl: true, Project: { select: { imageUrl: true, blob: true } } },
	});
	if (!user) return [];
	const values: string[] = [];
	if (user.profileImgUrl) values.push(user.profileImgUrl);
	for (const project of user.Project) {
		if (project.imageUrl) values.push(project.imageUrl);
		collectStrings(project.blob, values);
	}
	const keys = new Set<string>();
	for (const value of values) {
		const key = mediaKey(value);
		if (key && isOwnedKey(key, userId)) keys.add(key);
	}
	// Uploads that no board references any more. The name prefix is the current name; objects under
	// an older name are still found above whenever a board or the profile refers to them.
	for (const prefix of [`user-imports/${userId}/`, `${slugify(user.name)}-${userId}/`]) {
		try {
			for (const key of await listKeys(prefix)) if (isOwnedKey(key, userId)) keys.add(key);
		} catch (error) {
			console.warn(`[account-deletion] Could not list ${prefix}:`, error);
		}
	}
	return [...keys];
}

/** Keys still referenced by any remaining board or profile (e.g. a collaborator's duplicate). */
async function referencedKeys(keys: string[]): Promise<Set<string>> {
	if (!keys.length) return new Set();
	const rows = await prisma.$queryRaw<{ k: string }[]>`
		SELECT k FROM unnest(${keys}::text[]) AS k
		WHERE EXISTS (SELECT 1 FROM "Project" p WHERE strpos(p.blob::text, k) > 0 OR p."imageUrl" = '/' || k)
		   OR EXISTS (SELECT 1 FROM "User" u WHERE strpos(coalesce(u."profileImgUrl", ''), k) > 0)
	`;
	return new Set(rows.map((row) => row.k));
}

/** Best effort: failures are logged, never surfaced, because the account itself is already gone. */
export async function deleteUnreferencedMedia(keys: string[]): Promise<{ deleted: number; kept: number }> {
	const referenced = await referencedKeys(keys);
	const removable = keys.filter((key) => !referenced.has(key));
	let deleted = 0;
	for (let i = 0; i < removable.length; i += 1000) {
		const batch = removable.slice(i, i + 1000);
		try {
			const result = await s3.send(
				new DeleteObjectsCommand({
					Bucket: R2_BUCKET,
					Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
				}),
			);
			deleted += batch.length - (result.Errors?.length ?? 0);
		} catch (error) {
			console.warn('[account-deletion] R2 batch delete failed:', error);
		}
	}
	return { deleted, kept: referenced.size };
}

/**
 * Removes the account, every board it owns, and every collaboration row touching it, in one
 * transaction. Returns the owned media keys for the caller's best-effort cleanup.
 */
export async function deleteAccount(userId: string): Promise<{ mediaKeys: string[]; importedFromV1: boolean } | null> {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { importedFromV1At: true } });
	if (!user) return null;
	// Media shared with the original FreeSpeech account must survive; see User.importedFromV1At.
	const mediaKeys = user.importedFromV1At ? [] : await collectOwnedMediaKeys(userId);
	await prisma.$transaction([
		prisma.projectCollaborator.deleteMany({ where: { OR: [{ userId }, { project: { userId } }] } }),
		prisma.project.deleteMany({ where: { userId } }),
		prisma.user.delete({ where: { id: userId } }),
	]);
	return { mediaKeys, importedFromV1: !!user.importedFromV1At };
}
