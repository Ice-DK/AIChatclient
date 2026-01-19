import { useAuthRequiredHandler } from "../hooks/useOAuth";

interface AuthRequiredModalProps {
  provider: string | null;
  reason: string | null;
  isAuthenticating: boolean;
  onReauth: () => Promise<boolean>;
  onDismiss: () => void;
}

const providerNames: Record<string, string> = {
  atlassian: "Atlassian",
  microsoft_partner_center: "Microsoft Partner Center",
};

const providerIcons: Record<string, string> = {
  atlassian: "🔷",
  microsoft_partner_center: "🟦",
};

export function AuthRequiredModal({
  provider,
  reason,
  isAuthenticating,
  onReauth,
  onDismiss,
}: AuthRequiredModalProps) {
  if (!provider) return null;

  const providerName = providerNames[provider] || provider;
  const icon = providerIcons[provider] || "🔐";

  return (
    <div className="auth-required-overlay">
      <div className="auth-required-modal">
        <div className="auth-required-icon">{icon}</div>
        <h2>Godkendelse påkrævet</h2>
        <p>
          Din {providerName} session er udløbet eller blev tilbagekaldt.
        </p>
        {reason && <p className="auth-required-reason">{reason}</p>}
        <div className="auth-required-actions">
          <button
            className="btn-primary"
            onClick={onReauth}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "Logger ind..." : `Log ind med ${providerName}`}
          </button>
          <button className="btn-secondary" onClick={onDismiss}>
            Annuller
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook-based component that can be used anywhere in the app
 */
export function AuthRequiredHandler({
  children,
}: {
  children: (handleAuthRequired: (provider: string, reason: string) => void) => React.ReactNode;
}) {
  const {
    pendingProvider,
    pendingReason,
    isAuthenticating,
    handleAuthRequired,
    handleReauth,
    dismissAuthRequired,
  } = useAuthRequiredHandler();

  return (
    <>
      {children(handleAuthRequired)}
      <AuthRequiredModal
        provider={pendingProvider}
        reason={pendingReason}
        isAuthenticating={isAuthenticating}
        onReauth={handleReauth}
        onDismiss={dismissAuthRequired}
      />
    </>
  );
}
