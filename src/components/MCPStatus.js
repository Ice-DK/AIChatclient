import React, { useState } from 'react';
import { useMCP } from '../contexts/MCPContext';
import '../styles/MCPStatus.css';

function MCPStatus() {
  const { 
    isConnected, 
    isConnecting, 
    servers, 
    tools, 
    resources, 
    error,
    connect,
    disconnect,
  } = useMCP();
  
  const [isExpanded, setIsExpanded] = useState(false);

  const serverCount = Object.keys(servers).length;
  const connectedCount = Object.values(servers).filter(s => s.status === 'connected').length;

  if (serverCount === 0 && !isConnecting) {
    return null; // Vis ikke hvis ingen servere er konfigureret
  }

  return (
    <div className={`mcp-status ${isExpanded ? 'expanded' : ''}`}>
      <button 
        className="mcp-status-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title="MCP Server Status"
      >
        <span className={`mcp-indicator ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`}>
          {isConnecting ? '⏳' : isConnected ? '🔌' : '⭕'}
        </span>
        <span className="mcp-label">
          MCP {connectedCount > 0 ? `(${connectedCount}/${serverCount})` : ''}
        </span>
      </button>

      {isExpanded && (
        <div className="mcp-panel">
          <div className="mcp-panel-header">
            <h4>MCP Servere</h4>
            <button 
              onClick={isConnected ? disconnect : connect}
              className="mcp-action-btn"
              disabled={isConnecting}
            >
              {isConnecting ? 'Forbinder...' : isConnected ? 'Afbryd' : 'Forbind'}
            </button>
          </div>

          {error && (
            <div className="mcp-error">
              ⚠️ {error}
            </div>
          )}

          <div className="mcp-servers">
            {Object.entries(servers).map(([name, server]) => (
              <div key={name} className={`mcp-server ${server.status}`}>
                <div className="mcp-server-header">
                  <span className={`status-dot ${server.status}`}></span>
                  <span className="server-name">{name}</span>
                </div>
                <div className="mcp-server-info">
                  <span>🔧 {server.toolCount} tools</span>
                  <span>📁 {server.resourceCount} resources</span>
                </div>
                {server.error && (
                  <div className="server-error">{server.error}</div>
                )}
              </div>
            ))}
          </div>

          {tools.length > 0 && (
            <div className="mcp-section">
              <h5>Tilgængelige Tools ({tools.length})</h5>
              <ul className="mcp-tools-list">
                {tools.slice(0, 10).map((tool) => (
                  <li key={tool.id} title={tool.description}>
                    <span className="tool-icon">🔧</span>
                    <span className="tool-name">{tool.name}</span>
                  </li>
                ))}
                {tools.length > 10 && (
                  <li className="more-items">+{tools.length - 10} mere...</li>
                )}
              </ul>
            </div>
          )}

          {resources.length > 0 && (
            <div className="mcp-section">
              <h5>Tilgængelige Resources ({resources.length})</h5>
              <ul className="mcp-resources-list">
                {resources.slice(0, 5).map((resource) => (
                  <li key={resource.id} title={resource.description}>
                    <span className="resource-icon">📄</span>
                    <span className="resource-name">{resource.name || resource.uri}</span>
                  </li>
                ))}
                {resources.length > 5 && (
                  <li className="more-items">+{resources.length - 5} mere...</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MCPStatus;
