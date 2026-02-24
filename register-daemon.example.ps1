# Ejemplo de registro con daemon para PC remota
# Compatible con Windows PowerShell
#
# Uso:
#   1. Copia este archivo: Copy-Item register-daemon.example.ps1 register-daemon.ps1
#   2. Edita las variables de configuración
#   3. Ejecuta: .\register-daemon.ps1

# ============================================================================
# CONFIGURACIÓN - EDITAR AQUÍ
# ============================================================================

$env:STORAGE_URL = "https://tu-kv-storage.deno.dev"
$env:API_KEY = "tu-api-key"
$env:ENCRYPTION_KEY = "clave-de-32-caracteres-minimo"

$BACKEND_NAME = "mi-pc"
$BACKEND_PORT = "3000"
$BACKEND_TOKEN = "token-secreto-de-mi-api"
$BACKEND_PREFIX = "/mipc"

# ============================================================================
# EJECUCIÓN
# ============================================================================

Write-Host "=========================================="
Write-Host " Registro Automático de API en Gateway"
Write-Host "=========================================="
Write-Host ""
Write-Host "Configuración:"
Write-Host "  Nombre: $BACKEND_NAME"
Write-Host "  Puerto: $BACKEND_PORT"
Write-Host "  Prefix: $BACKEND_PREFIX"
Write-Host "  Storage: $env:STORAGE_URL"
Write-Host ""
Write-Host "Iniciando registro con daemon (IP pública automática)..."
Write-Host "El registro se actualizará cada 5 minutos."
Write-Host ""
Write-Host "Presiona Ctrl+C para detener."
Write-Host "=========================================="
Write-Host ""

deno run -A scripts/register-backend-standalone.ts `
  --name=$BACKEND_NAME `
  --use-public-ip `
  --backend-port=$BACKEND_PORT `
  --backend-token=$BACKEND_TOKEN `
  --prefix=$BACKEND_PREFIX `
  --daemon
