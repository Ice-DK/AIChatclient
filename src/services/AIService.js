/**
 * AI Service
 * Håndterer kommunikation med Azure AI Foundry (OpenAI og Anthropic) og MCP tool execution
 */

import mcpClient from './MCPClient';

class AIService {
  constructor() {
    this.endpoint = process.env.REACT_APP_AZURE_FOUNDRY_ENDPOINT;
    this.apiKey = process.env.REACT_APP_AZURE_FOUNDRY_API_KEY;
    this.deployment = process.env.REACT_APP_AZURE_FOUNDRY_DEPLOYMENT || 'gpt-4o';
    this.provider = process.env.REACT_APP_AI_PROVIDER || 'openai'; // 'openai' eller 'anthropic'
    this.apiVersion = process.env.REACT_APP_AZURE_API_VERSION || '2024-06-01';
    this.systemPrompt = `Du er en hjælpsom AI assistent der svarer på dansk. Du er venlig, professionel og giver klare og præcise svar.

Når du har adgang til tools, brug dem aktivt til at hjælpe brugeren. Forklar hvad du gør, når du bruger et tool.`;
  }

  /**
   * Detect provider baseret på endpoint eller eksplicit konfiguration
   */
  detectProvider() {
    if (this.provider === 'anthropic' || this.endpoint?.includes('/anthropic')) {
      return 'anthropic';
    }
    return 'openai';
  }

  /**
   * Send besked til AI med MCP tool support
   */
  async sendMessage(message, conversationHistory = [], options = {}) {
    const provider = this.detectProvider();
    
    if (provider === 'anthropic') {
      return this.sendMessageAnthropic(message, conversationHistory, options);
    }
    return this.sendMessageOpenAI(message, conversationHistory, options);
  }

  /**
   * Send besked via OpenAI API format
   */
  async sendMessageOpenAI(message, conversationHistory = [], options = {}) {
    const messages = this.buildMessagesOpenAI(message, conversationHistory);
    const tools = mcpClient.isConnected ? mcpClient.getToolsAsOpenAIFunctions() : [];

    let response = await this.callAzureOpenAI(messages, tools);
    
    // Håndter tool calls hvis AI ønsker at bruge tools
    let iterations = 0;
    const maxIterations = 10;

    while (response.choices[0].finish_reason === 'tool_calls' && iterations < maxIterations) {
      const toolCalls = response.choices[0].message.tool_calls;
      messages.push(response.choices[0].message);

      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }

      response = await this.callAzureOpenAI(messages, tools);
      iterations++;
    }

    return {
      content: response.choices[0].message.content,
      toolsUsed: iterations > 0,
      usage: response.usage,
    };
  }

  /**
   * Send besked via Anthropic API format (Claude)
   */
  async sendMessageAnthropic(message, conversationHistory = [], options = {}) {
    const { systemPrompt, messages } = this.buildMessagesAnthropic(message, conversationHistory);
    const tools = mcpClient.isConnected ? mcpClient.getToolsAsAnthropicFormat() : [];

    let response = await this.callAzureAnthropic(systemPrompt, messages, tools);
    
    // Håndter tool use hvis Claude ønsker at bruge tools
    let iterations = 0;
    const maxIterations = 10;
    let currentMessages = [...messages];

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      // Tilføj assistant response med tool use
      currentMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Find og udfør tool calls
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        const result = await this.executeToolAnthropic(toolUse);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }

      // Tilføj tool results
      currentMessages.push({
        role: 'user',
        content: toolResults,
      });

      response = await this.callAzureAnthropic(systemPrompt, currentMessages, tools);
      iterations++;
    }

    // Ekstraher tekst content fra response
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content: textContent,
      toolsUsed: iterations > 0,
      usage: response.usage,
    };
  }

  /**
   * Byg messages array til OpenAI format
   */
  buildMessagesOpenAI(currentMessage, conversationHistory) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
    ];

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }

  /**
   * Byg messages array til Anthropic format (system prompt er separat)
   */
  buildMessagesAnthropic(currentMessage, conversationHistory) {
    const messages = [];

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: currentMessage });

    return {
      systemPrompt: this.getSystemPrompt(),
      messages,
    };
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
   * Kald Azure OpenAI API
   * Understøtter både det nye /openai/v1/ format og det gamle /openai/deployments/ format
   */
  async callAzureOpenAI(messages, tools = []) {
    const requestBody = {
      model: this.deployment,
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    // Bestem URL baseret på endpoint format
    let url;
    if (this.endpoint.includes('/openai/v1')) {
      // Nyt format: https://<resource>.openai.azure.com/openai/v1/chat/completions
      url = `${this.endpoint.replace(/\/$/, '')}/chat/completions`;
    } else {
      // Gammelt format: https://<resource>.openai.azure.com/openai/deployments/<model>/chat/completions
      url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    }

    console.log('Calling Azure OpenAI:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Azure OpenAI error:', errorData);
      throw new Error(errorData.error?.message || 'AI API request failed');
    }

    return response.json();
  }

  /**
   * Kald Azure Anthropic API (Claude via Foundry)
   * Bruger Anthropic's native API format via Azure Foundry endpoint
   * Se: https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/how-to/use-foundry-models-claude
   */
  async callAzureAnthropic(systemPrompt, messages, tools = []) {
    const requestBody = {
      model: this.deployment,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages,
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    // Azure Foundry Anthropic endpoint - brug format fra dokumentation
    // URL format: https://<resource>.services.ai.azure.com/anthropic/v1/messages
    const url = `${this.endpoint}/v1/messages`;
    console.log('Calling Azure Anthropic:', url);

    // Prøv med både api-key og Authorization Bearer headers
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Azure Anthropic error:', errorData);
      console.error('Response status:', response.status);
      throw new Error(errorData.error?.message || errorData.error?.details || 'AI API request failed');
    }

    return response.json();
  }

  /**
   * Udfør et tool call via MCP (OpenAI format)
   */
  async executeTool(toolCall) {
    try {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');
      return await this.executeToolByName(functionName, args);
    } catch (error) {
      console.error('Tool execution error:', error);
      return { error: error.message };
    }
  }

  /**
   * Udfør et tool call via MCP (Anthropic format)
   */
  async executeToolAnthropic(toolUse) {
    try {
      const functionName = toolUse.name;
      const args = toolUse.input || {};
      return await this.executeToolByName(functionName, args);
    } catch (error) {
      console.error('Tool execution error:', error);
      return { error: error.message };
    }
  }

  /**
   * Udfør tool ved navn
   */
  async executeToolByName(functionName, args) {
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
  }

  /**
   * Opdater konfiguration
   */
  updateConfig(config) {
    if (config.endpoint) this.endpoint = config.endpoint;
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.deployment) this.deployment = config.deployment;
    if (config.systemPrompt) this.systemPrompt = config.systemPrompt;
    if (config.provider) this.provider = config.provider;
    if (config.apiVersion) this.apiVersion = config.apiVersion;
  }
}

// Singleton instance
const aiService = new AIService();

export default aiService;
