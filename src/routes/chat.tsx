import { useParams, useNavigate } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { AuthGuard } from "../components/AuthGuard";
import type { Id } from "../../convex/_generated/dataModel";

function ChatContent() {
  const { conversationId } = useParams({ from: "/chat/$conversationId" });
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  
  // Hent bruger fra Convex
  const convexUser = useQuery(
    api.users.getByAuth0Id,
    isAuthenticated && user?.sub ? { auth0Id: user.sub } : "skip"
  );
  
  // Hent Atlassian connection
  const atlassianConnection = useQuery(
    api.atlassian.getEnabledConnection,
    convexUser ? { userId: convexUser._id } : "skip"
  );
  
  const conversation = useQuery(api.conversations.get, {
    id: conversationId as Id<"conversations">,
  });
  
  const messages = useQuery(api.messages.listByConversation, {
    conversationId: conversationId as Id<"conversations">,
  });
  
  const sendMessage = useMutation(api.messages.send);
  const clearMessages = useMutation(api.messages.clearConversation);
  const chatAction = useAction(api.ai.chat);
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tjek om brugeren ejer denne samtale
  useEffect(() => {
    if (conversation && convexUser && conversation.userId !== convexUser._id) {
      // Brugeren ejer ikke denne samtale - redirect til forsiden
      navigate({ to: "/" });
    }
  }, [conversation, convexUser, navigate]);

  // Auto-scroll til bunden
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      // Prøv at hente Auth0 token (optional - bruges til MCP kald)
      let token: string | undefined;
      try {
        token = await getAccessTokenSilently();
      } catch (tokenError) {
        // Token ikke tilgængelig - fortsæt uden (AI chat virker stadig)
        console.log("Auth0 token not available for API calls:", tokenError);
      }
      
      // Send til AI action
      await chatAction({
        conversationId: conversationId as Id<"conversations">,
        userMessage: messageContent,
        auth0Token: token,
        atlassianToken: atlassianConnection?.accessToken,
        atlassianCloudId: atlassianConnection?.cloudId,
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    await clearMessages({
      conversationId: conversationId as Id<"conversations">,
    });
    
    // Send velkomstbesked
    await sendMessage({
      conversationId: conversationId as Id<"conversations">,
      role: "assistant",
      content: `Chat ryddet! Hvordan kan jeg hjælpe dig, ${user?.name || "der"}?`,
    });
  };

  if (!conversation) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Indlæser samtale...</p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="status-indicator online" />
          <span>Chaos.bat</span>
        </div>
        <button 
          onClick={handleClearChat} 
          className="clear-chat-btn" 
          title="Ryd chat"
        >
          🗑️
        </button>
      </div>

      <div className="messages-container">
        {messages?.length === 0 && (
          <ChatMessage
            role="assistant"
            content={`Hej ${user?.name || "der"}! 👋 Jeg er Chaos.bat - din kaotiske AI assistent. Hvad kan jeg ødelægge... øh, hjælpe dig med i dag?`}
            timestamp={Date.now()}
            userPicture={user?.picture}
          />
        )}
        
        {messages?.map((message) => (
          <ChatMessage
            key={message._id}
            role={message.role}
            content={message.content}
            timestamp={message.createdAt}
            isError={message.isError}
            isMCPNotification={message.isMCPNotification}
            toolsUsed={message.toolsUsed}
            userPicture={user?.picture}
          />
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar"><img src="/chaos-bat.png" alt="Chaos.bat" className="bot-avatar" /></div>
            <div className="message-content">
              <div className="message-bubble typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

// Eksporter ChatRoute med AuthGuard wrapper
export function ChatRoute() {
  return (
    <AuthGuard>
      <ChatContent />
    </AuthGuard>
  );
}
