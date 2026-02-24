@echo off
REM Script de inicio rápido para registrar API local en el gateway
REM Configurar las variables y ejecutar

echo ==========================================
echo  Registro Automático de API en Gateway
echo ==========================================
echo.

REM ===== CONFIGURACIÓN - EDITAR AQUÍ =====
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=tu-api-key-secreta
set ENCRYPTION_KEY=clave-de-32-caracteres-minimo-para-seguridad

set BACKEND_NAME=mi-pc
set BACKEND_PORT=3000
set BACKEND_TOKEN=token-secreto-de-mi-api
set BACKEND_PREFIX=/mipc
REM ========================================

echo Configuración:
echo   Nombre: %BACKEND_NAME%
echo   Puerto: %BACKEND_PORT%
echo   Prefix: %BACKEND_PREFIX%
echo   Storage: %STORAGE_URL%
echo.
echo Iniciando registro con daemon (IP pública automática)...
echo El registro se actualizará cada 5 minutos.
echo.
echo Presiona Ctrl+C para detener.
echo ==========================================
echo.
echo Detectando IP publica automaticamente...
echo.

deno run -A scripts/register-backend.ts --name=%BACKEND_NAME% --use-public-ip --backend-port=%BACKEND_PORT% --backend-token=%BACKEND_TOKEN% --prefix=%BACKEND_PREFIX% --registry-url=%STORAGE_URL% --api-key=%API_KEY% --encryption-key=%ENCRYPTION_KEY% --daemon
