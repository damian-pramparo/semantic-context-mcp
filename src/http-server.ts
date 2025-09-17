#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IncludeEnum } from 'chromadb';
import express from 'express';
import cors from 'cors';
import { CodeSearchEngine, getConfig, Config } from './shared/CodeSearchEngine.js';

interface HTTPConfig extends Config {
  server_port: number;
}

const getHTTPConfig = (): HTTPConfig => ({
  ...getConfig(),
  server_port: parseInt(process.env.SERVER_PORT || '3001')
});

class EnterpriseCodeSearchMCPHTTP extends CodeSearchEngine {
  private server: Server;
  private app: express.Application;
  private httpConfig: HTTPConfig;

  constructor() {
    const httpConfig = getHTTPConfig();
    super(httpConfig);
    this.httpConfig = httpConfig;
    
    this.server = new Server(
      {
        name: "enterprise-code-search",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.app = express();
    
    // CORS configuration
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    this.setupToolHandlers();
    this.setupHTTPRoutes();
  }

  private setupHTTPRoutes() {
    // Parse JSON bodies FIRST
    this.app.use(express.json());

    // Additional CORS handling for preflight requests
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'enterprise-code-search-mcp',
        version: '1.0.0',
        embedding_provider: this.config.embedding_provider,
        chroma_host: `${this.config.chroma_host}:${this.config.chroma_port}`
      });
    });

    // MCP base endpoint - for protocol discovery
    this.app.all('/', (req, res) => {
      res.json({
        name: 'enterprise-code-search',
        version: '1.0.0',
        protocol: 'mcp',
        capabilities: ['tools'],
        endpoints: {
          'tools/list': 'POST - List available tools',
          'tools/call': 'POST - Call a specific tool',
          'health': 'GET - Health check'
        }
      });
    });

    // MCP HTTP Protocol Endpoints
    
    // List available tools
    this.app.post('/tools/list', async (req, res) => {
      console.log('Received POST to /tools/list');
      try {
        const tools = this.getToolDefinitions();
        return res.json({ tools });
      } catch (error) {
        console.error('Error listing tools:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Call a specific tool (supports both MCP format and backward compatibility)
    this.app.post('/tools/call', async (req, res) => {
      console.log('Received POST to /tools/call:', req.body);
      try {
        // Support both MCP format {name, arguments} and legacy format {tool, arguments}
        const toolName = req.body.name || req.body.tool;
        const args = req.body.arguments || {};
        
        if (!toolName) {
          return res.status(400).json({ error: 'Tool name is required (use "name" or "tool" field)' });
        }

        const result = await this.callTool(toolName, args);
        return res.json(result);
      } catch (error) {
        console.error('Error calling tool:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // MCP SSE endpoint (accept both GET and POST)
    this.app.all('/sse', (req, res) => {
      const transport = new SSEServerTransport("/sse", res);
      this.server.connect(transport).catch(console.error);
    });
  }

  private getToolDefinitions() {
    return [
      {
        name: "search_code",
        description: "Search for code using semantic similarity",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant code",
            },
            n_results: {
              type: "number",
              description: "Number of results to return (default: 10)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_by_file_type",
        description: "Search for code by file type/extension",
        inputSchema: {
          type: "object",
          properties: {
            file_type: {
              type: "string",
              description: "File extension to search for (e.g., .js, .py, .php)",
            },
            query: {
              type: "string",
              description: "Optional text query to search within files of this type",
            },
            n_results: {
              type: "number",
              description: "Number of results to return (default: 10)",
              default: 10,
            },
          },
          required: ["file_type"],
        },
      },
      {
        name: "get_file_content",
        description: "Retrieve the full content of a specific file",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file to retrieve",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "list_indexed_projects",
        description: "List all indexed projects in the knowledge base",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "index_local_project",
        description: "Index a local project directory into the vector database",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Absolute path to the local project directory"
            },
            project_name: {
              type: "string",
              description: "Name for the project (used as identifier)"
            },
            include_patterns: {
              type: "array",
              items: { type: "string" },
              description: "File patterns to include (optional)"
            },
            exclude_patterns: {
              type: "array",
              items: { type: "string" },
              description: "File patterns to exclude (optional)"
            }
          },
          required: ["project_path", "project_name"]
        }
      },
      {
        name: "get_embedding_provider_info",
        description: "Get information about the current embedding provider",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case "search_code":
          return await this.searchCode(args);
        case "search_by_file_type":
          return await this.searchByFileType(args);
        case "get_file_content":
          return await this.getFileContent(args);
        case "list_indexed_projects":
          return await this.listIndexedProjects();
        case "index_local_project":
          return await this.indexLocalProject(args);
        case "get_embedding_provider_info":
          return await this.getEmbeddingProviderInfo();
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.callTool(name, args);
    });
  }

  // HTTP-specific methods that extend the base functionality
  private async searchCode(args: {
    query: string;
    n_results?: number;
  }) {
    const { query, n_results = 10 } = args;
    return await this.searchCodebase({ query, limit: n_results });
  }

  private async searchByFileType(args: {
    file_type: string;
    query?: string;
    n_results?: number;
  }) {
    const { file_type, query, n_results = 10 } = args;
    
    const collection = await this.getOrCreateCollection();
    
    let whereClause: any = {
      file_type: { "$eq": file_type }
    };
    
    let searchQuery = query || file_type;
    
    const results = await collection.query({
      queryTexts: [searchQuery],
      nResults: n_results,
      where: whereClause
    });
    
    if (!results.documents[0] || results.documents[0].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No results found for file type: ${file_type}`
          }
        ]
      };
    }
    
    const formattedResults = results.documents[0]
      .map((doc, i) => {
        const metadata = results.metadatas?.[0]?.[i] as any;
        const distance = results.distances?.[0]?.[i] || 0;
        const similarity = (1 - distance).toFixed(3);
        
        return `## Result ${i + 1} (Similarity: ${similarity})\n` +
               `**File:** ${metadata?.file_path}\n` +
               `**Project:** ${metadata?.project_name}\n` +
               `**Type:** ${metadata?.file_type}\n\n` +
               `\`\`\`${metadata?.file_type}\n${doc}\n\`\`\`\n`;
      })
      .join('\n---\n\n');
    
    return {
      content: [
        {
          type: "text",
          text: `Found ${results.documents[0].length} results for file type "${file_type}":\n\n${formattedResults}`
        }
      ]
    };
  }

  private async getFileContent(args: {
    file_path: string;
  }) {
    const { file_path } = args;
    
    const collection = await this.getOrCreateCollection();
    
    const whereClause = {
      file_path: { "$eq": file_path }
    };
    
    const results = await collection.get({
      where: whereClause,
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas]
    });
    
    if (!results.documents || results.documents.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `File not found: ${file_path}`
          }
        ]
      };
    }
    
    // Sort chunks by chunk_index to get them in order
    const chunks = results.documents.map((doc, i) => ({
      content: doc,
      metadata: results.metadatas?.[i] as any
    })).sort((a, b) => (a.metadata?.chunk_index || 0) - (b.metadata?.chunk_index || 0));
    
    const fullContent = chunks.map(chunk => chunk.content).join('\n');
    const metadata = chunks[0]?.metadata;
    
    return {
      content: [
        {
          type: "text",
          text: `# File: ${file_path}\n` +
                `**Project:** ${metadata?.project_name}\n` +
                `**Type:** ${metadata?.file_type}\n` +
                `**Chunks:** ${chunks.length}\n\n` +
                `\`\`\`${metadata?.file_type}\n${fullContent}\n\`\`\`\n`
        }
      ]
    };
  }

  async run() {
    this.app.listen(this.httpConfig.server_port, () => {
      console.log(`🚀 Enterprise Code Search MCP HTTP server running on http://localhost:${this.httpConfig.server_port}`);
      console.log(`📊 Health check: http://localhost:${this.httpConfig.server_port}/health`);
      console.log(`🔗 MCP SSE endpoint: http://localhost:${this.httpConfig.server_port}/sse`);
      console.log(`🧠 Embedding provider: ${this.config.embedding_provider}`);
      console.log(`🗄️  ChromaDB: ${this.config.chroma_host}:${this.config.chroma_port}`);
    });
  }
}

// Run the HTTP server
const server = new EnterpriseCodeSearchMCPHTTP();
server.run().catch(console.error);