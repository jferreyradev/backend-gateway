@echo off
REM Ejemplo de registro con daemon para PC remota
REM Compatible con Windows CMD
REM
REM Uso:
REM   1. Copia este archivo: copy register-daemon.example.bat register-daemon.bat
REM   2. Edita las variables de configuracion
REM   3. Ejecuta: register-daemon.bat

REM ============================================================================
REM CONFIGURACION - EDITAR AQUI
REM ============================================================================

set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=tu-api-key
set ENCRYPTION_KEY=clave-de-32-caracteres-minimo

set BACKEND_NAME=mi-pc
set BACKEND_PORT=3000
set BACKEND_TOKEN=token-secreto-de-mi-api
set BACKEND_PREFIX=/mipc

REM ============================================================================
REM EJECUCION
REM ============================================================================

echo ==========================================
echo  Registro Automatico de API en Gateway
echo ==========================================
echo.
echo Configuracion:
echo   Nombre: %BACKEND_NAME%
echo   Puerto: %BACKEND_PORT%
echo   Prefix: %BACKEND_PREFIX%
echo   Storage: %STORAGE_URL%
echo.
echo Iniciando registro con daemon (IP publica automatica)...
echo El registro se actualizara cada 5 minutos.
echo.
echo Presiona Ctrl+C para detener.
echo ==========================================
echo.

deno run -A scripts/register-backend-standalone.ts --name=%BACKEND_NAME% --use-public-ip --backend-port=%BACKEND_PORT% --backend-token=%BACKEND_TOKEN% --prefix=%BACKEND_PREFIX% --daemon
