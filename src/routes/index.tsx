import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function IndexRoute() {
  const { isAuthenticated, user, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  
  const convexUser = useQuery(
    api.users.getByAuth0Id,
    isAuthenticated && user?.sub ? { auth0Id: user.sub } : "skip"
  );
  
  const conversations = useQuery(
    api.conversations.listByUser,
    convexUser ? { userId: convexUser._id } : "skip"
  );
  
  const createConversation = useMutation(api.conversations.create);

  // Opret ny samtale og naviger til den
  const handleNewChat = async () => {
    if (!convexUser) return;
    
    const conversationId = await createConversation({
      userId: convexUser._id,
      title: "Ny samtale",
    });
    
    navigate({ to: "/chat/$conversationId", params: { conversationId } });
  };

  // Auto-naviger til seneste samtale eller opret ny
  useEffect(() => {
    if (isAuthenticated && convexUser && conversations) {
      if (conversations.length > 0) {
        navigate({ 
          to: "/chat/$conversationId", 
          params: { conversationId: conversations[0]._id } 
        });
      }
    }
  }, [isAuthenticated, convexUser, conversations, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="welcome-container">
        <div className="welcome-card">
          <div className="welcome-icon"><img src="/chaos-bat.png" alt="Chaos.bat" className="welcome-bot-avatar" /></div>
          <h1>Velkommen til Chaos.bat</h1>
          <p>
            Chaos.bat - din kaotiske AI assistent med real-time chat og MCP server support.
          </p>
          <button 
            className="login-button"
            onClick={() => loginWithRedirect()}
          >
            🔐 Log ind med Auth0
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <div className="welcome-icon">💬</div>
        <h2>Hej {user?.name || "der"}!</h2>
        <p>Start en ny samtale med Chaos.bat.</p>
        <button 
          className="new-chat-button"
          onClick={handleNewChat}
          disabled={!convexUser}
        >
          ✨ Start ny samtale
        </button>
      </div>
    </div>
  );
}
