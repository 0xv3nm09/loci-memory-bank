#!/usr/bin/env bash
# Loci — deploy the Quest build (dist/) to a Vultr VM over SSH.
# Usage: bash scripts/vultr_deploy.sh [user@]<vm-ip> [hostname]
#   hostname defaults to the sslip.io wildcard derived from the IP
#   (e.g. 203-0-113-10.sslip.io) — Caddy auto-provisions the Let's Encrypt
#   certificate, which is what makes WebXR work (it needs a secure context).
# Runbook: docs/DEPLOY-VULTR.md
set -euo pipefail

HOST="${1:?usage: vultr_deploy.sh [user@]<vm-ip> [hostname]}"
IP="${HOST##*@}"
HOSTNAME_ARG="${2:-$(echo "$IP" | tr '.' '-')}.sslip.io"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -d "$ROOT/dist" ] || { echo "error: dist/ missing — run 'npm run build' first"; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

echo "→ syncing Loci Quest build to $HOST (https://$HOSTNAME_ARG)"

# COPYFILE_DISABLE=1 — macOS bsdtar otherwise packs AppleDouble '._' metadata
# files into the archive, which Linux extracts as real junk files.
COPYFILE_DISABLE=1 tar czf /tmp/loci-dist.tgz --exclude='._*' -C "$ROOT/dist" .

# ── Sage key: server-side secret for the /sage inference proxy ──
# The deployed bundle must never contain the key — the VM injects the
# Authorization header server-side (Caddy route below). If a keyed build
# somehow lands in dist/, refuse to ship rather than leak it to every visitor.
SAGE_KEY_LOCAL="$(grep -E '^VITE_VULTR_KEY=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
if [ -n "$SAGE_KEY_LOCAL" ] && grep -rqF "$SAGE_KEY_LOCAL" "$ROOT/dist"; then
  echo "error: dist/ contains the Vultr API key — deploying would expose it to every visitor." >&2
  echo "       rebuild keyless first:  VITE_VULTR_KEY= npm run build" >&2
  exit 1
fi

scp -q "${SSH_OPTS[@]}" /tmp/loci-dist.tgz "$HOST:/tmp/loci-dist.tgz"

# First deploy only: seed /opt/loci/sage.key (root-only) from the local .env.
# After rotating the key at Vultr, update this file (either side) and redeploy.
if [ -n "$SAGE_KEY_LOCAL" ]; then
  ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p /opt/loci && if [ ! -s /opt/loci/sage.key ]; then umask 077 && printf '%s' '$SAGE_KEY_LOCAL' > /opt/loci/sage.key && chmod 600 /opt/loci/sage.key; fi"
fi

ssh "${SSH_OPTS[@]}" "$HOST" 'bash -s' -- "$HOSTNAME_ARG" <<'REMOTE'
set -euo pipefail
HN="$1"   # full hostname incl. .sslip.io — do not append again
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y caddy ufw

rm -rf /opt/loci/dist
mkdir -p /opt/loci/dist
tar xzf /tmp/loci-dist.tgz --no-same-owner --exclude='._*' -C /opt/loci/dist

ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# ── Caddyfile ──
# Static site + (when /opt/loci/sage.key exists) a same-origin /sage proxy
# that forwards to Vultr Serverless Inference with the Authorization header
# injected here, server-side. The browser bundle never contains the key.
# The Origin matcher only serves POSTs the app itself sends (fetch always
# attaches Origin to non-GET requests); bare curl/tooling gets a 404.
SAGE_AUTH=""
if [ -s /opt/loci/sage.key ]; then
  SAGE_AUTH="$(cat /opt/loci/sage.key)"
fi

if [ -n "$SAGE_AUTH" ]; then
cat > /etc/caddy/Caddyfile <<CADDY
$HN {
    root * /opt/loci/dist
    encode gzip
    file_server
    @sageops header Origin https://$HN
    handle @sageops {
        uri strip_prefix /sage
        reverse_proxy https://api.vultrinference.com {
            header_up Host api.vultrinference.com
            header_up Authorization "Bearer $SAGE_AUTH"
        }
    }
}
CADDY
else
cat > /etc/caddy/Caddyfile <<CADDY
$HN {
    root * /opt/loci/dist
    encode gzip
    file_server
}
CADDY
fi
# hard restart: apt auto-starts caddy with the default Caddyfile during install
systemctl enable --now caddy || true
systemctl restart caddy

echo "LIVE → https://$HN"
REMOTE

echo "→ deployed: https://$HOSTNAME_ARG"
echo "→ open it in the Quest browser — WebXR needs this HTTPS, which Caddy just provisioned"
