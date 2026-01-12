# Script completo para probar el sistema de gateway
# Ejecuta: .\test-complete.ps1

Write-Host "
╔═══════════════════════════════════════════╗
║    Test Completo del Sistema Gateway     ║
╚═══════════════════════════════════════════╝
" -ForegroundColor Cyan

# Verificar que Deno está instalado
if (!(Get-Command deno -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Deno no está instalado" -ForegroundColor Red
    Write-Host "   Instala con: irm https://deno.land/install.ps1 | iex" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Deno instalado: $(deno --version | Select-String 'deno')`n" -ForegroundColor Green

# Configurar variables de entorno
$env:BACKENDS_REGISTRY_URL = "http://localhost:8001"
$env:API_KEY = "desarrollo-api-key-2026"
$env:PORT = "8080"

Write-Host "📝 Configuración:" -ForegroundColor Yellow
Write-Host "   Registry: $env:BACKENDS_REGISTRY_URL"
Write-Host "   API Key: $env:API_KEY"
Write-Host "   Gateway Port: $env:PORT`n"

# Función para verificar si un puerto está en uso
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# 1. Iniciar Registry Server (si no está corriendo)
Write-Host "🔍 Verificando Registry Server (puerto 8001)..." -ForegroundColor Cyan
if (!(Test-Port 8001)) {
    Write-Host "   ⚠️  Registry no está corriendo" -ForegroundColor Yellow
    Write-Host "   Iniciando Registry Server...`n"
    
    $registryJob = Start-Job -ScriptBlock {
        $env:REGISTRY_PORT = "8001"
        $env:API_KEY = "desarrollo-api-key-2026"
        Set-Location $using:PWD
        deno run --allow-net --allow-read --allow-write .\src\registry-server.ts
    }
    
    Write-Host "   ⏳ Esperando que Registry esté listo..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    if ($registryJob.State -eq "Running") {
        Write-Host "   ✅ Registry Server corriendo (Job ID: $($registryJob.Id))`n" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error iniciando Registry Server" -ForegroundColor Red
        Receive-Job -Job $registryJob
        exit 1
    }
} else {
    Write-Host "   ✅ Registry Server ya está corriendo`n" -ForegroundColor Green
}

# 2. Verificar backends registrados
Write-Host "📋 Verificando backends registrados..." -ForegroundColor Cyan
deno run --allow-net .\scripts\check-backends.ts
Write-Host ""

# Preguntar si desea registrar un backend de prueba
Write-Host "¿Deseas registrar un backend de prueba? (S/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -eq "S" -or $response -eq "s") {
    Write-Host "`n📝 Registrando backend de prueba..." -ForegroundColor Cyan
    
    deno run --allow-net --allow-env .\scripts\register-backend.ts `
        --name="TestBackend" `
        --backend-url="http://localhost:3000" `
        --backend-token="test-token-123" `
        --prefix="/api/test" `
        --registry-url="http://localhost:8001" `
        --api-key="desarrollo-api-key-2026"
    
    Write-Host ""
}

# 3. Iniciar Simple Gateway
Write-Host "🚀 Iniciando Simple Gateway..." -ForegroundColor Cyan
$gatewayJob = Start-Job -ScriptBlock {
    $env:BACKENDS_REGISTRY_URL = "http://localhost:8001"
    $env:API_KEY = "desarrollo-api-key-2026"
    $env:PORT = "8080"
    Set-Location $using:PWD
    deno run --allow-net --allow-env .\src\simple-gateway.ts
}

Write-Host "   ⏳ Esperando que Gateway esté listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

if ($gatewayJob.State -eq "Running") {
    Write-Host "   ✅ Gateway corriendo (Job ID: $($gatewayJob.Id))`n" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error iniciando Gateway" -ForegroundColor Red
    Receive-Job -Job $gatewayJob
    
    # Limpiar
    if ($registryJob) { Stop-Job -Job $registryJob; Remove-Job -Job $registryJob }
    exit 1
}

# 4. Ejecutar pruebas
Write-Host "🧪 Ejecutando pruebas del Gateway...`n" -ForegroundColor Cyan
Start-Sleep -Seconds 2

deno run --allow-net .\scripts\test-gateway.ts http://localhost:8080

$testExitCode = $LASTEXITCODE

# 5. Mostrar logs del Gateway
Write-Host "`n📋 Últimos logs del Gateway:" -ForegroundColor Cyan
Write-Host "─".PadRight(50, "─")
Receive-Job -Job $gatewayJob -Keep | Select-Object -Last 20
Write-Host "─".PadRight(50, "─")

# Preguntar si desea mantener los servicios corriendo
Write-Host "`n¿Mantener los servicios corriendo? (S/N): " -ForegroundColor Yellow -NoNewline
$keepRunning = Read-Host

if ($keepRunning -eq "S" -or $keepRunning -eq "s") {
    Write-Host "`n✅ Servicios corriendo:" -ForegroundColor Green
    if ($registryJob) {
        Write-Host "   📡 Registry Server (Job ID: $($registryJob.Id)) - Puerto 8001"
    }
    Write-Host "   🚀 Gateway (Job ID: $($gatewayJob.Id)) - Puerto 8080"
    Write-Host "`nPara detenerlos:" -ForegroundColor Yellow
    if ($registryJob) {
        Write-Host "   Stop-Job -Id $($registryJob.Id); Remove-Job -Id $($registryJob.Id)"
    }
    Write-Host "   Stop-Job -Id $($gatewayJob.Id); Remove-Job -Id $($gatewayJob.Id)"
    Write-Host "`nPara ver logs:"
    Write-Host "   Receive-Job -Id $($gatewayJob.Id) -Keep`n"
} else {
    Write-Host "`n🛑 Deteniendo servicios..." -ForegroundColor Yellow
    
    Stop-Job -Job $gatewayJob
    Remove-Job -Job $gatewayJob
    
    if ($registryJob) {
        Stop-Job -Job $registryJob
        Remove-Job -Job $registryJob
    }
    
    Write-Host "✅ Servicios detenidos`n" -ForegroundColor Green
}

exit $testExitCode
