import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import mcpClient from '../services/MCPClient';

const MCPContext = createContext(null);

export function MCPProvider({ children }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [servers, setServers] = useState({});
  const [tools, setTools] = useState([]);
  const [resources, setResources] = useState([]);
  const [error, setError] = useState(null);

  // Opdater Auth0 token i MCP client når authentication ændres
  useEffect(() => {
    const updateToken = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          mcpClient.setAuth0Token(token);
        } catch (err) {
          console.error('Failed to get Auth0 token for MCP:', err);
        }
      } else {
        mcpClient.setAuth0Token(null);
      }
    };
    updateToken();
  }, [isAuthenticated, getAccessTokenSilently]);

  // Indlæs MCP server konfiguration fra environment
  const loadServersFromEnv = useCallback(() => {
    const mcpServersJson = process.env.REACT_APP_MCP_SERVERS;
    
    if (mcpServersJson) {
      try {
        const serverConfigs = JSON.parse(mcpServersJson);
        for (const [name, config] of Object.entries(serverConfigs)) {
          mcpClient.addServer(name, config);
        }
        return true;
      } catch (e) {
        console.error('Failed to parse MCP_SERVERS config:', e);
        setError('Invalid MCP server configuration');
        return false;
      }
    }

    // Alternativt: Læs individuelle server configs
    const serverCount = parseInt(process.env.REACT_APP_MCP_SERVER_COUNT || '0', 10);
    for (let i = 1; i <= serverCount; i++) {
      const name = process.env[`REACT_APP_MCP_SERVER_${i}_NAME`];
      const url = process.env[`REACT_APP_MCP_SERVER_${i}_URL`];
      const apiKey = process.env[`REACT_APP_MCP_SERVER_${i}_API_KEY`];
      const headersJson = process.env[`REACT_APP_MCP_SERVER_${i}_HEADERS`];
      const useAuth0Token = process.env[`REACT_APP_MCP_SERVER_${i}_USE_AUTH0_TOKEN`] === 'true';
      
      let headers = {};
      if (headersJson) {
        try {
          headers = JSON.parse(headersJson);
        } catch (e) {
          console.error(`Failed to parse headers for MCP server ${name}:`, e);
        }
      }
      
      if (name && url) {
        mcpClient.addServer(name, { url, apiKey, headers, useAuth0Token });
      }
    }

    return serverCount > 0;
  }, []);

  // Forbind til alle MCP servere
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const hasServers = loadServersFromEnv();
      
      if (!hasServers) {
        setIsConnecting(false);
        return;
      }

      await mcpClient.connectAll();
      
      setIsConnected(mcpClient.isConnected);
      setServers(mcpClient.getServerStatus());
      setTools(mcpClient.getAllTools());
      setResources(mcpClient.getAllResources());
    } catch (err) {
      setError(err.message);
      console.error('MCP connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [loadServersFromEnv]);

  // Disconnect fra alle servere
  const disconnect = useCallback(async () => {
    await mcpClient.disconnectAll();
    setIsConnected(false);
    setServers({});
    setTools([]);
    setResources([]);
  }, []);

  // Tilføj en ny server dynamisk
  const addServer = useCallback(async (name, config) => {
    try {
      mcpClient.addServer(name, config);
      await mcpClient.connect(name);
      
      setServers(mcpClient.getServerStatus());
      setTools(mcpClient.getAllTools());
      setResources(mcpClient.getAllResources());
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Kald et tool
  const callTool = useCallback(async (serverName, toolName, args) => {
    return mcpClient.callTool(serverName, toolName, args);
  }, []);

  // Læs en resource
  const readResource = useCallback(async (serverName, uri) => {
    return mcpClient.readResource(serverName, uri);
  }, []);

  // Auto-connect ved mount hvis konfiguration findes
  useEffect(() => {
    const autoConnect = process.env.REACT_APP_MCP_AUTO_CONNECT !== 'false';
    if (autoConnect) {
      connect();
    }
  }, [connect]);

  const value = {
    isConnected,
    isConnecting,
    servers,
    tools,
    resources,
    error,
    connect,
    disconnect,
    addServer,
    callTool,
    readResource,
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within a MCPProvider');
  }
  return context;
}

export default MCPContext;
