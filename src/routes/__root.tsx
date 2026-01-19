import { Outlet } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";

export function RootLayout() {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const upsertUser = useMutation(api.users.upsertUser);

  // Synkroniser Auth0 bruger til Convex
  useEffect(() => {
    if (isAuthenticated && user) {
      upsertUser({
        auth0Id: user.sub!,
        email: user.email!,
        name: user.name,
        picture: user.picture,
      });
    }
  }, [isAuthenticated, user, upsertUser]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Indlæser...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Header />
      <div className="app-content">
        {isAuthenticated && !isLoading && <Sidebar />}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
