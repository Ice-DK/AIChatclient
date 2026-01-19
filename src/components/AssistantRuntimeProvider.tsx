import { useCallback, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useAction } from "convex/react";
import {
  AssistantRuntimeProvider as Provider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from "@assistant-ui/react";
import { api } from "../../convex/_generated/api";
import type { Id, Doc } from "../../convex/_generated/dataModel";

interface ConvexRuntimeProviderProps {
  children: ReactNode;
  conversationId: Id<"conversations">;
  messages: Doc<"messages">[] | undefined;
}

// Konverter Convex message til assistant-ui format
const convertMessage = (message: Doc<"messages">): ThreadMessageLike => {
  return {
    role: message.role as "user" | "assistant",
    content: [{ type: "text", text: message.content }],
    id: message._id,
    createdAt: new Date(message.createdAt),
  };
};

export function ConvexRuntimeProvider({
  children,
  conversationId,
  messages,
}: ConvexRuntimeProviderProps) {
  const { getAccessTokenSilently } = useAuth0();
  const chatAction = useAction(api.ai.chat);
  const [isRunning, setIsRunning] = useState(false);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      if (message.content[0]?.type !== "text") {
        throw new Error("Only text messages are supported");
      }

      const userMessage = message.content[0].text;
      setIsRunning(true);

      try {
        // Prøv at hente Auth0 token (optional - bruges til MCP kald)
        let token: string | undefined;
        try {
          token = await getAccessTokenSilently();
        } catch (tokenError) {
          console.log("Auth0 token not available for API calls:", tokenError);
        }

        // Send til AI action
        await chatAction({
          conversationId,
          userMessage,
          auth0Token: token,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      } finally {
        setIsRunning(false);
      }
    },
    [conversationId, chatAction, getAccessTokenSilently]
  );

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages: messages ?? [],
    convertMessage,
    onNew,
  });

  return <Provider runtime={runtime}>{children}</Provider>;
}
