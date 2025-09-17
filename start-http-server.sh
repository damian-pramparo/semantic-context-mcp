#!/bin/bash

# Script para iniciar el servidor HTTP con todos los parámetros
export EMBEDDING_PROVIDER="ollama"
export OLLAMA_HOST="http://localhost:11434"
export OLLAMA_MODEL="nomic-embed-text"
export CHROMA_HOST="localhost"
export CHROMA_PORT="8000"
export COLLECTION_NAME="company_codebase_384d-new"
export COMPANY_NAME="MyCompany"
export SERVER_PORT="3001"

echo "🌐 Starting Enterprise Code Search HTTP Server..."
echo "📊 Embedding Provider: $EMBEDDING_PROVIDER"
echo "🤖 Ollama Host: $OLLAMA_HOST"
echo "🗄️  ChromaDB: $CHROMA_HOST:$CHROMA_PORT"
echo "📚 Collection: $COLLECTION_NAME"
echo "🚀 Server Port: $SERVER_PORT"

# Verificar que ChromaDB esté ejecutándose
if ! curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "❌ ChromaDB no está ejecutándose. Iniciando Docker..."
    docker-compose up -d chromadb
    sleep 5
fi

# Verificar que Ollama esté ejecutándose
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "❌ Ollama no está ejecutándose. Iniciando Docker..."
    docker-compose up -d ollama
    sleep 5
fi

echo "✅ Servicios verificados. Iniciando HTTP server..."
echo "🔗 Health check: http://localhost:$SERVER_PORT/health"
echo "📡 MCP SSE endpoint: http://localhost:$SERVER_PORT/sse"

# Iniciar el servidor HTTP
node dist/http-server.js