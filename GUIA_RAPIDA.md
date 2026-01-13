# 🌐 Backend Gateway - Guía Rápida

Sistema de proxy/gateway para enrutar peticiones a múltiples backends según su prefijo.

---

## 🚀 Instalación (5 minutos)

### 1. Instalar Deno
```powershell
# Windows
irm https://deno.land/install.ps1 | iex

# Linux/macOS  
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Clonar o crear proyecto
```powershell
git clone https://github.com/tu-repo/backend-gateway.git
cd backend-gateway
```

---

## 💻 Uso Local

### Iniciar el Sistema
```powershell
# Terminal 1: Registry (almacena backends)
deno run --allow-net --allow-read --allow-write .\src\registry-server.ts

# Terminal 2: Gateway (proxy)
$env:BACKENDS_REGISTRY_URL="http://localhost:8001"
$env:API_KEY="desarrollo-api-key-2026"
deno run --allow-net --allow-env .\src\simple-gateway.ts

# Terminal 3: Registrar backend
deno run -A .\scripts\register-backend.ts `
  --name="MiAPI" `
  --backend-url="http://localhost:3000" `
  --backend-token="token-secreto" `
  --prefix="/api/v1" `
  --registry-url="http://localhost:8001" `
  --api-key="desarrollo-api-key-2026"
```

### Usar el Gateway
```bash
# Ver info
curl http://localhost:8080/

# Usar backend
curl http://localhost:8080/api/v1/users
# → Enruta a: http://localhost:3000/users
```

---

## 🌍 Uso en Producción

### 1. Backend con IP Dinámica
```powershell
# Se registra automáticamente con IP pública
deno run -A .\scripts\register-backend.ts `
  --name="backend-prod" `
  --use-public-ip `
  --backend-port="3000" `
  --backend-token="token-xyz" `
  --prefix="/api/prod" `
  --registry-url="http://registry-server:8001" `
  --api-key="api-key-123" `
  --daemon
```

### 2. Deploy en Deno Deploy
```bash
# Deploy gateway (funciona local y en Deno Deploy)
deployctl deploy \
  --project=mi-gateway \
  --env=BACKENDS_REGISTRY_URL=https://registry.deno.dev \
  --env=API_KEY=tu-api-key \
  src/simple-gateway.ts
```

---

## 📋 Comandos Comunes

```powershell
# Ver backends registrados
deno run --allow-net .\scripts\check-backends.ts

# Probar gateway
deno run --allow-net .\scripts\test-gateway.ts

# Prueba completa
.\test-complete.ps1

# Registrar usuario (gateway completo)
deno run -A .\scripts\register-user.ts `
  --username="admin" `
  --password="pass123" `
  --registry-url="http://localhost:8001" `
  --api-key="desarrollo-api-key-2026"
```

---

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REGISTRY_PORT` | Puerto del registry | `8001` |
| `PORT` | Puerto del gateway | `8080` |
| `BACKENDS_REGISTRY_URL` | URL del registry | requerido |
| `API_KEY` | API Key compartida | requerido |
| `CACHE_TTL_MS` | TTL caché (ms) | `30000` |

### Argumentos del Register Script

| Argumento | Descripción | Requerido |
|-----------|-------------|-----------|
| `--name` | Nombre del backend | ✓ |
| `--backend-url` | URL del backend | ✓ * |
| `--backend-token` | Token de auth | ✓ |
| `--prefix` | Prefijo de ruta | ✓ |
| `--registry-url` | URL del registry | ✓ |
| `--api-key` | API Key del registry | ✓ |
| `--use-public-ip` | Detectar IP pública | - |
| `--backend-port` | Puerto local | ✓ ** |
| `--daemon` | Modo daemon | - |

\* No requerido si se usa `--use-public-ip`  
\*\* Requerido con `--use-public-ip`

---

## 🏗️ Arquitectura

```
┌──────────────┐
│   Cliente    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Gateway (8080)      │  ← Lee backends del registry cada 30s
│  - Enruta por prefix │
│  - Balance de carga  │
└──────┬───────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ Backend 1   │   │ Backend 2   │
│ /api/prod   │   │ /api/desa   │
└─────────────┘   └─────────────┘
       ▲                 ▲
       │                 │
       └────────┬────────┘
                │
      ┌─────────┴────────┐
      │  Registry (8001) │  ← Almacena configs
      │  backends.json   │
      └──────────────────┘
```

---

## 📁 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `scripts/registry-server.ts` | Servidor de registro (KV local) |
| `src/simple-gateway.ts` | Gateway sin auth (local y Deno Deploy) |
| `src/gateway-server.ts` | Gateway con autenticación completa |
| `src/register-backend.ts` | Script de auto-registro |
| `backends.json` | Storage local de backends |

---

## 🛠️ Troubleshooting

### Gateway no carga backends
```powershell
# 1. Verificar registry
Test-NetConnection localhost -Port 8001

# 2. Ver backends registrados
deno run --allow-net .\scripts\check-backends.ts

# 3. Verificar API_KEY
echo $env:API_KEY
```

### Backend no responde (502)
```powershell
# Verificar que el backend está corriendo
curl http://backend-url:port/health

# Verificar el token
# Token debe coincidir con el registrado
```

### Puerto en uso
```powershell
# Ver qué usa el puerto
netstat -ano | findstr :8080

# Matar proceso
Stop-Process -Id <PID> -Force
```

---

## 🎯 Casos de Uso

### 1. Desarrollo Local
- Gateway en localhost:8080
- Múltiples backends locales
- Sin autenticación

### 2. Microservicios
- Gateway centralizado
- Backends en diferentes hosts
- Registro automático con IP

### 3. Producción en Cloud
- Gateway en Deno Deploy
- Backends en VPS/Cloud
- Auto-registro con daemon

---

## 📚 Documentación Completa

- [QUICKSTART.md](docs/QUICKSTART.md) - Inicio rápido detallado
- [DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md) - Deploy en Deno Deploy
- [INSTALL_BACKEND_REGISTRATION.md](docs/INSTALL_BACKEND_REGISTRATION.md) - Instalación en servidores
- [AUTHENTICATION.md](docs/AUTHENTICATION.md) - Sistema de autenticación
- [TESTING.md](docs/TESTING.md) - Guía de testing

---

## 💡 Ejemplos

### Backend con URL Fija
```powershell
deno run -A .\scripts\register-backend.ts `
  --name="api-prod" `
  --backend-url="http://10.0.1.100:3000" `
  --backend-token="prod-token-xyz" `
  --prefix="/api/prod" `
  --registry-url="http://gateway:8001" `
  --api-key="secret-key-123"
```

### Backend con IP Dinámica
```powershell
deno run -A .\scripts\register-backend.ts `
  --name="api-desa" `
  --use-public-ip `
  --backend-port="3000" `
  --backend-token="desa-token-abc" `
  --prefix="/api/desa" `
  --registry-url="http://gateway:8001" `
  --api-key="secret-key-123" `
  --daemon
```

### Prueba Completa
```powershell
# Inicia todo automáticamente
.\test-complete.ps1
```

---

## 📄 Licencia

MIT License

---

## 🔗 Links

- [Deno](https://deno.land/)
- [Deno Deploy](https://deno.com/deploy)
- [Documentación](docs/)
