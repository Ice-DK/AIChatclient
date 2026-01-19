import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect til login
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
      });
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Tjekker login...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Omdirigerer til login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
