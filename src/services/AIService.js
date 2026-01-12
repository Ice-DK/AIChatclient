/**
 * AI Service
 * Håndterer kommunikation med Azure AI Foundry og MCP tool execution
 */

import mcpClient from './MCPClient';

class AIService {
  constructor() {
    this.endpoint = process.env.REACT_APP_AZURE_FOUNDRY_ENDPOINT;
    this.apiKey = process.env.REACT_APP_AZURE_FOUNDRY_API_KEY;
    this.deployment = process.env.REACT_APP_AZURE_FOUNDRY_DEPLOYMENT || 'gpt-4o';
    this.systemPrompt = `Du er en hjælpsom AI assistent der svarer på dansk. Du er venlig, professionel og giver klare og præcise svar.

Når du har adgang til tools, brug dem aktivt til at hjælpe brugeren. Forklar hvad du gør, når du bruger et tool.`;
  }

  /**
   * Send besked til AI med MCP tool support
   */
  async sendMessage(message, conversationHistory = [], options = {}) {
    const messages = this.buildMessages(message, conversationHistory);
    const tools = mcpClient.isConnected ? mcpClient.getToolsAsOpenAIFunctions() : [];

    let response = await this.callAzureAI(messages, tools);
    
    // Håndter tool calls hvis AI ønsker at bruge tools
    let iterations = 0;
    const maxIterations = 10; // Begræns antal tool calls for at undgå infinite loops

    while (response.choices[0].finish_reason === 'tool_calls' && iterations < maxIterations) {
      const toolCalls = response.choices[0].message.tool_calls;
      
      // Tilføj assistant message med tool calls
      messages.push(response.choices[0].message);

      // Udfør hver tool call
      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }

      // Kald AI igen med tool results
      response = await this.callAzureAI(messages, tools);
      iterations++;
    }

    return {
      content: response.choices[0].message.content,
      toolsUsed: iterations > 0,
      usage: response.usage,
    };
  }

  /**
   * Byg messages array til AI
   */
  buildMessages(currentMessage, conversationHistory) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
    ];

    // Tilføj conversation history (begrænset til sidste 20 beskeder)
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Tilføj nuværende besked
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  /**
   * Generer system prompt med tool information
   */
  getSystemPrompt() {
    let prompt = this.systemPrompt;

    if (mcpClient.isConnected) {
      const tools = mcpClient.getAllTools();
      const resources = mcpClient.getAllResources();

      if (tools.length > 0) {
        prompt += `\n\nDu har adgang til følgende tools:\n`;
        for (const tool of tools) {
          prompt += `- ${tool.name}: ${tool.description || 'Ingen beskrivelse'}\n`;
        }
      }

      if (resources.length > 0) {
        prompt += `\n\nDu har adgang til følgende ressourcer:\n`;
        for (const resource of resources) {
          prompt += `- ${resource.name || resource.uri}: ${resource.description || ''}\n`;
        }
      }
    }

    return prompt;
  }

  /**
   * Kald Azure AI Foundry API
   */
  async callAzureAI(messages, tools = []) {
    const requestBody = {
      messages,
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    // Tilføj tools hvis der er nogen
    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(
      `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=2024-06-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Azure AI Foundry error:', errorData);
      throw new Error(errorData.error?.message || 'AI API request failed');
    }

    return response.json();
  }

  /**
   * Udfør et tool call via MCP
   */
  async executeTool(toolCall) {
    try {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      // Parse server og tool name fra function name (format: serverName_toolName)
      const [serverName, ...toolNameParts] = functionName.split('_');
      const toolName = toolNameParts.join('_');

      // Find den rigtige server
      const tool = mcpClient.tools.get(`${serverName}:${toolName}`);
      if (!tool) {
        // Prøv at finde tool direkte
        for (const [key, t] of mcpClient.tools) {
          if (key.endsWith(`:${functionName}`) || t.name === functionName) {
            return await mcpClient.callTool(t.serverName, t.name, args);
          }
        }
        return { error: `Tool not found: ${functionName}` };
      }

      return await mcpClient.callTool(tool.serverName, tool.name, args);
    } catch (error) {
      console.error('Tool execution error:', error);
      return { error: error.message };
    }
  }

  /**
   * Opdater konfiguration
   */
  updateConfig(config) {
    if (config.endpoint) this.endpoint = config.endpoint;
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.deployment) this.deployment = config.deployment;
    if (config.systemPrompt) this.systemPrompt = config.systemPrompt;
  }
}

// Singleton instance
const aiService = new AIService();

export default aiService;
