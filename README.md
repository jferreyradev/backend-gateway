# 🌐 Backend Gateway

Gateway API con autenticación y enrutamiento dinámico de backends.

## ⚡ Inicio Rápido

```bash
# 1. Configurar variables
$env:BACKENDS_REGISTRY_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="tu-api-key"

# 2. Registrar usuario
deno run -A src/register-user.ts --username admin --password admin123

# 3. Registrar backend
deno run -A src/register-backend.ts \
  --name=prod --prefix=/prod \
  --backend-url=http://api:3000 \
  --backend-token=secret

# 4. Iniciar gateway
deno run -A src/simple-gateway.ts
```

## 🎯 Uso

```bash
# Login
curl -X POST http://localhost:8080/gateway/login \
  -d '{"username":"admin","password":"admin123"}'

# Usar con token
curl http://localhost:8080/prod/api/users \
  -H "Authorization: Bearer TOKEN"
```

## 📁 Estructura

```
src/                    # Código principal
├── simple-gateway.ts   # Gateway
├── register-backend.ts # Registrar backends
└── register-user.ts    # Gestionar usuarios

scripts/                # Desarrollo
├── registry-server.ts  # Mock KV Storage (offline)
├── *.json              # Datos de ejemplo
└── test-*.ts           # Tests

docs/                   # Documentación completa
└── SISTEMA_GATEWAY.md  # ⭐ Guía completa
```

## 🔑 Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `BACKENDS_REGISTRY_URL` | URL del KV Storage |
| `API_KEY` | API Key del KV Storage |
| `ENCRYPTION_KEY` | Clave de encriptación (32+ chars) |
| `PORT` | Puerto del gateway (default: 8080) |
| `ALLOWED_ORIGINS` | CORS origins (default: *) |

Ver [.env.example](.env.example) para más opciones.

## 📚 Documentación

- **[SISTEMA_GATEWAY.md](docs/SISTEMA_GATEWAY.md)** - Guía completa y detallada
- [AUTHENTICATION.md](docs/AUTHENTICATION.md) - Autenticación
- [DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md) - Deploy en Deno Deploy
- [USER_MANAGEMENT.md](docs/USER_MANAGEMENT.md) - Gestión de usuarios
- [TESTING.md](docs/TESTING.md) - Testing

## 🧪 Testing

```bash
deno run -A scripts/test-auth.ts       # Test autenticación
deno run -A scripts/test-gateway.ts    # Test gateway
deno run -A scripts/check-backends.ts  # Ver backends
```

## 🏠 Desarrollo Local (Offline)

```bash
# Terminal 1: Mock server
deno run -A scripts/registry-server.ts

# Terminal 2: Gateway
BACKENDS_REGISTRY_URL=http://localhost:8001 \
deno run -A src/simple-gateway.ts
```

## 🚀 Deploy

```bash
# Push a GitHub
git push origin main

# Conectar en dash.deno.com
# Configurar variables de entorno
# Deploy automático ✅
```

## 📝 Características

- ✅ Autenticación con tokens Bearer
- ✅ Encriptación AES-GCM para tokens
- ✅ CORS configurable
- ✅ Headers de seguridad
- ✅ Request IDs y latencia
- ✅ Logging estructurado
- ✅ Enrutamiento por prefijos
- ✅ Auto-recarga de backends

---

**📖 Para documentación completa ver [docs/SISTEMA_GATEWAY.md](docs/SISTEMA_GATEWAY.md)**
