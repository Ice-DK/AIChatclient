# AI ChatBot Client v2

En moderne AI ChatBot klient bygget med React, TanStack Router, Convex og Auth0.

## 🚀 Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Routing:** TanStack Router (type-safe)
- **Backend:** Convex (real-time database + serverless functions)
- **Authentication:** Auth0
- **AI:** Azure AI Foundry (OpenAI/Anthropic)
- **Styling:** CSS med moderne design

## ✨ Features

- ✅ Auth0 Authentication
- ✅ Real-time chat med Convex
- ✅ Chat historik gemt i database
- ✅ Multiple samtaler (conversations)
- ✅ Azure AI Foundry integration
- ✅ MCP server support (med Auth0 token)
- ✅ Markdown support i beskeder
- ✅ Responsivt design
- ✅ Typing indikator
- ✅ Type-safe routing

## 📦 Installation

1. **Installer dependencies:**
   ```bash
   npm install
   ```

2. **Opret Convex projekt:**
   ```bash
   npx convex dev --once --configure=new
   ```
   
   Dette opretter et nyt Convex projekt og giver dig en deployment URL.

3. **Konfigurer Auth0:**
   - Opret en konto på [Auth0](https://auth0.com/)
   - Opret en ny "Single Page Application"
   - Tilføj `http://localhost:5173` til:
     - Allowed Callback URLs
     - Allowed Logout URLs
     - Allowed Web Origins

4. **Konfigurer environment variabler:**
   
   Kopier `.env.example` til `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Udfyld `.env.local`:
   ```env
   VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud
   VITE_AUTH0_DOMAIN=your-tenant.auth0.com
   VITE_AUTH0_CLIENT_ID=your-client-id
   VITE_AUTH0_AUDIENCE=https://your-api-identifier
   ```

5. **Konfigurer Convex environment variabler:**
   
   I Convex Dashboard (https://dashboard.convex.dev), tilføj disse environment variables:
   ```
   AZURE_FOUNDRY_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_FOUNDRY_API_KEY=your-api-key
   AZURE_FOUNDRY_DEPLOYMENT=gpt-4o
   ```

## 🚀 Kør applikationen

**Start både frontend og Convex backend:**
```bash
npm run dev:all
```

Eller kør dem separat:
```bash
# Terminal 1 - Convex backend
npm run dev:backend

# Terminal 2 - Vite frontend
npm run dev
```

Åbn http://localhost:5173 i din browser.

## 📁 Projekt Struktur

```
new-app/
├── convex/                  # Convex backend
│   ├── schema.ts           # Database schema
│   ├── users.ts            # User mutations/queries
│   ├── conversations.ts    # Conversation mutations/queries
│   ├── messages.ts         # Message mutations/queries
│   └── ai.ts               # AI action (Azure OpenAI kald)
├── src/
│   ├── components/         # React komponenter
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── routes/             # TanStack Router routes
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   └── chat.tsx
│   ├── main.tsx            # App entry point
│   ├── routeTree.gen.ts    # Route tree
│   └── index.css           # Global styles
├── .env.example            # Environment template
└── convex.json             # Convex config
```

## 🔌 MCP Server Integration

Auth0 tokens sendes automatisk med AI requests og kan bruges til at kalde MCP servere.
Token'et er tilgængeligt i Convex actions og kan sendes videre til dine API'er.

## 📝 License

MIT
