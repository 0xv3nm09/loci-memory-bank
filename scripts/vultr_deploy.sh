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

tar czf /tmp/loci-dist.tgz -C "$ROOT/dist" .
scp -q "${SSH_OPTS[@]}" /tmp/loci-dist.tgz "$HOST:/tmp/loci-dist.tgz"

ssh "${SSH_OPTS[@]}" "$HOST" 'bash -s' -- "$HOSTNAME_ARG" <<'REMOTE'
set -euo pipefail
HN="$1"   # full hostname incl. .sslip.io — do not append again
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y caddy ufw

mkdir -p /opt/loci/dist
tar xzf /tmp/loci-dist.tgz -C /opt/loci/dist

ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

cat > /etc/caddy/Caddyfile <<CADDY
$HN {
    root * /opt/loci/dist
    encode gzip
    file_server
}
CADDY
# hard restart: apt auto-starts caddy with the default Caddyfile during install
systemctl enable --now caddy || true
systemctl restart caddy

echo "LIVE → https://$HN"
REMOTE

echo "→ deployed: https://$HOSTNAME_ARG"
echo "→ open it in the Quest browser — WebXR needs this HTTPS, which Caddy just provisioned"
