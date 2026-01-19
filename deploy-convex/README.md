# Convex Backend Self-Hosted Deployment

Denne mappe indeholder Helm chart konfiguration til at deploye self-hosted Convex backend til Kubernetes.

## Prerequisites

- Kubernetes cluster
- Helm 3.x
- Adgang til registry.netic.dk/cloudfactory
- External Secrets Operator (til secrets fra Vault/AWS SM)
- Persistent Volume provisioner

## Secrets i Vault

Opret følgende secrets i `unrestricted/convex-backend`:

```json
{
  "instance-secret": "<generer en lang random string>",
  "azure-foundry-endpoint": "https://foundry-rnd-openai-dev.openai.azure.com/",
  "azure-foundry-api-key": "<din api key>",
  "atlassian-client-id": "<din atlassian client id>",
  "atlassian-client-secret": "<din atlassian client secret>"
}
```

Generer instance secret:
```bash
openssl rand -hex 32
```

## Deploy med Helm

```bash
cd deploy-convex

# Opdater dependencies
helm dependency update

# Deploy
helm upgrade --install convex-backend . -n ai-chatclient --create-namespace
```

## Konfiguration

### Vigtige environment variabler

| Variabel | Beskrivelse |
|----------|-------------|
| `CONVEX_CLOUD_ORIGIN` | Public URL til Convex API (port 3210) |
| `CONVEX_SITE_ORIGIN` | Public URL til Convex Site Proxy (port 3211) |
| `INSTANCE_NAME` | Navn på Convex instance |
| `INSTANCE_SECRET` | Secret til at sikre instance |
| `DATABASE_URL` | (Valgfri) PostgreSQL connection string |

### Database

Som default bruger Convex SQLite med persistent volume. For production anbefales PostgreSQL:

```yaml
env:
  DATABASE_URL:
    value: "postgres://user:pass@postgres-host:5432/convex"
```

## Deploy Convex functions

Efter backend kører, deploy dine Convex functions:

```bash
# Fra AIChatclient roden
npx convex deploy --url https://convex.cloudfactory.dk
```

## Frontend konfiguration

Opdater frontend til at pege mod self-hosted Convex:

```env
VITE_CONVEX_URL=https://convex.cloudfactory.dk
```

## Convex Dashboard (Valgfri)

For at køre Convex Dashboard, se [deploy-convex-dashboard](../deploy-convex-dashboard) eller tilføj:

```yaml
# Separat deployment for dashboard
image:
  repository: ghcr.io/get-convex/convex-dashboard
  tag: "latest"
env:
  NEXT_PUBLIC_DEPLOYMENT_URL:
    value: "https://convex.cloudfactory.dk"
```
