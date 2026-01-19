import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import "./Settings.css";

// Atlassian OAuth configuration
const ATLASSIAN_CLIENT_ID = import.meta.env.VITE_ATLASSIAN_CLIENT_ID || "";
console.log("ATLASSIAN_CLIENT_ID:", ATLASSIAN_CLIENT_ID);
const ATLASSIAN_REDIRECT_URI = `${window.location.origin}/atlassian/callback`;
const ATLASSIAN_SCOPES = [
  // Jira
  "read:jira-work",
  "read:jira-user",
  // Confluence  
  "read:confluence-content.all",
  "read:confluence-space.summary",
  "read:confluence-content.summary",
  "search:confluence",
  // User identity
  "read:me",
  "read:account",
  // Refresh token
  "offline_access",
].join(" ");

interface SettingsProps {
  userId: Id<"users">;
  onClose: () => void;
}

export function Settings({ userId, onClose }: SettingsProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  
  const connections = useQuery(api.atlassian.getConnections, { userId });
  const toggleConnection = useMutation(api.atlassian.toggleConnection);
  const deleteConnection = useMutation(api.atlassian.deleteConnection);

  const handleConnectAtlassian = () => {
    if (!ATLASSIAN_CLIENT_ID) {
      alert("Atlassian Client ID er ikke konfigureret. Kontakt administrator.");
      return;
    }

    setIsConnecting(true);
    
    // Byg OAuth URL til Atlassian
    const authUrl = new URL("https://auth.atlassian.com/authorize");
    authUrl.searchParams.set("audience", "api.atlassian.com");
    authUrl.searchParams.set("client_id", ATLASSIAN_CLIENT_ID);
    authUrl.searchParams.set("scope", ATLASSIAN_SCOPES);
    authUrl.searchParams.set("redirect_uri", ATLASSIAN_REDIRECT_URI);
    authUrl.searchParams.set("state", userId); // Pass userId i state for callback
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("prompt", "consent");

    // Redirect til Atlassian login
    window.location.href = authUrl.toString();
  };

  const handleToggleConnection = async (connectionId: Id<"atlassianConnections">, currentState: boolean) => {
    await toggleConnection({ connectionId, isEnabled: !currentState });
  };

  const handleDeleteConnection = async (connectionId: Id<"atlassianConnections">) => {
    if (confirm("Er du sikker på at du vil fjerne denne Atlassian forbindelse?")) {
      await deleteConnection({ connectionId });
    }
  };

  const isTokenExpired = (expiresAt: number) => {
    return Date.now() > expiresAt;
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Indstillinger</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <h3>🔗 Integrationer</h3>
            <p className="settings-description">
              Forbind eksterne tjenester for at give Chaos.bat adgang til mere context.
            </p>

            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12.77 2.19c-.73-.03-1.42.34-1.76.94l-6.6 11.7c-.34.6-.26 1.34.2 1.86l5.96 6.66c.46.52 1.2.68 1.85.4L18.6 20.3c.65-.29 1.06-.92 1.04-1.6L19 3.17c-.03-.67-.52-1.24-1.2-1.4l-5.02-.58z" fill="#0052CC"/>
                    <path d="M12 14.5l-4-7 4 7zm-4-7l8 0-4 7-4-7z" fill="white"/>
                  </svg>
                </div>
                <div className="integration-info">
                  <h4>Atlassian (Jira & Confluence)</h4>
                  <p>Søg i Jira issues og Confluence dokumentation</p>
                </div>
              </div>

              {connections && connections.length > 0 ? (
                <div className="integration-connections">
                  {connections.map((conn) => (
                    <div key={conn._id} className="connection-item">
                      <div className="connection-info">
                        <span className="connection-site">{conn.siteName}</span>
                        <span className={`connection-status ${conn.isEnabled ? "enabled" : "disabled"}`}>
                          {conn.isEnabled ? "✓ Aktiv" : "○ Inaktiv"}
                        </span>
                        {isTokenExpired(conn.expiresAt) && (
                          <span className="connection-expired">⚠️ Token udløbet</span>
                        )}
                      </div>
                      <div className="connection-actions">
                        <button
                          className={`toggle-btn ${conn.isEnabled ? "active" : ""}`}
                          onClick={() => handleToggleConnection(conn._id, conn.isEnabled)}
                          title={conn.isEnabled ? "Deaktiver" : "Aktiver"}
                        >
                          {conn.isEnabled ? "🔵" : "⚪"}
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteConnection(conn._id)}
                          title="Fjern forbindelse"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    className="add-connection-btn"
                    onClick={handleConnectAtlassian}
                    disabled={isConnecting}
                  >
                    + Tilføj anden Atlassian site
                  </button>
                </div>
              ) : (
                <button 
                  className="connect-btn atlassian"
                  onClick={handleConnectAtlassian}
                  disabled={isConnecting || !ATLASSIAN_CLIENT_ID}
                >
                  {isConnecting ? "Forbinder..." : "🔗 Forbind Atlassian"}
                </button>
              )}
              
              {!ATLASSIAN_CLIENT_ID && (
                <p className="integration-note">
                  ⚠️ Atlassian integration er ikke konfigureret
                </p>
              )}
            </div>
          </section>

          <section className="settings-section">
            <h3>ℹ️ Om Integrationer</h3>
            <div className="info-box">
              <p>
                Når du forbinder Atlassian, får Chaos.bat adgang til at:
              </p>
              <ul>
                <li>🔍 Søge i dine Jira issues og projekter</li>
                <li>📄 Læse Confluence sider og dokumentation</li>
                <li>✏️ Oprette og opdatere issues (hvis du tillader det)</li>
              </ul>
              <p className="info-note">
                Adgangen respekterer dine eksisterende Atlassian tilladelser.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
