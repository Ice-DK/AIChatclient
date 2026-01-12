import React, { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ReactMarkdown from 'react-markdown';
import { useMCP } from '../contexts/MCPContext';
import aiService from '../services/AIService';
import '../styles/ChatBot.css';

function ChatBot() {
  const { user } = useAuth0();
  const { isConnected: mcpConnected, tools } = useMCP();
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: `Hej ${user?.name || 'der'}! 👋 Jeg er din AI assistent. Hvordan kan jeg hjælpe dig i dag?`,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Vis besked når MCP tools bliver tilgængelige
  useEffect(() => {
    if (mcpConnected && tools.length > 0) {
      setMessages((prev) => {
        // Tjek om vi allerede har vist denne besked
        const hasToolMessage = prev.some(m => m.isMCPNotification);
        if (hasToolMessage) return prev;
        
        return [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: `🔌 **MCP forbundet!** Jeg har nu adgang til ${tools.length} tools der kan hjælpe mig med at assistere dig bedre.`,
          timestamp: new Date(),
          isMCPNotification: true,
        }];
      });
    }
  }, [mcpConnected, tools.length]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Send besked til AI via AIService (håndterer MCP tools automatisk)
      const response = await aiService.sendMessage(
        userMessage.content,
        messages.filter(m => !m.isMCPNotification && !m.isError)
      );
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        toolsUsed: response.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Beklager, der opstod en fejl: ${error.message}. Prøv venligst igen.`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        content: `Chat ryddet! Hvordan kan jeg hjælpe dig, ${user?.name || 'der'}?`,
        timestamp: new Date(),
      },
    ]);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('da-DK', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="status-indicator online"></span>
          <span>AI Assistent</span>
        </div>
        <button onClick={clearChat} className="clear-chat-btn" title="Ryd chat">
          🗑️
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role} ${message.isError ? 'error' : ''}`}
          >
            <div className="message-avatar">
              {message.role === 'assistant' ? '🤖' : user?.picture ? (
                <img src={user.picture} alt="User" className="user-avatar-small" />
              ) : '👤'}
            </div>
            <div className="message-content">
              <div className="message-bubble">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="message-bubble typing">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Skriv din besked her..."
          disabled={isLoading}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="send-button"
        >
          {isLoading ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
}

export default ChatBot;
