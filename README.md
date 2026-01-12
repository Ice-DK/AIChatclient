# AI ChatBot Client

En moderne AI ChatBot klient bygget med React og Auth0 authentication.

## 🚀 Features

- ✅ Auth0 Authentication (login/logout)
- ✅ Bruger profil visning
- ✅ Real-time chat med AI
- ✅ Microsoft Azure AI Foundry integration
- ✅ MCP (Model Context Protocol) server support
- ✅ Markdown support i chat beskeder
- ✅ Responsivt design
- ✅ Typing indikator
- ✅ Chat historik
- ✅ Moderne UI med gradient design

## 📦 Installation

1. **Installer dependencies:**
   ```bash
   cd AIChatclient
   npm install
   ```

2. **Konfigurer Auth0:**
   
   - Opret en konto på [Auth0](https://auth0.com/)
   - Opret en ny "Single Page Application"
   - Tilføj `http://localhost:3000` til:
     - Allowed Callback URLs
     - Allowed Logout URLs
     - Allowed Web Origins

3. **Konfigurer environment variabler:**
   
   Kopier `.env.example` til `.env` og udfyld værdierne:
   ```bash
   cp .env.example .env
   ```
   
   Opdater `.env` med dine Auth0 og Azure AI Foundry credentials:
   ```
   REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
   REACT_APP_AUTH0_CLIENT_ID=your-client-id
   REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier
   REACT_APP_AZURE_FOUNDRY_ENDPOINT=https://your-resource-name.openai.azure.com
   REACT_APP_AZURE_FOUNDRY_API_KEY=your-azure-api-key
   REACT_APP_AZURE_FOUNDRY_DEPLOYMENT=gpt-4o
   ```

4. **Start applikationen:**
   ```bash
   npm start
   ```

## 🔧 Auth0 Opsætning

### 1. Opret Auth0 Application

1. Gå til [Auth0 Dashboard](https://manage.auth0.com/)
2. Gå til **Applications** → **Create Application**
3. Vælg **Single Page Web Applications**
4. Navngiv din applikation (f.eks. "AI ChatBot")

### 2. Konfigurer Application Settings

Under din applikations **Settings**:

- **Allowed Callback URLs:** `http://localhost:3000`
- **Allowed Logout URLs:** `http://localhost:3000`
- **Allowed Web Origins:** `http://localhost:3000`

### 3. (Valgfrit) Opret API

Hvis du vil bruge Auth0 til at beskytte din backend API:

1. Gå til **Applications** → **APIs**
2. Klik **Create API**
3. Tilføj et navn og identifier (f.eks. `https://api.mychatbot.com`)
4. Brug denne identifier som `REACT_APP_AUTH0_AUDIENCE`

## 🤖 Microsoft Azure AI Foundry Integration

ChatBot'en bruger Microsoft Azure AI Foundry til AI-funktionalitet.

### Opsætning af Azure AI Foundry

1. **Opret Azure ressource:**
   - Gå til [Azure Portal](https://portal.azure.com/)
   - Opret en ny "Azure OpenAI" ressource
   - Vælg en region der understøtter de ønskede modeller

2. **Deploy en model:**
   - Gå til [Azure AI Foundry](https://ai.azure.com/)
   - Vælg din ressource
   - Gå til "Deployments" og opret en ny deployment
   - Vælg en model (f.eks. `gpt-4o`, `gpt-4`, `gpt-35-turbo`)
   - Notér deployment navnet

3. **Hent credentials:**
   - I Azure Portal, gå til din OpenAI ressource
   - Under "Keys and Endpoint" finder du:
     - **Endpoint:** `https://your-resource-name.openai.azure.com`
     - **API Key:** En af de to nøgler

4. **Konfigurer miljøvariabler:**
   ```
   REACT_APP_AZURE_FOUNDRY_ENDPOINT=https://your-resource-name.openai.azure.com
   REACT_APP_AZURE_FOUNDRY_API_KEY=your-api-key
   REACT_APP_AZURE_FOUNDRY_DEPLOYMENT=gpt-4o
   ```

### Understøttede Modeller

- `gpt-4o` - Nyeste og mest kapable model
- `gpt-4o-mini` - Hurtigere og billigere version
- `gpt-4` - Stærk reasoning model
- `gpt-35-turbo` - Hurtig og økonomisk

## 🔌 MCP (Model Context Protocol) Integration

ChatBot'en understøtter MCP servere, som giver AI'en adgang til externe tools og ressourcer.

### Hvad er MCP?

MCP (Model Context Protocol) er en åben standard der tillader AI modeller at interagere med eksterne systemer via:
- **Tools**: Funktioner AI'en kan kalde (f.eks. søg i database, læs filer, kald API'er)
- **Resources**: Data AI'en kan læse (f.eks. dokumenter, konfigurationer)
- **Prompts**: Foruddefinerede prompt templates

### Konfiguration af MCP Servere

#### Option 1: JSON konfiguration
```env
REACT_APP_MCP_SERVERS={"myserver":{"url":"http://localhost:3001","apiKey":"optional"}}
```

#### Option 2: Individuelle servere
```env
REACT_APP_MCP_SERVER_COUNT=2

REACT_APP_MCP_SERVER_1_NAME=filesystem
REACT_APP_MCP_SERVER_1_URL=http://localhost:3001
REACT_APP_MCP_SERVER_1_API_KEY=optional-key

REACT_APP_MCP_SERVER_2_NAME=database
REACT_APP_MCP_SERVER_2_URL=http://localhost:3002
```

### MCP Server Krav

MCP servere skal implementere følgende HTTP endpoints:

| Endpoint | Metode | Beskrivelse |
|----------|--------|-------------|
| `/initialize` | POST | Initialiserer forbindelse og returnerer capabilities |
| `/tools/list` | POST | Returnerer liste af tilgængelige tools |
| `/tools/call` | POST | Kalder et specifikt tool |
| `/resources/list` | POST | Returnerer liste af tilgængelige resources |
| `/resources/read` | POST | Læser en specifik resource |

### Eksempel MCP Server (Node.js)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Initialize
app.post('/initialize', (req, res) => {
  res.json({
    protocolVersion: '2024-11-05',
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: 'My MCP Server', version: '1.0.0' }
  });
});

// List tools
app.post('/tools/list', (req, res) => {
  res.json({
    tools: [{
      name: 'get_weather',
      description: 'Hent vejrudsigt for en by',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'Bynavn' }
        },
        required: ['city']
      }
    }]
  });
});

// Call tool
app.post('/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;
  // Implementer tool logik her
  res.json({ content: [{ type: 'text', text: 'Result...' }] });
});

app.listen(3001);
```

### Populære MCP Servere

- **Filesystem** - Læs/skriv filer
- **PostgreSQL/MySQL** - Database queries
- **Brave Search** - Web søgning
- **GitHub** - Repository operationer
- **Slack** - Besked integration

## 📁 Projekt Struktur

```
AIChatclient/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── ChatBot.js        # Hoved chat komponent
│   │   ├── LoginButton.js    # Auth0 login knap
│   │   ├── LogoutButton.js   # Auth0 logout knap
│   │   ├── UserProfile.js    # Bruger profil visning
│   │   └── LoadingSpinner.js # Loading indikator
│   ├── styles/
### Farver
Hovedfarverne kan ændres i CSS filerne. Gradient temaet bruger:
- Primary: `#667eea`
- Secondary: `#764ba2`

### AI Model
Du kan ændre AI modellen ved at opdatere `REACT_APP_AZURE_FOUNDRY_DEPLOYMENT` i din `.env` fil:
```
REACT_APP_AZURE_FOUNDRY_DEPLOYMENT=gpt-4o-mini
``` README.md
```

## 🎨 Tilpasning

### Farver
Hovedfarverne kan ændres i CSS filerne. Gradient temaet bruger:
- Primary: `#667eea`
- Secondary: `#764ba2`

### AI Model
Du kan ændre AI modellen i `ChatBot.js`:
```javascript
model: 'gpt-4'  // eller 'gpt-3.5-turbo'
```

## 📝 Scripts

- `npm start` - Start development server
- `npm build` - Byg til produktion
- `npm test` - Kør tests

## 🔒 Sikkerhed

- Auth0 håndterer al authentication sikkert
- Access tokens bruges til API kald
- Sensitive data gemmes i environment variabler
- HTTPS anbefales i produktion

## 📄 License

MIT
