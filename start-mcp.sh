#!/bin/bash

# Script para iniciar el MCP server con todos los parámetros
export EMBEDDING_PROVIDER="ollama"
export OLLAMA_HOST="http://localhost:11434"
export OLLAMA_MODEL="nomic-embed-text"
export CHROMA_HOST="localhost"
export CHROMA_PORT="8000"
export COLLECTION_NAME="company_codebase_384d-new"
export COMPANY_NAME="MyCompany"

echo "🚀 Starting Enterprise Code Search MCP Server..."
echo "📊 Embedding Provider: $EMBEDDING_PROVIDER"
echo "🤖 Ollama Host: $OLLAMA_HOST"
echo "🗄️  ChromaDB: $CHROMA_HOST:$CHROMA_PORT"
echo "📚 Collection: $COLLECTION_NAME"



echo "✅ Servicios verificados. Iniciando MCP server..."

# Iniciar el servidor MCP
node dist/index.js