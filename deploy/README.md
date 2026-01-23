# AI ChatBot Client - Deployment

Separate Helm charts til frontend, backend og PostgreSQL StatefulSet.

## Struktur

```
deploy/
├── frontend/           # React SPA
│   ├── Chart.yaml
│   └── values.yaml
├── backend/            # Hono API
│   ├── Chart.yaml
│   ├── values.yaml
│   └── secrets.example.yaml
└── postgres/           # PostgreSQL StatefulSet
    └── statefulset.yaml
```

## Build Docker Images

### Frontend

```bash
# Fra projekt root
docker build \
  --build-arg VITE_API_URL=https://chaosbot-api.cfcore.dk/api \
  --build-arg VITE_AUTH0_DOMAIN=your-tenant.auth0.com \
  --build-arg VITE_AUTH0_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH0_AUDIENCE=https://your-api-identifier \
  -t registry.netic.dk/cloudfactory/ai-chatclient-frontend:3.0.0 .

docker push registry.netic.dk/cloudfactory/ai-chatclient-frontend:3.0.0
```

### Backend

```bash
cd backend
docker build -t registry.netic.dk/cloudfactory/ai-chatclient-backend:3.0.0 .
docker push registry.netic.dk/cloudfactory/ai-chatclient-backend:3.0.0
```

## Deployment rækkefølge

### 1. PostgreSQL

```bash
# Opret namespace
kubectl create namespace ai-chatclient

# Deploy PostgreSQL StatefulSet
kubectl apply -f postgres/statefulset.yaml -n ai-chatclient

# Vent på at pod er ready
kubectl get pods -l app.kubernetes.io/name=postgres -n ai-chatclient -w
```

### 2. Backend

```bash
cd backend

# Opret secrets (rediger secrets.example.yaml først)
kubectl apply -f secrets.example.yaml -n ai-chatclient

# Deploy
helm dependency update
helm upgrade --install ai-chatclient-backend . -n ai-chatclient
```

### 3. Frontend

```bash
cd ../frontend

# Deploy
helm dependency update
helm upgrade --install ai-chatclient-frontend . -n ai-chatclient
```

## Database migrations

Efter PostgreSQL er deployed:

```bash
# Port-forward til database
kubectl port-forward svc/postgres 5432:5432 -n ai-chatclient

# Kør migrations lokalt
cd ../../backend
DATABASE_URL="postgresql://aichatclient:yourStrong#Password@localhost:5432/aichatclient" npm run db:push
```

## Environment Variabler

### Backend (via secrets.example.yaml)

| Variabel | Beskrivelse |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | SSL til database (false for intern cluster) |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Auth0 API identifier |
| `ENCRYPTION_KEY` | 64-char hex key til token encryption |
| `AZURE_OPENAI_API_KEY` | Azure AI Foundry API key |
| `AZURE_OPENAI_ENDPOINT` | Azure AI Foundry endpoint |
| `AZURE_OPENAI_MODEL` | Model name (gpt-4o) |
| `ATLASSIAN_CLIENT_ID` | Atlassian OAuth client ID |
| `ATLASSIAN_CLIENT_SECRET` | Atlassian OAuth secret |
| `MS_PARTNER_CLIENT_ID` | Microsoft Partner Center client ID |
| `MS_PARTNER_CLIENT_SECRET` | Microsoft Partner Center secret |

### Frontend (build-time via Docker args)

| Variabel | Beskrivelse |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `VITE_AUTH0_AUDIENCE` | Auth0 API identifier |

## Opdatering

```bash
# Opdater backend
helm upgrade ai-chatclient-backend ./backend -n ai-chatclient

# Opdater frontend
helm upgrade ai-chatclient-frontend ./frontend -n ai-chatclient
```
