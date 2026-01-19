import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isError?: boolean;
  isMCPNotification?: boolean;
  toolsUsed?: boolean;
  userPicture?: string;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  isError,
  isMCPNotification,
  toolsUsed,
  userPicture,
}: ChatMessageProps) {
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`message ${role} ${isError ? "error" : ""} ${
        isMCPNotification ? "mcp-notification" : ""
      }`}
    >
      <div className="message-avatar">
        {role === "assistant" ? (
          <img src="/chaos-bat.png" alt="Chaos.bat" className="bot-avatar" />
        ) : userPicture ? (
          <img src={userPicture} alt="User" className="user-avatar-small" />
        ) : (
          "👤"
        )}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          <ReactMarkdown>{content}</ReactMarkdown>
          {toolsUsed && (
            <span className="tools-badge" title="AI brugte tools til dette svar">
              🔧
            </span>
          )}
        </div>
        <span className="message-time">{formatTime(timestamp)}</span>
      </div>
    </div>
  );
}
