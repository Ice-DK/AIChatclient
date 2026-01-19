import { useAuth0 } from "@auth0/auth0-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

/**
 * API client with Auth0 token injection
 */
export function useApiClient() {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  async function fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAccessTokenSilently();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch with SSE streaming support
   */
  async function fetchSSE(
    endpoint: string,
    body: unknown,
    callbacks: {
      onToken?: (token: string) => void;
      onToolCall?: (toolName: string, serverId: string) => void;
      onComplete?: (content: string) => void;
      onError?: (error: string) => void;
      onAuthRequired?: (provider: string, reason: string) => void;
    }
  ): Promise<void> {
    const token = await getAccessTokenSilently();

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          const event = line.slice(7);
          const dataLine = lines[lines.indexOf(line) + 1];
          if (dataLine?.startsWith("data: ")) {
            const data = JSON.parse(dataLine.slice(6));

            switch (event) {
              case "token":
                callbacks.onToken?.(data.token);
                break;
              case "tool_call":
                callbacks.onToolCall?.(data.toolName, data.serverId);
                break;
              case "complete":
                callbacks.onComplete?.(data.content);
                break;
              case "error":
                callbacks.onError?.(data.error);
                break;
              case "auth_required":
                callbacks.onAuthRequired?.(data.provider, data.reason);
                break;
            }
          }
        }
      }
    }
  }

  /**
   * Handle OAuth re-authentication
   */
  function triggerOAuthReauth(provider: string) {
    // Open OAuth flow in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${API_URL}/oauth/${provider}/authorize`,
      `oauth_${provider}`,
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for popup close or success
    return new Promise<boolean>((resolve) => {
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          resolve(true); // Assume success if closed normally
        }
      }, 500);

      // Also listen for postMessage from callback page
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "oauth_complete" && event.data?.provider === provider) {
          window.removeEventListener("message", handleMessage);
          clearInterval(checkPopup);
          popup?.close();
          resolve(event.data.success);
        }
      };
      window.addEventListener("message", handleMessage);
    });
  }

  return {
    // GET request
    get: <T>(endpoint: string) => fetchWithAuth<T>(endpoint),

    // POST request
    post: <T>(endpoint: string, body: unknown) =>
      fetchWithAuth<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    // PATCH request
    patch: <T>(endpoint: string, body: unknown) =>
      fetchWithAuth<T>(endpoint, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    // DELETE request
    delete: <T>(endpoint: string) =>
      fetchWithAuth<T>(endpoint, { method: "DELETE" }),

    // SSE streaming
    stream: fetchSSE,

    // OAuth re-auth trigger
    triggerOAuthReauth,
  };
}

// Types for API responses
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: {
    toolsUsed?: boolean;
    isError?: boolean;
  };
  createdAt: string;
}

export interface OAuthConnection {
  id: string;
  provider: string;
  providerUserId?: string;
  isEnabled: boolean;
  needsReauth: boolean;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  authType: string;
  oauthProvider?: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}
