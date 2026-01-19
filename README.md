# AI ChatBot Client v3

En self-hosted AI ChatBot klient med React frontend, Hono backend, PostgreSQL database og Auth0 authentication.

## 🚀 Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **TanStack Router** (type-safe routing)
- **TanStack Query** (data fetching)
- **Auth0** (authentication)
- **@assistant-ui/react** (chat UI)

### Backend
- **Hono** (lightweight web framework)
- **Drizzle ORM** (type-safe database access)
- **PostgreSQL + pgvector** (database med embedding support)
- **Azure AI Foundry** (LLM integration)

### Infrastructure
- **Kubernetes** (container orchestration)
- **CloudNativePG** (PostgreSQL operator)
- **Helm** (package management)

## ✨ Features

- ✅ Auth0 Authentication
- ✅ OAuth integration (Atlassian, Microsoft Partner Center)
- ✅ Automatic token refresh med re-auth prompt
- ✅ Real-time chat med SSE streaming
- ✅ MCP server support med multiple auth metoder
- ✅ Chat historik gemt i PostgreSQL
- ✅ RAG-ready med pgvector embeddings
- ✅ Multiple samtaler (conversations)
- ✅ Self-hosted - ingen cloud dependencies

## 📦 Projekt Struktur

```
ai-chatclient/
├── src/                    # Frontend React app
│   ├── components/         # React komponenter
│   ├── hooks/              # Custom hooks
│   ├── lib/                # API client
│   └── routes/             # TanStack Router routes
├── backend/                # Backend Hono API
│   ├── src/
│   │   ├── db/             # Drizzle schema
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── lib/            # Utilities
│   └── package.json
├── deploy/                 # Kubernetes deployment
└── docker-compose.yml      # Lokal udvikling
```

## 🔧 Lokal Udvikling

### 1. Installer dependencies

```bash
npm install
cd backend && npm install && cd ..
```

### 2. Konfigurer environment

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env.local
```

### 3. Start med Docker Compose

```bash
docker-compose up -d
npm run db:migrate
```

Åbn http://localhost:5173 i din browser.

## 🔐 OAuth Integration

Når OAuth tokens udløber:
1. Backend forsøger automatisk refresh
2. Hvis refresh fejler, vises re-auth modal
3. Bruger gennemfører OAuth flow i popup
4. Operationen fortsætter automatisk

## 🐳 Kubernetes Deployment

```bash
# Opret PostgreSQL cluster
kubectl apply -f deploy/postgres-cluster.yaml -n ai-chatclient

# Deploy med Helm

```bash
cd deploy
helm dependency update
helm upgrade --install ai-chatclient . -n ai-chatclient --create-namespace
```

### Deploy filer

| Fil | Beskrivelse |
|-----|-------------|
| `deploy/Chart.yaml` | Helm chart med gitops-helm-base dependency |
| `deploy/values.yaml` | Konfiguration (image, replicas, ingress, HPA) |
| `Dockerfile` | Multi-stage build med nginx |
| `nginx.conf` | Nginx config med SPA routing |

## 📝 License

MIT
