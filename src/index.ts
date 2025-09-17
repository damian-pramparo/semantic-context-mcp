#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CodeSearchEngine, getConfig } from './shared/CodeSearchEngine.js';

class EnterpriseCodeSearchMCP extends CodeSearchEngine {
  private server: Server;

  constructor() {
    super();
    
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

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
            name: "search_codebase",
            description: "Search the indexed codebase using semantic search",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results",
                  default: 10
                },
                project_filter: {
                  type: "string",
                  description: "Filter by specific project name"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "list_indexed_projects",
            description: "List all projects currently indexed",
            inputSchema: {
              type: "object",
              properties: {}
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
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "index_local_project":
            return await this.indexLocalProject(args as any);
          case "search_codebase":
            return await this.searchCodebase(args as any);
          case "list_indexed_projects":
            return await this.listIndexedProjects();
          case "get_embedding_provider_info":
            return await this.getEmbeddingProviderInfo();
          default:
            throw new Error(`Unknown tool: ${name}`);
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
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    const config = getConfig();
    console.error("Enterprise Code Search MCP server running on stdio");
    console.error(`Embedding provider: ${config.embedding_provider}`);
    console.error(`ChromaDB: ${config.chroma_host}:${config.chroma_port}`);
  }
}

// Run the server
const server = new EnterpriseCodeSearchMCP();
server.run().catch(console.error);