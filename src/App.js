import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ChatBot from './components/ChatBot';
import LoginButton from './components/LoginButton';
import LogoutButton from './components/LogoutButton';
import UserProfile from './components/UserProfile';
import LoadingSpinner from './components/LoadingSpinner';
import MCPStatus from './components/MCPStatus';
import './styles/App.css';

function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="auth-section">
            {isAuthenticated && <MCPStatus />}
            {isAuthenticated ? (
              <>
                <UserProfile />
                <LogoutButton />
              </>
            ) : (
              <LoginButton />
            )}
          </div>
          </div>
      </header>        
      <main className="app-main">
        {isAuthenticated ? (
          <ChatBot />
        ) : (
          <div className="welcome-section">
            <div className="welcome-card">
              <div className="welcome-icon">🔐</div>
              <h2>Velkommen til AI ChatBot</h2>
              <p>Log ind for at starte en samtale med vores AI assistent.</p>
              <LoginButton className="welcome-login-btn" />
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2026 AI ChatBot - Sikret med Auth0</p>
      </footer>
    </div>
  );
}

export default App;
