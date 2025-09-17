#!/bin/bash

# Script para configurar MCP remoto
# Uso: ./configure-remote-mcp.sh <URL_BASE>

if [ -z "$1" ]; then
    echo "❌ Error: Proporciona la URL base del servidor"
    echo "Uso: $0 <URL_BASE>"
    echo "Ejemplo: $0 https://api.tu-dominio.com"
    exit 1
fi

URL_BASE="$1"

echo "🔧 Configurando MCP remoto..."
echo "📡 URL Base: $URL_BASE"

# Remover configuraciones existentes
echo "🧹 Limpiando configuraciones locales..."
claude mcp remove enterprise-code-search -s local 2>/dev/null || true
claude mcp remove api-wrapper -s local 2>/dev/null || true
claude mcp remove remote-code-search -s local 2>/dev/null || true

# Probar conectividad
echo "🧪 Probando conectividad..."
if curl -s "${URL_BASE}/health" > /dev/null; then
    echo "✅ Health check exitoso"
else
    echo "❌ Health check falló"
    exit 1
fi

# Configurar MCP remoto
echo "⚡ Configurando MCP server remoto..."
claude mcp add remote-code-search "${URL_BASE}/sse" -t sse

echo "✅ Configuración completada"
echo "🔍 Verificando conexión..."
claude mcp list