# 🧪 Guía de Pruebas del Gateway

## Paso 1: Iniciar el Gateway

Abre una terminal PowerShell y ejecuta:

```powershell
# Configurar variables de entorno
$env:BACKENDS_REGISTRY_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="pi3_141516"
$env:GATEWAY_USERNAME="admin"
$env:GATEWAY_PASSWORD="admin123"

# Iniciar el gateway
deno serve --allow-net --allow-env src/gateway-server.ts
```

Deberías ver: `deno serve: Listening on http://localhost:8000/`

**⚠️ IMPORTANTE: Deja esta terminal abierta y corriendo**

## Paso 2: Probar el Gateway

Abre **OTRA** terminal PowerShell nueva y ejecuta:

### Opción A: Test Simple (Recomendado)
```powershell
deno run -A scripts/test-simple.ts
```

### Opción B: Test Completo (13 pruebas)
```powershell
deno run -A scripts/test-general.ts
```

### Opción C: Test Manual con curl

```powershell
# 1. Health check (público)
Invoke-WebRequest http://localhost:8000/gateway/health

# 2. Login
$response = Invoke-WebRequest -Method POST `
  -Uri "http://localhost:8000/gateway/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}' | ConvertFrom-Json

$token = $response.token
Write-Host "Token: $token"

# 3. Ver status (con token)
Invoke-WebRequest -Uri "http://localhost:8000/gateway/status" `
  -Headers @{Authorization="Bearer $token"}

# 4. Ver routing
Invoke-WebRequest -Uri "http://localhost:8000/gateway/routing" `
  -Headers @{Authorization="Bearer $token"}

# 5. Logout
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:8000/gateway/logout" `
  -Headers @{Authorization="Bearer $token"}
```

## Paso 3: Detener el Gateway

En la terminal donde está corriendo el gateway, presiona `Ctrl+C`

## 🎯 Resultados Esperados

### Test Simple:
```
🧪 Test Simple del Gateway

1. Health check...
   Status: 200
   Body: {"status":"ok"}

2. Login...
   Status: 200
   Token: ABC123XYZ...

3. Status con token...
   Status: 200
   Backends: 2

4. Logout...
   Status: 200
   Message: Logout successful

5. Intentar usar token después de logout...
   Status: 401 (debe ser 401)

✅ Todos los tests pasaron!
```

### Test Completo:
```
📊 RESUMEN DE PRUEBAS
Total de pruebas: 13
✅ Exitosas: 13
❌ Fallidas: 0
📈 Porcentaje de éxito: 100.0%

🎉 ¡Todos los tests pasaron exitosamente!
```

## ❓ Troubleshooting

### Error: "No es posible conectar con el servidor"
- Asegúrate de que el gateway esté corriendo en la terminal (Paso 1)
- Verifica que el puerto 8000 no esté ocupado

### Error: "Invalid credentials"
- Verifica que uses: `admin` / `admin123`
- O las credenciales configuradas en las variables de entorno

### El servidor se detiene solo
- No ejecutes los tests en la misma terminal donde corre el gateway
- Usa DOS terminales diferentes: una para el servidor, otra para los tests
