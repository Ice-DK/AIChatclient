import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Settings } from "./Settings";

export function Header() {
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();
  const [showSettings, setShowSettings] = useState(false);

  const convexUser = useQuery(
    api.users.getByAuth0Id,
    isAuthenticated && user?.sub ? { auth0Id: user.sub } : "skip"
  );

  const atlassianConnection = useQuery(
    api.atlassian.getEnabledConnection,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-logo">
            <img src="/chaos-bat.png" alt="Chaos.bat" className="header-bot-avatar" />
            <span className="logo-text">Chaos.bat</span>
            {atlassianConnection && (
              <span className="integration-badge atlassian" title="Atlassian forbundet">
                🔗
              </span>
            )}
          </div>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <button
                  className="settings-button"
                  onClick={() => setShowSettings(true)}
                  title="Indstillinger"
                >
                  ⚙️
                </button>
                <div className="user-info">
                  {user?.picture && (
                    <img 
                      src={user.picture} 
                      alt={user.name} 
                      className="user-avatar"
                    />
                  )}
                  <span className="user-name">{user?.name}</span>
                </div>
                <button
                  className="logout-button"
                  onClick={() => logout({ 
                    logoutParams: { returnTo: window.location.origin } 
                  })}
                >
                  Log ud
                </button>
              </>
            ) : (
              <button
                className="login-button"
                onClick={() => loginWithRedirect()}
              >
                Log ind
              </button>
            )}
          </div>
        </div>
      </header>
      
      {showSettings && convexUser && (
        <Settings 
          userId={convexUser._id} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </>
  );
}
