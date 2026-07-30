#!/bin/bash
set -e

# ==============================================================================
# Deploy: FreeSpeech v2
# ==============================================================================
#
# Service:        freespeech-v2-api
# Runtime:        bun (server), Vite (client build)
# Branch:         main
# Port:           5106 (API)
# Database:       freespeech_v2 (PostgreSQL) — separate from the live freespeech_api
# Working Dir:    /opt/freespeech-v2/server (API), /opt/freespeech-v2/client (client)
# Systemd Unit:   /etc/systemd/system/freespeech-v2-api.service
# Nginx Configs:  /etc/nginx/sites-available/v2.freespeechaac.com
#                 /etc/nginx/sites-available/api-v2.freespeechaac.com
# URLs:           https://v2.freespeechaac.com (client, static via nginx)
#                 https://api-v2.freespeechaac.com (API)
# Env Files:      /opt/freespeech-v2/server/.env, /opt/freespeech-v2/client/.env
#
# Dependencies:   postgresql, bun, chromium (thumbnail rendering)
#
# NOTE: This is the parallel preview of the SvelteKit app at freespeechaac.com.
#       It has its own database; nothing here touches freespeech_api.
#       The client is a PWA — nginx serves sw.js with no-cache so installed
#       devices pick up new builds instead of pinning an old service worker.
# ==============================================================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SERVICE="freespeech-v2-api"
BRANCH="main"
PORT=5106
DIR="/opt/freespeech-v2"
BUN="/root/.bun/bin/bun"
RELEASE_FILE="$DIR/.release-version"

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Deploying: ${CYAN}freespeech-v2${NC}"
echo -e "${BOLD}  Branch:    ${CYAN}${BRANCH}${NC}"
echo -e "${BOLD}  Port:      ${CYAN}${PORT} (API)${NC}"
echo -e "${BOLD}  Client:    ${CYAN}static (nginx)${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# Step 1: Pull
echo -e "${YELLOW}[1/6] Pulling latest changes from origin/${BRANCH}...${NC}"
cd "$DIR"
git pull origin "$BRANCH"
RELEASE_ID="$(git rev-parse --short=12 HEAD)"
echo ""

# Step 2: Install dependencies (bun workspaces cover server + client)
echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
$BUN install
echo ""

# Step 3: Prisma
echo -e "${YELLOW}[3/6] Pushing Prisma schema to freespeech_v2...${NC}"
cd "$DIR/server"
$BUN x prisma db push
echo ""

# Step 4: Build client
echo -e "${YELLOW}[4/6] Building client (Vite + PWA)...${NC}"
cd "$DIR/client"
APP_VERSION="$RELEASE_ID" $BUN run build

# Publish the same non-secret release identifier to the API. The middleware reads this file at
# process start, so the client bundle and x-app-version header describe one deployment without
# putting a changing value in systemd or the secret-bearing server/.env.
printf '%s\n' "$RELEASE_ID" > "$RELEASE_FILE.tmp"
mv "$RELEASE_FILE.tmp" "$RELEASE_FILE"
echo ""

# Step 5: Restart service
echo -e "${YELLOW}[5/6] Restarting ${SERVICE}...${NC}"
systemctl restart "$SERVICE"
echo ""

# Step 6: Reload nginx
echo -e "${YELLOW}[6/6] Testing and reloading nginx...${NC}"
nginx -t
systemctl reload nginx
echo ""

# Verify
echo -e "${YELLOW}Verifying service health...${NC}"
sleep 3

if systemctl is-active --quiet "$SERVICE"; then
    echo -e "  ${GREEN}API service is active${NC}"
else
    echo -e "  ${RED}API service is NOT running!${NC}"
    echo ""
    echo -e "${RED}Recent logs:${NC}"
    journalctl -u "$SERVICE" -n 30 --no-pager
    exit 1
fi

if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null; then
    echo -e "  ${GREEN}Health check passed${NC}"
else
    echo -e "  ${RED}Health check FAILED on port ${PORT}${NC}"
    journalctl -u "$SERVICE" -n 30 --no-pager
    exit 1
fi

RUNNING_RELEASE="$(curl -sfD - "http://127.0.0.1:${PORT}/health" -o /dev/null | awk 'tolower($1) == "x-app-version:" { print $2 }' | tr -d '\r')"
if [ "$RUNNING_RELEASE" = "$RELEASE_ID" ]; then
    echo -e "  ${GREEN}Client/API release IDs match (${RELEASE_ID})${NC}"
else
    echo -e "  ${RED}Release ID mismatch: expected ${RELEASE_ID}, API reported ${RUNNING_RELEASE:-missing}${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Recent logs:${NC}"
journalctl -u "$SERVICE" -n 10 --no-pager
echo ""

echo -e "${GREEN}${BOLD}Deploy complete: freespeech-v2${NC}"
echo -e "${CYAN}  Client: https://v2.freespeechaac.com${NC}"
echo -e "${CYAN}  API:    https://api-v2.freespeechaac.com${NC}"
echo -e "${CYAN}  Logs:   journalctl -u ${SERVICE} -f${NC}"
echo ""
