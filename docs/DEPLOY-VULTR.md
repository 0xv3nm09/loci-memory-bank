# Deploying the Quest site to a Vultr VM

Related docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [../THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)

The Quest build (`dist/`) is a static site, but WebXR requires a **secure
context** — so it must be served over HTTPS. This runbook puts it on a Vultr
VM behind Caddy with an auto-provisioned Let's Encrypt certificate on a
free sslip.io wildcard domain. One command, about 90 seconds.

Pattern proven on the airlock and mandate deployments.

## One-time: provision the VM

Created via the Vultr API (or the dashboard — same settings):

- **Region:** `del` (Delhi NCR)
- **Plan:** `vc2-1c-1gb` — 1 vCPU / 1 GB / $5 mo (the site is static; Caddy is tiny)
- **OS:** Ubuntu 24.04 LTS x64
- **SSH key:** the deploy key already registered on the account (`airlock-deploy`)

```bash
export VULTR_API_KEY=…            # keep out of the repo
curl -s -X POST https://api.vultr.com/v2/instances \
  -H "Authorization: Bearer $VULTR_API_KEY" -H "Content-Type: application/json" \
  -d '{"region":"del","plan":"vc2-1c-1gb","os_id":2284,"label":"loci-quest",
       "hostname":"loci-quest","sshkey_id":["<key-id>"],"enable_ipv6":false}'
```

Wait for `status: active` and note `main_ip`. The local `~/.ssh/config` maps
the IP to the deploy key.

## Deploy (or update) — one command

```bash
npm run build                     # fresh dist/
bash scripts/vultr_deploy.sh root@<VM-IP>
```

The script tars `dist/`, copies it over SSH, installs Caddy + ufw, writes the
Caddyfile for `https://<ip-dashed>.sslip.io` (e.g.
`https://139-84-174-127.sslip.io`), and restarts. Caddy obtains the Let's
Encrypt certificate automatically — sslip.io resolves every `<dashed-ip>.sslip.io`
hostname back to that IP, which satisfies the DNS challenge.

Re-run the same command any time to ship a new build; it is idempotent.

## Notes

- **WebXR requires HTTPS** — this is the entire reason for the Caddy/sslip.io
  setup. The plain GitHub Pages preview also satisfies it; this VM is the
  self-hosted alternative that does not depend on the Pages workflow.
- **Sage is not on this VM.** The app calls Vultr Serverless Inference
  (`api.vultrinference.com`) directly from the browser. The VM serves
  static files only.
- **Firewall:** ufw allows only 22/80/443.
- **Cost:** $5/mo while running; destroy it from the Vultr dashboard when done
  with the competition to stop billing.
- **Key hygiene:** the Vultr API key used for provisioning is not in the repo;
  rotate it from the Vultr console after setup if it has been shared in chat.
