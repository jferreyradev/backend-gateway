#!/usr/bin/env pwsh
# Script de prueba rápida del gateway

Write-Host "`n╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Test Gateway Proxy                ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════╝`n" -ForegroundColor Cyan

$GATEWAY = "http://localhost:8080"

# Test 1: Health check
Write-Host "🔍 Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$GATEWAY/gateway/health" -Method Get
    Write-Host "✅ Gateway está corriendo" -ForegroundColor Green
    Write-Host "   Backends registrados: $($response.backends)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Gateway NO está corriendo" -ForegroundColor Red
    Write-Host "   Inicia el gateway con: deno run --allow-net --allow-env src/simple-gateway.ts" -ForegroundColor Yellow
    exit 1
}

# Test 2: Gateway info
Write-Host "`n🔍 Test 2: Gateway Info" -ForegroundColor Yellow
try {
    $info = Invoke-RestMethod -Uri "$GATEWAY/" -Method Get
    Write-Host "✅ Rutas disponibles:" -ForegroundColor Green
    foreach ($route in $info.routes) {
        Write-Host "   $($route.prefix) -> $($route.name) ($($route.url))" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Probar ruta del backend
Write-Host "`n🔍 Test 3: Probar backend /api/desa" -ForegroundColor Yellow
try {
    $testUrl = "$GATEWAY/api/desa/"
    Write-Host "   URL: $testUrl" -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri $testUrl -Method Get
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Backend: $($response.Headers['X-Backend'])" -ForegroundColor Gray
    Write-Host "   Proxy: $($response.Headers['X-Proxied-By'])" -ForegroundColor Gray
    
    # Mostrar primeras líneas de respuesta
    $content = $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length))
    Write-Host "   Respuesta: $content..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "   Detalles: $($_.ErrorDetails)" -ForegroundColor Red
    }
}

Write-Host "`n════════════════════════════════════════════`n" -ForegroundColor Cyan
