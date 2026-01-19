import { useAuth0 } from "@auth0/auth0-react";
import { useConvex, useMutation } from "convex/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type { Id, Doc } from "../../convex/_generated/dataModel";

export function Sidebar() {
  const { user, isLoading: isAuthLoading } = useAuth0();
  const convex = useConvex();
  const navigate = useNavigate();
  
  const [convexUser, setConvexUser] = useState<Doc<"users"> | null>(null);
  const [conversations, setConversations] = useState<Doc<"conversations">[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const createConversation = useMutation(api.conversations.create);
  const deleteConversation = useMutation(api.conversations.remove);
  
  // Prøv at hente conversationId fra URL hvis vi er på chat route
  let currentConversationId: string | undefined;
  try {
    const params = useParams({ from: "/chat/$conversationId" });
    currentConversationId = params.conversationId;
  } catch {
    currentConversationId = undefined;
  }

  // Hent bruger og samtaler når auth er klar
  useEffect(() => {
    if (!user?.sub) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    
    const fetchData = async () => {
      try {
        // Hent bruger
        const fetchedUser = await convex.query(api.users.getByAuth0Id, { auth0Id: user.sub! });
        if (cancelled) return;
        
        setConvexUser(fetchedUser);
        
        if (fetchedUser) {
          // Hent samtaler
          const fetchedConversations = await convex.query(api.conversations.listByUser, { userId: fetchedUser._id });
          if (cancelled) return;
          setConversations(fetchedConversations);
        }
      } catch (error) {
        console.error("Error fetching sidebar data:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user?.sub, convex]);

  // Refetch samtaler når convexUser ændres
  const refetchConversations = useCallback(async () => {
    if (!convexUser?._id) return;
    try {
      const fetchedConversations = await convex.query(api.conversations.listByUser, { userId: convexUser._id });
      setConversations(fetchedConversations);
    } catch (error) {
      console.error("Error refetching conversations:", error);
    }
  }, [convexUser?._id, convex]);

  const handleNewChat = useCallback(async () => {
    if (!convexUser) return;

    const conversationId = await createConversation({
      userId: convexUser._id,
      title: "Ny samtale",
    });

    // Refetch conversations
    const fetchedConversations = await convex.query(api.conversations.listByUser, { userId: convexUser._id });
    setConversations(fetchedConversations);

    navigate({ to: "/chat/$conversationId", params: { conversationId } });
  }, [convexUser, createConversation, convex, navigate]);

  const handleSelectConversation = useCallback((conversationId: Id<"conversations">) => {
    navigate({ to: "/chat/$conversationId", params: { conversationId } });
  }, [navigate]);

  const handleDeleteConversation = useCallback(async (
    e: React.MouseEvent,
    conversationId: Id<"conversations">
  ) => {
    e.stopPropagation();
    await deleteConversation({ id: conversationId });
    
    // Refetch conversations
    if (convexUser) {
      const fetchedConversations = await convex.query(api.conversations.listByUser, { userId: convexUser._id });
      setConversations(fetchedConversations);
    }
    
    // Hvis vi sletter den aktive samtale, naviger til forsiden
    if (conversationId === currentConversationId) {
      navigate({ to: "/" });
    }
  }, [deleteConversation, convexUser, convex, currentConversationId, navigate]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "I dag";
    if (days === 1) return "I går";
    if (days < 7) return `${days} dage siden`;
    return date.toLocaleDateString("da-DK");
  };

  // Vis loading state
  if (isAuthLoading || isLoading) {
    return (
      <aside className="sidebar">
        <div className="loading">Indlæser...</div>
      </aside>
    );
  }

  // Vis ikke sidebar hvis bruger ikke er logget ind
  if (!user?.sub || !convexUser) {
    return (
      <aside className="sidebar">
        <div className="loading">Indlæser bruger...</div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <button className="new-chat-btn" onClick={handleNewChat}>
        <span>✨</span>
        Ny samtale
      </button>

      <div className="conversations-list">
        <h3>Samtaler</h3>
        {conversations === null ? (
          <p className="loading-conversations">Indlæser samtaler...</p>
        ) : conversations.length === 0 ? (
          <p className="no-conversations">Ingen samtaler endnu</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv._id}
              className={`conversation-item ${
                conv._id === currentConversationId ? "active" : ""
              }`}
              onClick={() => handleSelectConversation(conv._id)}
            >
              <div className="conversation-info">
                <span className="conversation-title">{conv.title}</span>
                <span className="conversation-date">
                  {formatDate(conv.updatedAt)}
                </span>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDeleteConversation(e, conv._id)}
                title="Slet samtale"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}