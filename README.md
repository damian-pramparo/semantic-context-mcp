# Enterprise Code Search MCP Server

A powerful **Model Context Protocol (MCP)** server for semantic code search with shared vector database. Supports both OpenAI and Ollama for embeddings, and can index local projects or Git repositories.

## 🚀 Features

- **Semantic code search** using AI embeddings
- **Dual provider support**: OpenAI or Ollama (local, private)
- **Flexible indexing**: Local projects or Git repositories  
- **Shared vector database** with ChromaDB
- **Multi-project management**: Handle multiple projects simultaneously
- **Automatic project structure analysis**
- **Similar code search** based on code snippets
- **Enterprise-ready**: Private, secure, self-hosted

## 📋 Requirements

- Node.js 18+
- Docker and Docker Compose
- Git (for repository indexing)

## 🛠️ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/semantic-context-mcp.git
cd semantic-context-mcp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start services

```bash
# Start ChromaDB and Ollama
docker-compose up -d

# Wait for Ollama to download models
docker-compose logs -f ollama-setup
```

### 5. Build and run

```bash
npm run build
npm start
```

## ⚙️ Configuration

### Using Ollama (Recommended for Enterprise)

```bash
# .env
EMBEDDING_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Using OpenAI

```bash
# .env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=text-embedding-3-small
```

## 🔧 Claude Desktop Integration

To use this MCP server with Claude Desktop, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enterprise-code-search": {
      "command": "node",
      "args": ["/path/to/semantic-context-mcp/dist/index.js"],
      "env": {
        "EMBEDDING_PROVIDER": "ollama",
        "OLLAMA_HOST": "http://localhost:11434",
        "OLLAMA_MODEL": "nomic-embed-text",
        "CHROMA_HOST": "localhost",
        "CHROMA_PORT": "8000",
        "COMPANY_NAME": "YourCompany"
      }
    }
  }
}
```

## 🎯 Usage Examples

### 1. Index a local project

```
Index my local project at /home/user/my-app with the name "frontend-app"
```

### 2. Search in code

```
Search for "main application function" in all indexed projects
```

### 3. Find similar code

```
Find code similar to:
```python
def authenticate_user(username, password):
    return check_credentials(username, password)
```

### 4. Analyze project structure

```
Analyze the structure of project "frontend-app"
```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `index_local_project` | Index a local directory |
| `search_codebase` | Semantic search in code |
| `list_indexed_projects` | List all indexed projects |
| `get_embedding_provider_info` | Get embedding provider information |

## 📊 Example Queries

### Functional searches
- "Where is the authentication logic?"
- "Functions that handle database operations"
- "Environment variable configuration"
- "Unit tests for the API"

### Code analysis
- "What design patterns are used?"
- "Most complex functions in the project"
- "Error handling in the code"

### Technology-specific search
- "Code using React hooks"
- "PostgreSQL queries"
- "Docker configuration"

## 🔧 Advanced Configuration

### Recommended Ollama Models

```bash
# For code embeddings
ollama pull nomic-embed-text    # Best for code (384 dims)
ollama pull all-minilm         # Lightweight alternative (384 dims)
ollama pull mxbai-embed-large  # Higher precision (1024 dims)
```

### File Patterns

The server supports extensive file type recognition including:

- **Programming Languages**: Python, JavaScript/TypeScript, Java, C/C++, Go, Rust, PHP, Ruby, Swift, Kotlin, Scala, and more
- **Web Technologies**: HTML, CSS, SCSS, Vue, Svelte
- **Configuration**: JSON, YAML, TOML, Docker, Terraform
- **Documentation**: Markdown, reStructuredText, AsciiDoc
- **Database**: SQL files

### Performance Tuning

```bash
# Maximum chunk size (characters)
MAX_CHUNK_SIZE=1500

# Maximum file size (KB)
MAX_FILE_SIZE=500

# Batch size for indexing
BATCH_SIZE=100
```

## 🏢 Enterprise Deployment

### Option 1: Dedicated Server

```bash
# On enterprise server
docker-compose up -d
```

### Option 2: Network Deployment

```bash
# Configure for network access
CHROMA_HOST=192.168.1.100
OLLAMA_HOST=http://192.168.1.100:11434
```

## 🔒 Security Considerations

### Key Benefits

1. **Private Data**: Ollama keeps everything local
2. **No External APIs**: When using Ollama, no data leaves your network
3. **Self-hosted**: Full control over your code and embeddings
4. **Isolated Environment**: Docker containers provide isolation

### Security Best Practices

```bash
# Restrict ChromaDB access
CHROMA_SERVER_HOST=127.0.0.1  # Localhost only

# Use HTTPS for production
OLLAMA_HOST=https://ollama.company.com
```

## 📈 Monitoring & Troubleshooting

### Useful Logs

```bash
# View indexing logs
docker-compose logs -f enterprise-mcp-server

# ChromaDB performance
docker-compose logs -f chromadb

# Monitor Ollama
curl http://localhost:11434/api/tags
```

### Common Issues

**Ollama not responding:**
```bash
curl http://localhost:11434/api/tags
# If it fails: docker-compose restart ollama
```

**ChromaDB slow:**
```bash
# Check disk space
docker system df
# Clean if necessary
docker system prune
```

**Poor embedding quality:**
- Try different model: `all-minilm` vs `nomic-embed-text`
- Adjust chunk size
- Verify source file quality

## 🤝 Collaborative Workflow

### Typical Enterprise Workflow

1. **DevOps indexes** main projects
2. **Developers search** code using Claude
3. **Automatic updates** via CI/CD
4. **Code analysis** for code reviews

### Best Practices

- Index after important merges
- Use descriptive project names
- Maintain project-specific search filters
- Document naming conventions

## 🛠️ Development

### Project Structure

```
src/
├── index.ts          # Main MCP server
└── http-server.ts    # HTTP server variant

scripts/              # Setup and utility scripts
docker-compose.yml    # Service orchestration
package.json         # Dependencies and scripts
```

### Available Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Development mode
npm run start        # Production mode
npm run clean        # Clean build directory
```

## 📚 API Reference

The MCP server implements the standard Model Context Protocol with these specific tools:

- **index_local_project**: Index local directories with configurable file patterns
- **search_codebase**: Semantic search with project filtering and similarity scoring
- **list_indexed_projects**: Enumerate all indexed projects with metadata
- **get_embedding_provider_info**: Get current provider status and configuration

Each tool includes detailed JSON schema with examples and validation.

## 🤖 Recommended AI Models

### For embeddings (Ollama)
- `nomic-embed-text`: Optimized for code
- `all-minilm`: Balanced, fast
- `mxbai-embed-large`: High precision

### For embeddings (OpenAI)
- `text-embedding-3-small`: Cost-effective
- `text-embedding-3-large`: Higher precision

## 🐳 Docker Support

The project includes a complete Docker setup:

- **ChromaDB**: Vector database for embeddings
- **Ollama**: Local embedding generation
- **PostgreSQL**: Optional metadata storage

All services are orchestrated with Docker Compose for easy deployment.

## ☕ Support

If this project helps you with your development workflow, consider supporting it:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/dpramparo)

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support & Issues

- 📧 **Issues**: [GitHub Issues](https://github.com/your-username/semantic-context-mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/semantic-context-mcp/discussions)
- ☕ **Support**: [Buy Me a Coffee](https://buymeacoffee.com/dpramparo)