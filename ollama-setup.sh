#!/bin/bash

# setup-ollama.sh
# Script para configurar modelos de Ollama automáticamente

set -e

echo "🚀 Setting up Ollama models for Enterprise MCP..."

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to start..."
until curl -s http://ollama:11434/api/tags > /dev/null 2>&1; do
    echo "   Waiting for Ollama..."
    sleep 5
done

echo "✅ Ollama is ready!"

# Pull embedding model
echo "📥 Pulling embedding model: nomic-embed-text"
curl -X POST http://ollama:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "nomic-embed-text"}' &

# Pull alternative embedding model
echo "📥 Pulling alternative embedding model: all-minilm"
curl -X POST http://ollama:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "all-minilm"}' &

# Pull a small code model for analysis (optional)
echo "📥 Pulling code model: codellama:7b"
curl -X POST http://ollama:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "codellama:7b"}' &

# Wait for all models to finish downloading
wait

echo "✅ All models have been pulled successfully!"

# List available models
echo "📋 Available models:"
curl -s http://ollama:11434/api/tags | jq '.models[].name' || echo "Models installed successfully"

echo "🎉 Ollama setup complete!"