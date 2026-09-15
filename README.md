# Sigma Games — infrastructure

Infrastructure as code for **Sigma Games**: a Pulumi program in TypeScript that
provisions the production Kubernetes cluster and the cloud resources around it.

Developed between January and April 2025.

> **Status:** archived. The resources described here have been destroyed and the
> project is no longer maintained. Credentials were removed from the git history
> before the repository was made public; Cloudflare account and zone identifiers
> are replaced with `CF_ID_REMOVED`.

## What it builds

```
                 Cloudflare (DNS, TLS, WAF)
                            │
                 DigitalOcean load balancer
                            │
        ┌───────────── Talos Linux cluster ─────────────┐
        │ control plane │ service workers │ app workers │
        └───────────────────────┬───────────────────────┘
                                │  Flux CD ◄── GitHub: sigma-gaming/k8s
                                │
   Google Cloud: Artifact Registry (images), Cloud Storage (backups)
```

| Stack | Resources |
|---|---|
| [`DoTalosClusterStack`](src/stacks/do-talos-cluster-stack.ts) | DigitalOcean droplets for the control plane, service workers and application workers booted from a Talos image; load balancer with health checks; Talos machine secrets, configuration and bootstrap; kubeconfig output. Flannel CNI, node roles assigned through labels |
| [`CloudflareStack`](src/stacks/cloudflare.ts) | DNS records for the cluster and application domains, zone settings (full SSL, ECH), a custom firewall rule that lets trusted clients skip WAF and rate limiting using tokens stored in Infisical |
| [`CloudflareTlsStack`](src/stacks/cloudflare-tls.ts) | Cloudflare Origin CA certificates issued per domain and stored in the cluster as `kubernetes.io/tls` secrets |
| [`GcloudStack`](src/stacks/gcloud.ts) | Artifact Registry repository, service accounts with custom IAM roles for pulling images and writing backups, backup bucket |
| [`GcloudSecretsStack`](src/stacks/gcloud-secrets.ts) | Registry and backup credentials delivered to the cluster as Kubernetes secrets |
| [`GcloudCleanupStack`](src/stacks/gcloud-cleanup.ts) | Cloud Run job that cleans up old images in Artifact Registry, triggered by Cloud Scheduler every 6 hours, running under its own service account and custom IAM role |
| [`CommonSecretsStack`](src/stacks/common-secrets.ts) | Bootstrap secrets for the Infisical operator and DigitalOcean integrations |
| [`FluxBootstrap`](src/resources/flux-bootstrap.ts), [`FluxWebhookStack`](src/stacks/flux-webhook.ts) | `flux bootstrap` against the [`k8s`](https://github.com/sigma-gaming/k8s) repository with image automation controllers, and a GitHub webhook that triggers reconciliation on push |

Everything is composed in [`src/index.ts`](src/index.ts); domains are listed in
[`src/config.ts`](src/config.ts).

## How it evolved

The history shows the same infrastructure rewritten as the requirements grew:

1. **Terraform** — a single DigitalOcean configuration (January 2025)
2. **Terragrunt** — split into modules for DigitalOcean, Cloudflare, TLS, Google Cloud and Flux
3. **CDKTF** — the modules ported to TypeScript (March 2025)
4. **Pulumi** — the current program (March 2025); the `pulumi` branch keeps the intermediate rewrite

## Usage

Requirements: Node.js, pnpm, [Pulumi CLI](https://www.pulumi.com/docs/iac/download-install/).

Credentials are read from `.env`:

```
DIGITALOCEAN_TOKEN=
CLOUDFLARE_API_TOKEN=
GITHUB_OWNER=
GITHUB_TOKEN=
INFISICAL_CLIENT_ID=
INFISICAL_CLIENT_SECRET=
INFISICAL_PRODUCTION_SERVICE_TOKEN=
GOOGLE_PROJECT=
```

```bash
pnpm install
pnpm preview                 # pulumi preview
pnpm deploy                  # pulumi up
pnpm kubeconfig:output       # print kubeconfig of the created cluster
```

## Related repositories

- [`k8s`](https://github.com/sigma-gaming/k8s) — Kubernetes manifests delivered with Flux CD
- [`workspace-dotnet`](https://github.com/sigma-gaming/workspace-dotnet) — backend services (.NET 9)
- [`workspace`](https://github.com/sigma-gaming/workspace) — web apps, admin panel and Telegram bot (TypeScript)

## Author

Evgenii Zakharov ([@risenxxx](https://github.com/risenxxx))
