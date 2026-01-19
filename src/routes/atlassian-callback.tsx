import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function AtlassianCallbackRoute() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const exchangeCode = useAction(api.atlassian.exchangeOAuthCode);
  const getResources = useAction(api.atlassian.getAccessibleResources);
  const saveConnection = useMutation(api.atlassian.saveConnection);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state"); // userId
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setErrorMessage(params.get("error_description") || "Atlassian login blev afvist");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Manglende autorisationskode eller state");
        return;
      }

      try {
        // Exchange code for tokens
        const redirectUri = `${window.location.origin}/atlassian/callback`;
        const tokens = await exchangeCode({ code, redirectUri });

        // Get accessible Atlassian resources (cloud sites)
        const resources = await getResources({ accessToken: tokens.accessToken });

        if (resources.length === 0) {
          setStatus("error");
          setErrorMessage("Ingen tilgængelige Atlassian sites fundet");
          return;
        }

        // Save connection for each resource (usually just one)
        const userId = state as Id<"users">;
        for (const resource of resources) {
          await saveConnection({
            userId,
            cloudId: resource.id,
            siteName: resource.name || resource.url,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: Date.now() + tokens.expiresIn * 1000,
            scopes: tokens.scope.split(" "),
          });
        }

        setStatus("success");
        
        // Redirect tilbage til chat efter 2 sekunder
        setTimeout(() => {
          navigate({ to: "/" });
        }, 2000);

      } catch (err) {
        console.error("Atlassian OAuth error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Ukendt fejl");
      }
    };

    handleCallback();
  }, [exchangeCode, getResources, saveConnection, navigate]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        {status === "loading" && (
          <>
            <div className="callback-spinner">🔄</div>
            <h2>Forbinder til Atlassian...</h2>
            <p>Vent venligst mens vi fuldfører forbindelsen.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="callback-icon success">✅</div>
            <h2>Atlassian forbundet!</h2>
            <p>Du kan nu søge i Jira og Confluence via Chaos.bat.</p>
            <p className="callback-redirect">Redirecter til chat...</p>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="callback-icon error">❌</div>
            <h2>Forbindelse fejlede</h2>
            <p>{errorMessage}</p>
            <button 
              className="callback-btn"
              onClick={() => navigate({ to: "/" })}
            >
              Tilbage til chat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
