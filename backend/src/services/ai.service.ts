import OpenAI from "openai";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { getAllUserMCPTools, callMCPTool, MCPResult } from "./mcp.service.js";
import { OAuthProvider } from "./oauth.service.js";

// Azure AI Foundry configuration
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: process.env.AZURE_OPENAI_ENDPOINT!,
});

const MODEL = process.env.AZURE_OPENAI_MODEL || "gpt-4o";

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolName: string, serverId: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onAuthRequired: (provider: OAuthProvider, reason: string) => void;
}

/**
 * Convert MCP tools to OpenAI function format
 */
function mcpToolsToOpenAIFunctions(
  mcpTools: Array<{
    serverId: string;
    serverName: string;
    tools: Array<{
      name: string;
      description: string;
      inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
      };
    }>;
  }>
): OpenAI.ChatCompletionTool[] {
  const functions: OpenAI.ChatCompletionTool[] = [];

  for (const server of mcpTools) {
    for (const tool of server.tools) {
      functions.push({
        type: "function",
        function: {
          name: `${server.serverId}__${tool.name}`, // Prefix with serverId
          description: `[${server.serverName}] ${tool.description}`,
          parameters: tool.inputSchema as OpenAI.FunctionParameters,
        },
      });
    }
  }

  return functions;
}

/**
 * Chat with AI using streaming and MCP tools
 */
export async function streamChat(
  userId: string,
  conversationId: string,
  userMessage: string,
  auth0Token: string,
  callbacks: StreamCallbacks
) {
  try {
    // Get conversation history
    const messages = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, conversationId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    // Convert to OpenAI format
    const chatHistory: ChatMessage[] = messages.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));

    // Add user message
    chatHistory.push({ role: "user", content: userMessage });

    // Save user message to DB
    await db.insert(schema.messages).values({
      conversationId,
      role: "user",
      content: userMessage,
    });

    // Get available MCP tools
    const mcpToolsResult = await getAllUserMCPTools(userId, auth0Token);

    if (mcpToolsResult.requiresAuth) {
      callbacks.onAuthRequired(
        mcpToolsResult.requiresAuth.provider,
        mcpToolsResult.requiresAuth.reason
      );
      return;
    }

    const tools = mcpToolsResult.data
      ? mcpToolsToOpenAIFunctions(mcpToolsResult.data)
      : [];

    // Start streaming chat
    let fullResponse = "";
    let toolCallsInProgress: Map<
      string,
      { serverId: string; toolName: string; arguments: string }
    > = new Map();

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: chatHistory as OpenAI.ChatCompletionMessageParam[],
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Handle content
      if (delta?.content) {
        fullResponse += delta.content;
        callbacks.onToken(delta.content);
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const id = toolCall.id || `tc_${toolCall.index}`;

          if (!toolCallsInProgress.has(id)) {
            toolCallsInProgress.set(id, {
              serverId: "",
              toolName: "",
              arguments: "",
            });
          }

          const tc = toolCallsInProgress.get(id)!;

          if (toolCall.function?.name) {
            const [serverId, toolName] = toolCall.function.name.split("__");
            tc.serverId = serverId;
            tc.toolName = toolName;
            callbacks.onToolCall(toolName, serverId);
          }

          if (toolCall.function?.arguments) {
            tc.arguments += toolCall.function.arguments;
          }
        }
      }

      // Handle finish reason
      if (chunk.choices[0]?.finish_reason === "tool_calls") {
        // Execute tool calls
        const toolResults: ChatMessage[] = [];

        for (const [id, tc] of toolCallsInProgress) {
          try {
            const args = JSON.parse(tc.arguments);
            const result = await callMCPTool(
              userId,
              tc.serverId,
              tc.toolName,
              args,
              auth0Token
            );

            if (result.requiresAuth) {
              callbacks.onAuthRequired(
                result.requiresAuth.provider,
                result.requiresAuth.reason
              );
              return;
            }

            toolResults.push({
              role: "tool",
              tool_call_id: id,
              name: `${tc.serverId}__${tc.toolName}`,
              content: result.success
                ? result.data || ""
                : `Error: ${result.error}`,
            });
          } catch (error) {
            toolResults.push({
              role: "tool",
              tool_call_id: id,
              name: `${tc.serverId}__${tc.toolName}`,
              content: `Error: ${error}`,
            });
          }
        }

        // Continue conversation with tool results
        const continuedMessages = [
          ...chatHistory,
          {
            role: "assistant" as const,
            content: null,
            tool_calls: Array.from(toolCallsInProgress.entries()).map(
              ([id, tc]) => ({
                id,
                type: "function" as const,
                function: {
                  name: `${tc.serverId}__${tc.toolName}`,
                  arguments: tc.arguments,
                },
              })
            ),
          },
          ...toolResults,
        ];

        // Get final response
        const finalStream = await openai.chat.completions.create({
          model: MODEL,
          messages: continuedMessages as OpenAI.ChatCompletionMessageParam[],
          stream: true,
        });

        for await (const finalChunk of finalStream) {
          if (finalChunk.choices[0]?.delta?.content) {
            fullResponse += finalChunk.choices[0].delta.content;
            callbacks.onToken(finalChunk.choices[0].delta.content);
          }
        }
      }
    }

    // Save assistant response to DB
    if (fullResponse) {
      await db.insert(schema.messages).values({
        conversationId,
        role: "assistant",
        content: fullResponse,
        metadata: {
          toolsUsed: toolCallsInProgress.size > 0,
        },
      });

      // Update conversation timestamp
      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));
    }

    callbacks.onComplete(fullResponse);
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

/**
 * Generate embeddings for RAG
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}
