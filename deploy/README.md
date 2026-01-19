# AI ChatClient Helm Deployment

Denne mappe indeholder Helm chart konfiguration til at deploye AI ChatClient til Kubernetes.

## Prerequisites

- Kubernetes cluster
- Helm 3.x
- Adgang til registry.netic.dk/cloudfactory

## Build Docker Image

```bash
# Fra roden af projektet
docker build \
  --build-arg VITE_CONVEX_URL=https://your-convex.convex.cloud \
  --build-arg VITE_AUTH0_DOMAIN=your-tenant.auth0.com \
  --build-arg VITE_AUTH0_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH0_AUDIENCE=https://your-api-identifier \
  -t registry.netic.dk/cloudfactory/ai-chatclient:2.0.0 .

docker push registry.netic.dk/cloudfactory/ai-chatclient:2.0.0
```

## Deploy med Helm

```bash
# Installer/opdater dependencies
helm dependency update

# Deploy til cluster
helm upgrade --install ai-chatclient . -n ai-chatclient --create-namespace

# Med custom values
helm upgrade --install ai-chatclient . -n ai-chatclient --create-namespace \
  --set application.deployment.image.tag=2.0.1 \
  --set application.httpProxy.host=chat.your-domain.com
```

## Values

Se [values.yaml](values.yaml) for alle konfigurerbare værdier.

Chartet bruger [gitops-helm-base](https://github.com/cloudfactorydk/gitops-helm-base) som base chart.
