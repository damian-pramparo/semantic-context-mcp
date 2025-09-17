import { ChromaClient, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

// Configuration interface
export interface Config {
  embedding_provider: 'openai' | 'ollama';
  openai_api_key?: string;
  openai_model: string;
  ollama_host: string;
  ollama_model: string;
  github_token?: string;
  chroma_host: string;
  chroma_port: number;
  collection_name: string;
  company_name: string;
}

// Default configuration
export const getConfig = (): Config => ({
  embedding_provider: (process.env.EMBEDDING_PROVIDER as 'openai' | 'ollama') || 'ollama',
  openai_api_key: process.env.OPENAI_API_KEY,
  openai_model: process.env.OPENAI_MODEL || 'text-embedding-3-small',
  ollama_host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  ollama_model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
  github_token: process.env.GITHUB_TOKEN,
  chroma_host: process.env.CHROMA_HOST || 'localhost',
  chroma_port: parseInt(process.env.CHROMA_PORT || '8000'),
  collection_name: process.env.COLLECTION_NAME || 'company_codebase_384d-new',
  company_name: process.env.COMPANY_NAME || 'MyCompany'
});

// Custom Ollama Embedding Function
export class OllamaEmbeddingFunction {
  private host: string;
  private model: string;

  constructor(host: string, model: string) {
    this.host = host;
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      try {
        const response = await fetch(`${this.host}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: text
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        embeddings.push(data.embedding);
      } catch (error) {
        console.error(`Error generating embedding for text: ${text.substring(0, 50)}...`, error);
        embeddings.push(new Array(384).fill(0));
      }
    }
    
    return embeddings;
  }
}

// Shared code search engine
export class CodeSearchEngine {
  protected chromaClient: ChromaClient;
  protected openai?: OpenAI;
  protected octokit?: Octokit;
  protected embedder: any;
  protected config: Config;

  constructor(config?: Config) {
    this.config = config || getConfig();

    this.chromaClient = new ChromaClient({
      path: `http://${this.config.chroma_host}:${this.config.chroma_port}`
    });

    if (this.config.embedding_provider === 'openai') {
      if (!this.config.openai_api_key) {
        throw new Error('OpenAI API key required when using OpenAI embeddings');
      }
      this.openai = new OpenAI({ apiKey: this.config.openai_api_key! });
      this.embedder = new OpenAIEmbeddingFunction({
        openai_api_key: this.config.openai_api_key!,
        openai_model: this.config.openai_model
      });
    } else {
      this.embedder = new OllamaEmbeddingFunction(this.config.ollama_host, this.config.ollama_model);
    }

    if (this.config.github_token) {
      this.octokit = new Octokit({ auth: this.config.github_token });
    }
  }

  // Default file patterns
  private getDefaultIncludePatterns(): string[] {
    return [
      "*.php", "*.phtml", "*.php3", "*.php4", "*.php5", "*.php7", "*.php8",
      "*.py", "*.pyw", "*.pyi", "*.pyc", "*.pyo",
      "*.js", "*.jsx", "*.mjs", "*.cjs",
      "*.ts", "*.tsx", "*.mts", "*.cts",
      "*.java", "*.jav", "*.jsp", "*.jspx",
      "*.cpp", "*.cxx", "*.cc", "*.c++", "*.hpp", "*.hxx", "*.h++",
      "*.c", "*.h",
      "*.cs", "*.csx",
      "*.go", "*.gox",
      "*.rs", "*.rlib",
      "*.rb", "*.rbw", "*.rake", "*.gemspec",
      "*.swift", "*.swiftinterface",
      "*.kt", "*.kts",
      "*.scala", "*.sc",
      "*.clj", "*.cljs", "*.cljc", "*.edn",
      "*.hs", "*.lhs",
      "*.ml", "*.mli", "*.fs", "*.fsi", "*.fsx", "*.fsscript",
      "*.erl", "*.hrl", "*.ex", "*.exs",
      "*.lua", "*.luac",
      "*.r", "*.R", "*.Rmd", "*.rmd",
      "*.m", "*.mm", "*.M",
      "*.pl", "*.pm", "*.t", "*.pod",
      "*.sh", "*.bash", "*.zsh", "*.fish", "*.ps1", "*.psm1", "*.psd1",
      "*.sql", "*.psql", "*.mysql", "*.sqlite",
      "*.html", "*.htm", "*.xhtml", "*.xml", "*.svg", "*.vue", "*.svelte",
      "*.css", "*.scss", "*.sass", "*.less", "*.styl",
      "*.md", "*.markdown", "*.mdown", "*.mkdn", "*.mdx",
      "*.txt", "*.text", "*.rtf",
      "*.yml", "*.yaml", "*.json", "*.jsonc", "*.json5",
      "*.toml", "*.ini", "*.cfg", "*.conf", "*.config",
      "*.dockerfile", "*.Dockerfile",
      "*.tf", "*.tfvars",
      "*.proto", "*.thrift", "*.graphql", "*.gql",
      "*.asm", "*.s", "*.S",
      "*.dart", "*.dartx",
      "*.elm",
      "*.nim", "*.nims",
      "*.zig",
      "*.v", "*.vh", "*.sv", "*.svh",
      "*.tex", "*.ltx", "*.sty",
      "*.rst", "*.rest",
      "*.adoc", "*.asciidoc",
      "*.org", "*.org_archive"
    ];
  }

  private getDefaultExcludePatterns(): string[] {
    return [
      "node_modules", "node_modules/**",
      ".git", ".git/**",
      "dist", "dist/**",
      "build", "build/**",
      "out", "out/**",
      "coverage", "coverage/**",
      "__pycache__", "__pycache__/**",
      "venv", "venv/**", ".venv", ".venv/**",
      ".next", ".next/**",
      "target", "target/**",
      ".cache", ".cache/**",
      "*.log", "*.tmp"
    ];
  }

  async indexLocalProject(args: {
    project_path: string;
    project_name: string;
    include_patterns?: string[];
    exclude_patterns?: string[];
  }) {
    const { 
      project_path, 
      project_name, 
      include_patterns = this.getDefaultIncludePatterns(),
      exclude_patterns = this.getDefaultExcludePatterns()
    } = args;
    
    try {
      const stats = await fs.stat(project_path);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${project_path}`);
      }
    } catch (error) {
      throw new Error(`Cannot access project path: ${project_path}`);
    }

    const projectId = this.sanitizeProjectId(project_name);
    
    try {
      const collection = await this.getOrCreateCollection();
      const files = await this.getFilesToIndex(project_path, include_patterns, exclude_patterns);
      const chunks = [];
      
      let processedFiles = 0;
      
      for (const filePath of files) {
        try {
          const relativePath = path.relative(project_path, filePath);
          const fileExtension = path.extname(filePath).slice(1) || 'txt';
          
          const fileStats = await fs.stat(filePath);
          const fileSizeMB = fileStats.size / (1024 * 1024);
          
          console.error(`Processing file: ${relativePath} (${fileSizeMB.toFixed(2)} MB)`);
          
          const fileChunks = await this.processFileWithStreaming(filePath, relativePath, fileExtension);
          
          if (fileChunks.length > 0) {
            chunks.push(...fileChunks.map(chunk => ({
              ...chunk,
              project_id: projectId,
              project_name,
              project_path,
              source_type: 'local',
              indexed_at: new Date().toISOString()
            })));
          }
          
          processedFiles++;
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }
      
      if (chunks.length > 0) {
        await this.storeChunksInBatches(collection, chunks, projectId);
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully indexed local project: ${project_name}\n` +
                  `Project ID: ${projectId}\n` +
                  `Project Path: ${project_path}\n` +
                  `Files processed: ${processedFiles}\n` +
                  `Chunks created: ${chunks.length}\n` +
                  `Embedding provider: ${this.config.embedding_provider}`
          }
        ]
      };
      
    } catch (error) {
      throw error;
    }
  }

  async searchCodebase(args: {
    query: string;
    limit?: number;
    project_filter?: string;
  }) {
    const { query, limit = 10, project_filter } = args;
    
    const collection = await this.getOrCreateCollection();
    
    let whereClause: any = {};
    if (project_filter) {
      whereClause.project_id = { "$eq": project_filter };
    }
    
    const results = await collection.query({
      queryTexts: [query],
      nResults: limit,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined
    });
    
    if (!results.documents[0] || results.documents[0].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No results found for your query."
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
               `**Project:** ${metadata?.project_name}\n\n` +
               `\`\`\`${metadata?.file_type}\n${doc}\n\`\`\`\n`;
      })
      .join('\n---\n\n');
    
    return {
      content: [
        {
          type: "text",
          text: `Found ${results.documents[0].length} results for: "${query}"\n\n${formattedResults}`
        }
      ]
    };
  }

  async listIndexedProjects() {
    const collection = await this.getOrCreateCollection();
    
    const results = await collection.get({
      limit: 100000,
      include: [IncludeEnum.Metadatas]
    });
    
    const metadatas = results.metadatas as any[] | undefined;

    if (!metadatas || metadatas.length === 0) {
      return {
        content: [
          { type: "text", text: "No projects indexed yet." }
        ]
      };
    }
    
    const projects = new Map<string, any>();
    
    metadatas.forEach((metadata: any) => {
      if (!metadata) return;
      const projectId = metadata.project_id;
      if (!projectId) return;
      if (!projects.has(projectId)) {
        projects.set(projectId, {
          project_id: projectId,
          project_name: metadata.project_name,
          project_path: metadata.project_path,
          source_type: metadata.source_type,
          indexed_at: metadata.indexed_at,
          chunk_count: 0
        });
      }
      projects.get(projectId).chunk_count++;
    });
    
    let output = `# Indexed Projects (${projects.size})\n\n`;
    
    Array.from(projects.values()).forEach(project => {
      output += `## ${project.project_name}\n`;
      output += `- **ID:** ${project.project_id}\n`;
      output += `- **Path:** ${project.project_path}\n`;
      output += `- **Source:** ${project.source_type}\n`;
      output += `- **Chunks:** ${project.chunk_count}\n\n`;
    });
    
    return {
      content: [
        { type: "text", text: output }
      ]
    };
  }

  async getEmbeddingProviderInfo() {
    let info = `# Embedding Provider Information\n\n`;
    info += `**Current Provider:** ${this.config.embedding_provider}\n\n`;
    
    if (this.config.embedding_provider === 'openai') {
      info += `## OpenAI Configuration\n`;
      info += `- **Model:** ${this.config.openai_model}\n`;
      info += `- **API Key:** ${this.config.openai_api_key ? 'Configured ✓' : 'Not configured ✗'}\n`;
    } else {
      info += `## Ollama Configuration\n`;
      info += `- **Host:** ${this.config.ollama_host}\n`;
      info += `- **Model:** ${this.config.ollama_model}\n`;
      
      try {
        const response = await fetch(`${this.config.ollama_host}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          const models = data.models?.map((m: any) => m.name) || [];
          info += `- **Connection:** ✓ Connected\n`;
          info += `- **Available Models:** ${models.join(', ') || 'None'}\n`;
        } else {
          info += `- **Connection:** ✗ Failed to connect\n`;
        }
      } catch (error) {
        info += `- **Connection:** ✗ Error connecting\n`;
      }
    }
    
    return {
      content: [
        { type: "text", text: info }
      ]
    };
  }

  protected async getOrCreateCollection() {
    try {
      return await this.chromaClient.getCollection({
        name: this.config.collection_name,
        embeddingFunction: this.embedder
      });
    } catch {
      return await this.chromaClient.createCollection({
        name: this.config.collection_name,
        embeddingFunction: this.embedder
      });
    }
  }

  protected sanitizeProjectId(projectName: string): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private async processFileWithStreaming(
    filePath: string, 
    relativePath: string, 
    fileType: string,
    maxChunkSize: number = 1500
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      let currentChunk = '';
      let chunkIndex = 0;
      let lineCount = 0;
      
      const fileStream = createReadStream(filePath, { encoding: 'utf8' });
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        lineCount++;
        
        if (line.length > 10000) {
          console.error(`Skipping very long line ${lineCount} (${line.length} chars)`);
          return;
        }
        
        if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            file_path: relativePath,
            file_type: fileType,
            chunk_index: chunkIndex++
          });
          currentChunk = line;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + line;
        }
        
        if (chunks.length >= 100) {
          console.error(`Processed ${lineCount} lines, created ${chunks.length} chunks so far...`);
        }
      });
      
      rl.on('close', () => {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            file_path: relativePath,
            file_type: fileType,
            chunk_index: chunkIndex
          });
        }
        
        console.error(`Finished processing ${relativePath}: ${lineCount} lines, ${chunks.length} chunks`);
        resolve(chunks);
      });
      
      rl.on('error', (error) => {
        console.error(`Error reading file ${filePath}:`, error);
        reject(error);
      });
    });
  }

  private async getFilesToIndex(
    dirPath: string, 
    includePatterns: string[], 
    excludePatterns: string[]
  ): Promise<string[]> {
    const allFiles: string[] = [];
    
    const traverse = async (currentPath: string) => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            const shouldExclude = excludePatterns.some(pattern => 
              this.matchesPattern(path.relative(dirPath, fullPath), pattern)
            );
            if (!shouldExclude) {
              await traverse(fullPath);
            }
          } else {
            const relativePath = path.relative(dirPath, fullPath);
            
            const shouldInclude = includePatterns.length === 0 || 
              includePatterns.some(pattern => this.matchesPattern(relativePath, pattern));
            
            const shouldExclude = excludePatterns.some(pattern => 
              this.matchesPattern(relativePath, pattern)
            );
            
            if (shouldInclude && !shouldExclude) {
              allFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };
    
    await traverse(dirPath);
    return allFiles;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern.endsWith('/**')) {
      const base = pattern.slice(0, -3);
      return filePath === base || filePath.startsWith(base + '/');
    }

    if (pattern.startsWith('*.')) {
      const extension = pattern.slice(1);
      return filePath.endsWith(extension);
    }

    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*\\\*/g, '.*')
      .replace(/\\\*/g, '.*')
      .replace(/\\\?/g, '.');

    const regex = new RegExp(`^${escaped}$`);
    return regex.test(filePath);
  }

  private async storeChunksInBatches(collection: any, chunks: any[], projectId: string, batchSize: number = 100) {
    console.error(`Storing ${chunks.length} chunks for project ${projectId}...`);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const ids = batch.map((_, idx) => `${projectId}_chunk_${i + idx}`);
      const documents = batch.map(chunk => chunk.content);
      const metadatas = batch.map(chunk => ({
        file_path: chunk.file_path,
        project_id: chunk.project_id,
        project_name: chunk.project_name,
        project_path: chunk.project_path,
        source_type: chunk.source_type,
        file_type: chunk.file_type,
        chunk_index: chunk.chunk_index,
        indexed_at: chunk.indexed_at
      }));
      
      try {
        await collection.add({
          ids,
          documents,
          metadatas
        });
        console.error(`Stored batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      } catch (error) {
        console.error(`Error storing batch ${Math.floor(i/batchSize) + 1}:`, error);
        throw error;
      }
    }
  }
}