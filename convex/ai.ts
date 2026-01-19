import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Microsoft Learn MCP Server endpoint
const LEARN_MCP_ENDPOINT = "https://learn.microsoft.com/api/mcp";

// CloudFactory MCP Server endpoint
const CLOUDFACTORY_MCP_ENDPOINT = "https://mcp.dev.cfcore.dk/mcp";

// CloudFactory MCP API Key (for server-level auth)
const CLOUDFACTORY_MCP_API_KEY = process.env.CLOUDFACTORY_MCP_API_KEY;

// Playwright MCP Server endpoint (optional - kør lokalt med: npx @playwright/mcp@latest --port 8931)
const PLAYWRIGHT_MCP_ENDPOINT = process.env.PLAYWRIGHT_MCP_ENDPOINT;

// Atlassian MCP Server endpoint (vores egen server)
const ATLASSIAN_MCP_ENDPOINT = process.env.ATLASSIAN_MCP_ENDPOINT || "http://localhost:8080";
const ATLASSIAN_MCP_API_KEY = process.env.ATLASSIAN_MCP_API_KEY;

// Interface for MCP tool
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Definér tilgængelige tools
const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Søg på internettet efter aktuel information. Brug dette til at finde nyheder, fakta, vejr, priser, eller anden information der kræver opdateret viden.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Søgeforespørgslen på engelsk eller dansk",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_webpage_content",
      description: "Hent indholdet fra en specifik webside URL. Brug dette når du har brug for at læse en artikel eller side.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Den fulde URL til websiden",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "microsoft_docs_search",
      description: "Søg i Microsoft Learn dokumentation. Brug dette til at finde information om Microsoft produkter, Azure, .NET, TypeScript, og andre Microsoft teknologier.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Søgeforespørgslen på engelsk (Microsoft docs er primært på engelsk)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "microsoft_docs_fetch",
      description: "Hent en komplet artikel fra Microsoft Learn. Brug dette når du har en specifik dokumentations-URL eller artikel-id.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL til Microsoft Learn artiklen (f.eks. https://learn.microsoft.com/en-us/azure/...)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "microsoft_code_sample_search",
      description: "Søg efter kodeeksempler i Microsoft Learn. Brug dette til at finde eksempelkode for Microsoft teknologier.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Søgeforespørgslen efter kodeeksempler",
          },
          language: {
            type: "string",
            description: "Programmeringssprog (f.eks. csharp, typescript, python)",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Udfør web søgning via Tavily API
async function executeWebSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    return "Web søgning er ikke konfigureret. Mangler TAVILY_API_KEY.";
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    
    let result = "";
    if (data.answer) {
      result += `**Svar:** ${data.answer}\n\n`;
    }
    
    result += "**Kilder:**\n";
    for (const item of data.results || []) {
      result += `- [${item.title}](${item.url}): ${item.content?.substring(0, 200)}...\n`;
    }
    
    return result;
  } catch (error) {
    return `Fejl ved web søgning: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Hent indhold fra en webside
async function executeGetWebpage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIChatBot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();
    
    // Simpel HTML til tekst konvertering
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);
    
    return text;
  } catch (error) {
    return `Fejl ved hentning af webside: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Microsoft Learn MCP Server - hjælpefunktion til at kalde MCP
async function callLearnMCP(toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    // MCP bruger JSON-RPC over HTTP
    const response = await fetch(LEARN_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "MCP error");
    }

    // Formatér resultatet
    const content = data.result?.content;
    if (Array.isArray(content)) {
      return content.map((c: { text?: string }) => c.text || "").join("\n");
    }
    
    return JSON.stringify(data.result, null, 2);
  } catch (error) {
    return `Fejl ved Microsoft Learn søgning: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Microsoft Docs Search
async function executeMicrosoftDocsSearch(query: string): Promise<string> {
  return await callLearnMCP("microsoft_docs_search", { query });
}

// Microsoft Docs Fetch
async function executeMicrosoftDocsFetch(url: string): Promise<string> {
  return await callLearnMCP("microsoft_docs_fetch", { url });
}

// Microsoft Code Sample Search
async function executeMicrosoftCodeSampleSearch(query: string, language?: string): Promise<string> {
  const args: Record<string, unknown> = { query };
  if (language) {
    args.language = language;
  }
  return await callLearnMCP("microsoft_code_sample_search", args);
}

// CloudFactory MCP Server - hent tools
async function getCloudFactoryTools(auth0Token: string): Promise<MCPTool[]> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth0Token}`,
    };
    
    // Tilføj MCP API key hvis konfigureret
    if (CLOUDFACTORY_MCP_API_KEY) {
      headers["X-API-Key"] = CLOUDFACTORY_MCP_API_KEY;
    }

    console.log(`Calling CloudFactory MCP tools/list at ${CLOUDFACTORY_MCP_ENDPOINT}`);
    
    const response = await fetch(CLOUDFACTORY_MCP_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/list",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`CloudFactory MCP tools/list error: ${response.status} - ${errorBody}`);
      return [];
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`CloudFactory MCP error: ${data.error.message}`);
      return [];
    }

    console.log(`CloudFactory MCP returned ${data.result?.tools?.length || 0} tools`);
    return data.result?.tools || [];
  } catch (error) {
    console.error("Failed to fetch CloudFactory MCP tools:", error);
    return [];
  }
}

// CloudFactory MCP Server - kald tool
async function callCloudFactoryMCP(auth0Token: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth0Token}`,
    };
    
    // Tilføj MCP API key hvis konfigureret
    if (CLOUDFACTORY_MCP_API_KEY) {
      headers["X-API-Key"] = CLOUDFACTORY_MCP_API_KEY;
    }

    console.log(`Calling CloudFactory MCP tool: ${toolName}`);
    
    const response = await fetch(CLOUDFACTORY_MCP_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`CloudFactory MCP error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "CloudFactory MCP error");
    }

    // Formatér resultatet
    const content = data.result?.content;
    if (Array.isArray(content)) {
      return content.map((c: { text?: string }) => c.text || JSON.stringify(c)).join("\n");
    }
    
    return JSON.stringify(data.result, null, 2);
  } catch (error) {
    return `Fejl ved CloudFactory MCP kald: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Atlassian MCP Server - hent tools
async function getAtlassianTools(atlassianToken: string, cloudId: string): Promise<MCPTool[]> {
  if (!ATLASSIAN_MCP_ENDPOINT) {
    console.log("Atlassian MCP endpoint not configured");
    return [];
  }

  try {
    console.log(`Calling Atlassian MCP tools/list at ${ATLASSIAN_MCP_ENDPOINT}`);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Atlassian-Token": atlassianToken,
      "X-Atlassian-Cloud-Id": cloudId,
    };
    
    // Tilføj MCP API key hvis konfigureret
    if (ATLASSIAN_MCP_API_KEY) {
      headers["X-API-Key"] = ATLASSIAN_MCP_API_KEY;
    }
    
    const response = await fetch(`${ATLASSIAN_MCP_ENDPOINT}/messages?session_id=tools`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/list",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Atlassian MCP tools/list error: ${response.status} - ${errorBody}`);
      return [];
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`Atlassian MCP error: ${data.error.message}`);
      return [];
    }

    console.log(`Atlassian MCP returned ${data.result?.tools?.length || 0} tools`);
    return data.result?.tools || [];
  } catch (error) {
    console.error("Failed to fetch Atlassian MCP tools:", error);
    return [];
  }
}

// Atlassian MCP Server - kald tool
async function callAtlassianMCP(atlassianToken: string, cloudId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  if (!ATLASSIAN_MCP_ENDPOINT) {
    return "Atlassian MCP server er ikke konfigureret.";
  }

  try {
    console.log(`Calling Atlassian MCP tool: ${toolName}`);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Atlassian-Token": atlassianToken,
      "X-Atlassian-Cloud-Id": cloudId,
    };
    
    if (ATLASSIAN_MCP_API_KEY) {
      headers["X-API-Key"] = ATLASSIAN_MCP_API_KEY;
    }
    
    const response = await fetch(`${ATLASSIAN_MCP_ENDPOINT}/messages?session_id=tool-call`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Atlassian MCP error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "Atlassian MCP error");
    }

    // Formatér resultatet
    const content = data.result?.content;
    if (Array.isArray(content)) {
      return content.map((c: { text?: string }) => c.text || JSON.stringify(c)).join("\n");
    }
    
    return JSON.stringify(data.result, null, 2);
  } catch (error) {
    return `Fejl ved Atlassian MCP kald: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Konverter MCP tools til OpenAI function format
function convertMCPToolsToOpenAI(mcpTools: MCPTool[], prefix: string): Array<{
  type: string;
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}> {
  return mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: `${prefix}_${tool.name}`,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

// Udfør tool kald
async function executeTool(
  name: string, 
  args: Record<string, unknown>, 
  auth0Token?: string, 
  atlassianToken?: string,
  atlassianCloudId?: string
): Promise<string> {
  // Tjek om det er et CloudFactory MCP tool (prefix: cf_)
  if (name.startsWith("cf_") && auth0Token) {
    const actualToolName = name.substring(3); // Fjern "cf_" prefix
    return await callCloudFactoryMCP(auth0Token, actualToolName, args);
  }

  // Tjek om det er et Atlassian MCP tool (prefix: atl_)
  if (name.startsWith("atl_") && atlassianToken && atlassianCloudId) {
    const actualToolName = name.substring(4); // Fjern "atl_" prefix
    return await callAtlassianMCP(atlassianToken, atlassianCloudId, actualToolName, args);
  }

  switch (name) {
    case "web_search":
      return await executeWebSearch(args.query as string);
    case "get_webpage_content":
      return await executeGetWebpage(args.url as string);
    case "microsoft_docs_search":
      return await executeMicrosoftDocsSearch(args.query as string);
    case "microsoft_docs_fetch":
      return await executeMicrosoftDocsFetch(args.url as string);
    case "microsoft_code_sample_search":
      return await executeMicrosoftCodeSampleSearch(args.query as string, args.language as string | undefined);
    default:
      return `Ukendt tool: ${name}`;
  }
}

// Send besked til AI og gem svar
export const chat = action({
  args: {
    conversationId: v.id("conversations"),
    userMessage: v.string(),
    auth0Token: v.optional(v.string()),
    atlassianToken: v.optional(v.string()),
    atlassianCloudId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Hent eksisterende beskeder til kontekst
    const existingMessages = await ctx.runQuery(api.messages.listByConversation, {
      conversationId: args.conversationId,
    });

    // Byg message historik til AI
    const messageHistory = existingMessages
      .filter((m) => !m.isMCPNotification && !m.isError)
      .map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

    // Tilføj brugerens nye besked
    await ctx.runMutation(api.messages.send, {
      conversationId: args.conversationId,
      role: "user",
      content: args.userMessage,
    });

    try {
      // Kald Azure AI Foundry
      const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
      const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
      const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-4o";
      const apiVersion = process.env.AZURE_API_VERSION || "2024-06-01";

      if (!endpoint || !apiKey) {
        throw new Error("Azure AI Foundry credentials not configured");
      }

      // Hent CloudFactory MCP tools hvis vi har auth0 token
      let cloudFactoryTools: MCPTool[] = [];
      let cfToolsDescription = "";
      
      if (args.auth0Token) {
        try {
          console.log(`Auth0 token received, length: ${args.auth0Token.length}`);
          console.log(`Token starts with: ${args.auth0Token.substring(0, 20)}...`);
          cloudFactoryTools = await getCloudFactoryTools(args.auth0Token);
          if (cloudFactoryTools.length > 0) {
            cfToolsDescription = `\n\nDu har også adgang til CloudFactory tools (prefixed med cf_):
${cloudFactoryTools.map(t => `- cf_${t.name}: ${t.description}`).join("\n")}

Brug CloudFactory tools når brugeren spørger om:
- Cloud Factory kunder, partnere, eller produkter
- Microsoft licenser og tenants
- Infrastruktur (VMs, projekter)
- Portal data og aktivitetslog`;
          }
        } catch (err) {
          console.log("Could not fetch CloudFactory MCP tools:", err);
        }
      } else {
        console.log("No auth0Token provided to chat action");
      }

      // Hent Atlassian MCP tools hvis vi har atlassian token og cloud ID
      let atlassianTools: MCPTool[] = [];
      let atlassianToolsDescription = "";
      
      if (args.atlassianToken && args.atlassianCloudId) {
        try {
          console.log(`Atlassian token received, length: ${args.atlassianToken.length}`);
          console.log(`Atlassian cloudId: ${args.atlassianCloudId}`);
          atlassianTools = await getAtlassianTools(args.atlassianToken, args.atlassianCloudId);
          if (atlassianTools.length > 0) {
            atlassianToolsDescription = `\n\nDu har også adgang til Atlassian tools (prefixed med atl_):
${atlassianTools.map(t => `- atl_${t.name}: ${t.description}`).join("\n")}

Brug Atlassian tools når brugeren spørger om:
- Jira issues, projekter, eller epics → searchJiraIssuesUsingJql, getJiraIssue
- Confluence sider eller dokumentation → searchConfluenceUsingCql, getConfluencePage
- Generel søgning på tværs af Jira og Confluence → search
- Oprette eller opdatere issues → createJiraIssue, editJiraIssue
- Oprette eller opdatere Confluence sider → createConfluencePage, updateConfluencePage`;
          }
        } catch (err) {
          console.log("Could not fetch Atlassian MCP tools:", err);
        }
      }

      const systemPrompt = `Du er Chaos.bat - en hjælpsom men let kaotisk AI assistent der svarer på dansk. Du er venlig, har humor, og giver klare svar - nogle gange med et strejf af kaos.

Du har adgang til følgende tools:
- web_search: Søg på internettet efter aktuel information (nyheder, vejr, priser, etc.)
- get_webpage_content: Hent indhold fra en specifik URL
- microsoft_docs_search: Søg i Microsoft Learn dokumentation (Azure, .NET, TypeScript, etc.)
- microsoft_docs_fetch: Hent en komplet artikel fra Microsoft Learn
- microsoft_code_sample_search: Find kodeeksempler fra Microsoft Learn

Brug tools aktivt når brugeren spørger om:
- Aktuel information → web_search
- Microsoft teknologier (Azure, .NET, C#, TypeScript, etc.) → microsoft_docs_search
- Kodeeksempler for Microsoft teknologier → microsoft_code_sample_search
- Specifik webside eller artikel → get_webpage_content eller microsoft_docs_fetch${cfToolsDescription}${atlassianToolsDescription}`;

      const messages: Array<{ role: string; content?: string; tool_calls?: unknown[]; tool_call_id?: string }> = [
        { role: "system", content: systemPrompt },
        ...messageHistory,
        { role: "user", content: args.userMessage },
      ];

      const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

      // Kombiner standard tools med CloudFactory og Atlassian MCP tools
      const allTools = [
        ...tools,
        ...convertMCPToolsToOpenAI(cloudFactoryTools, "cf"),
        ...convertMCPToolsToOpenAI(atlassianTools, "atl"),
      ];

      // Tool calling loop
      let iterations = 0;
      const maxIterations = 5;
      let finalContent = "";
      let toolsUsed = false;

      while (iterations < maxIterations) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            messages,
            model: deployment,
            max_completion_tokens: 16384,
            temperature: 0.7,
            tools: allTools.length > 0 ? allTools : undefined,
            tool_choice: allTools.length > 0 ? "auto" : undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Azure AI error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const choice = data.choices[0];
        const assistantMessage = choice.message;

        // Hvis ingen tool calls, er vi færdige
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          finalContent = assistantMessage.content || "";
          break;
        }

        // Håndter tool calls
        toolsUsed = true;
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Executing tool: ${functionName}`, functionArgs);
          
          const result = await executeTool(functionName, functionArgs, args.auth0Token, args.atlassianToken, args.atlassianCloudId);
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        iterations++;
      }

      // Gem AI svar
      await ctx.runMutation(api.messages.send, {
        conversationId: args.conversationId,
        role: "assistant",
        content: finalContent,
        toolsUsed: toolsUsed,
      });

      return { success: true, content: finalContent };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Gem fejlbesked
      await ctx.runMutation(api.messages.send, {
        conversationId: args.conversationId,
        role: "assistant",
        content: `Beklager, der opstod en fejl: ${errorMessage}. Prøv venligst igen.`,
        isError: true,
      });

      return { success: false, error: errorMessage };
    }
  },
});

// MCP Tool kald action
export const callMCPTool = action({
  args: {
    serverUrl: v.string(),
    toolName: v.string(),
    toolArgs: v.any(),
    auth0Token: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(`${args.serverUrl}/tools/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.auth0Token}`,
      },
      body: JSON.stringify({
        name: args.toolName,
        arguments: args.toolArgs,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP tool call failed: ${response.status}`);
    }

    return await response.json();
  },
});

