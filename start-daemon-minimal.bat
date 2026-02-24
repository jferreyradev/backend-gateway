@echo off
REM Script minimo para registrar API en gateway desde PC remota
REM Solo necesitas este archivo y las credenciales

echo ==========================================
echo  Registro de API en Gateway
echo ==========================================
echo.

REM ===== CONFIGURACIÓN - EDITAR AQUÍ =====
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=tu-api-key-secreta
set ENCRYPTION_KEY=clave-de-32-caracteres-minimo

set BACKEND_NAME=mi-pc
set BACKEND_PORT=3000
set BACKEND_TOKEN=token-secreto-de-mi-api
set BACKEND_PREFIX=/mipc
REM ========================================

echo Configuracion:
echo   Nombre: %BACKEND_NAME%
echo   Puerto: %BACKEND_PORT%
echo   Prefix: %BACKEND_PREFIX%
echo.

REM Descargar script si no existe
if not exist register-backend-standalone.ts (
    echo Descargando script de registro...
    echo.
    echo NOTA: Actualiza la URL si tu proyecto esta en GitHub:
    echo   https://raw.githubusercontent.com/jferreyradev/backend-gateway/main/scripts/register-backend-standalone.ts
    echo.
    echo O descarga manualmente y coloca el archivo aqui.
    echo.
    curl -s -O https://raw.githubusercontent.com/jferreyradev/backend-gateway/main/scripts/register-backend-standalone.ts
    if errorlevel 1 (
        echo.
        echo ================================================
        echo ERROR: No se pudo descargar el script
        echo.
        echo Opciones:
        echo 1. Verifica tu conexion a internet
        echo 2. Actualiza la URL en este archivo
        echo 3. Descarga manualmente desde GitHub
        echo 4. Copia register-backend-standalone.ts aqui
        echo ================================================
        pause
        exit /b 1
    )
    echo OK - Script descargado
)

echo.
echo Iniciando daemon (IP publica, actualizacion cada 5 min)...
echo Presiona Ctrl+C para detener.
echo ==========================================
echo.

deno run -A register-backend-standalone.ts --name=%BACKEND_NAME% --use-public-ip --backend-port=%BACKEND_PORT% --backend-token=%BACKEND_TOKEN% --prefix=%BACKEND_PREFIX% --registry-url=%STORAGE_URL% --api-key=%API_KEY% --encryption-key=%ENCRYPTION_KEY% --daemon
