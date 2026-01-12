/**
 * MCP (Model Context Protocol) Client
 * Håndterer kommunikation med MCP servere for at give AI adgang til tools og ressourcer
 */

class MCPClient {
  constructor() {
    this.servers = new Map();
    this.tools = new Map();
    this.resources = new Map();
    this.isConnected = false;
  }

  /**
   * Tilføj en MCP server konfiguration
   */
  addServer(name, config) {
    this.servers.set(name, {
      name,
      url: config.url,
      apiKey: config.apiKey,
      headers: config.headers || {}, // Custom headers til alle requests
      useAuth0Token: config.useAuth0Token || false, // Send Auth0 token med
      transport: config.transport || 'http', // 'http', 'websocket', 'stdio'
      status: 'disconnected',
      tools: [],
      resources: [],
    });
  }

  /**
   * Sæt Auth0 token til brug i requests
   */
  setAuth0Token(token) {
    this.auth0Token = token;
  }

  /**
   * Byg headers for en server request
   */
  buildHeaders(server) {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Brug Auth0 token hvis aktiveret for denne server
    if (server.useAuth0Token && this.auth0Token) {
      headers['Authorization'] = `Bearer ${this.auth0Token}`;
    } 
    // Ellers brug API key hvis defineret
    else if (server.apiKey) {
      headers['Authorization'] = `Bearer ${server.apiKey}`;
    }

    // Custom headers overskriver defaults
    return {
      ...headers,
      ...server.headers,
    };
  }

  /**
   * Forbind til alle konfigurerede MCP servere
   */
  async connectAll() {
    const connections = [];
    for (const [name, server] of this.servers) {
      connections.push(this.connect(name));
    }
    await Promise.allSettled(connections);
    this.isConnected = true;
  }

  /**
   * Forbind til en specifik MCP server
   */
  async connect(serverName) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server '${serverName}' not found`);
    }

    try {
      // Initialize connection og hent capabilities
      const response = await fetch(`${server.url}/initialize`, {
        method: 'POST',
        headers: this.buildHeaders(server),
        body: JSON.stringify({
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          clientInfo: {
            name: 'AIChatBot',
            version: '1.0.0',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to ${serverName}`);
      }

      const data = await response.json();
      server.status = 'connected';
      server.capabilities = data.capabilities;
      server.serverInfo = data.serverInfo;

      // Hent tilgængelige tools
      await this.listTools(serverName);
      
      // Hent tilgængelige resources
      await this.listResources(serverName);

      console.log(`Connected to MCP server: ${serverName}`, server);
      return server;
    } catch (error) {
      server.status = 'error';
      server.error = error.message;
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Hent liste af tools fra en MCP server
   */
  async listTools(serverName) {
    const server = this.servers.get(serverName);
    if (!server || server.status !== 'connected') return [];

    try {
      const response = await fetch(`${server.url}/tools/list`, {
        method: 'POST',
        headers: this.buildHeaders(server),
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        server.tools = data.tools || [];
        
        // Gem tools med server reference
        for (const tool of server.tools) {
          this.tools.set(`${serverName}:${tool.name}`, {
            ...tool,
            serverName,
          });
        }
        
        return server.tools;
      }
    } catch (error) {
      console.error(`Failed to list tools from ${serverName}:`, error);
    }
    return [];
  }

  /**
   * Hent liste af resources fra en MCP server
   */
  async listResources(serverName) {
    const server = this.servers.get(serverName);
    if (!server || server.status !== 'connected') return [];

    try {
      const response = await fetch(`${server.url}/resources/list`, {
        method: 'POST',
        headers: this.buildHeaders(server),
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        server.resources = data.resources || [];
        
        // Gem resources med server reference
        for (const resource of server.resources) {
          this.resources.set(`${serverName}:${resource.uri}`, {
            ...resource,
            serverName,
          });
        }
        
        return server.resources;
      }
    } catch (error) {
      console.error(`Failed to list resources from ${serverName}:`, error);
    }
    return [];
  }

  /**
   * Kald et tool på en MCP server
   */
  async callTool(serverName, toolName, args = {}) {
    const server = this.servers.get(serverName);
    if (!server || server.status !== 'connected') {
      throw new Error(`MCP server '${serverName}' is not connected`);
    }

    try {
      const response = await fetch(`${server.url}/tools/call`, {
        method: 'POST',
        headers: this.buildHeaders(server),
        body: JSON.stringify({
          name: toolName,
          arguments: args,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Tool call failed: ${toolName}`);
      }

      const data = await response.json();
      return data.content || data;
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Læs en resource fra en MCP server
   */
  async readResource(serverName, uri) {
    const server = this.servers.get(serverName);
    if (!server || server.status !== 'connected') {
      throw new Error(`MCP server '${serverName}' is not connected`);
    }

    try {
      const response = await fetch(`${server.url}/resources/read`, {
        method: 'POST',
        headers: this.buildHeaders(server),
        body: JSON.stringify({ uri }),
      });

      if (!response.ok) {
        throw new Error(`Failed to read resource: ${uri}`);
      }

      const data = await response.json();
      return data.contents || data;
    } catch (error) {
      console.error(`Failed to read resource ${uri} from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Hent alle tilgængelige tools fra alle servere
   */
  getAllTools() {
    const allTools = [];
    for (const [key, tool] of this.tools) {
      allTools.push({
        id: key,
        ...tool,
      });
    }
    return allTools;
  }

  /**
   * Hent alle tilgængelige resources fra alle servere
   */
  getAllResources() {
    const allResources = [];
    for (const [key, resource] of this.resources) {
      allResources.push({
        id: key,
        ...resource,
      });
    }
    return allResources;
  }

  /**
   * Konverter MCP tools til Azure/OpenAI function format
   */
  getToolsAsOpenAIFunctions() {
    return this.getAllTools().map((tool) => ({
      type: 'function',
      function: {
        name: tool.id.replace(':', '_'), // Replace : with _ for valid function names
        description: tool.description || '',
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
        },
      },
    }));
  }

  /**
   * Hent server status
   */
  getServerStatus() {
    const status = {};
    for (const [name, server] of this.servers) {
      status[name] = {
        status: server.status,
        toolCount: server.tools?.length || 0,
        resourceCount: server.resources?.length || 0,
        error: server.error,
      };
    }
    return status;
  }

  /**
   * Disconnect fra alle servere
   */
  async disconnectAll() {
    this.tools.clear();
    this.resources.clear();
    for (const [name, server] of this.servers) {
      server.status = 'disconnected';
      server.tools = [];
      server.resources = [];
    }
    this.isConnected = false;
  }
}

// Singleton instance
const mcpClient = new MCPClient();

export default mcpClient;
