#!/bin/bash
# Ejemplo de registro con daemon para PC remota
# Compatible con Linux, Mac y Windows (Git Bash / WSL)
#
# Uso:
#   1. Copia este archivo: cp register-daemon.example.sh register-daemon.sh
#   2. Edita las variables de configuración
#   3. Ejecuta: bash register-daemon.sh

# ============================================================================
# CONFIGURACIÓN - EDITAR AQUÍ
# ============================================================================

export STORAGE_URL="https://tu-kv-storage.deno.dev"
export API_KEY="tu-api-key"
export ENCRYPTION_KEY="clave-de-32-caracteres-minimo"

BACKEND_NAME="mi-pc"
BACKEND_PORT="3000"
BACKEND_TOKEN="token-secreto-de-mi-api"
BACKEND_PREFIX="/mipc"

# ============================================================================
# EJECUCIÓN
# ============================================================================

echo "=========================================="
echo " Registro Automático de API en Gateway"
echo "=========================================="
echo ""
echo "Configuración:"
echo "  Nombre: $BACKEND_NAME"
echo "  Puerto: $BACKEND_PORT"
echo "  Prefix: $BACKEND_PREFIX"
echo "  Storage: $STORAGE_URL"
echo ""
echo "Iniciando registro con daemon (IP pública automática)..."
echo "El registro se actualizará cada 5 minutos."
echo ""
echo "Presiona Ctrl+C para detener."
echo "=========================================="
echo ""

deno run -A scripts/register-backend-standalone.ts \
  --name="$BACKEND_NAME" \
  --use-public-ip \
  --backend-port="$BACKEND_PORT" \
  --backend-token="$BACKEND_TOKEN" \
  --prefix="$BACKEND_PREFIX" \
  --daemon
