# 🌐 Backend Gateway

Sistema de registro y enrutamiento automático de backends.

**Características:**
- ✅ Encriptación de tokens
- ✅ Balanceo de carga (round-robin)
- ✅ Health checks automáticos
- ✅ Caché inteligente
- ✅ Compatible con Deno Deploy

---

## 🚀 Inicio Rápido

**Registrar backend:**
```bash
deno run -A register-backend.ts \
  --name=mi-backend \
  --backend-url=http://localhost:3000 \
  --backend-token=token-secreto \
  --prefix=/api \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123 \
  --daemon
```

**Ejecutar gateway:**
```bash
BACKENDS_REGISTRY_URL=http://localhost:8000 \
API_KEY=test-token-123 \
deno run -A gateway-server.ts
```

---

## 📊 Probar

```bash
# Health check
curl http://localhost:8080/gateway/health

# Ver backends registrados
curl http://localhost:8080/gateway/status

# Probar ruta
curl http://localhost:8080/api/endpoint
```

---

## ⚙️ Variables de Entorno

### Gateway (`gateway-server.ts`)
- `BACKENDS_REGISTRY_URL` - URL del servidor de registro (requerido)
- `API_KEY` - API Key del registro (requerido)
- `ENCRYPTION_KEY` - Clave para desencriptar (opcional)
- `CACHE_TTL_MS` - TTL del caché en ms (default: 30000)
- `PROXY_PORT` - Puerto local (default: 8080)

### Register (`register-backend.ts`)
- `--name` - Nombre del backend
- `--backend-url` - URL del backend
- `--backend-port` - Puerto (para IP pública)
- `--use-public-ip` - Detectar IP automáticamente
- `--backend-token` - Token de autenticación
- `--prefix` - Prefijo de ruta
- `--registry-url` - URL del registro
- `--api-key` - API Key del registro
- `--encryption-key` - Clave de encriptación (opcional)
- `--daemon` - Modo automático (cada 5 min)

---

## 📚 Documentación

- [QUICKSTART.md](QUICKSTART.md) - Guía rápida
- [.env.example](.env.example) - Variables de ejemplo

---

## 🔗 API Gateway

### Endpoints de Monitoreo

| Endpoint | Descripción |
|----------|-------------|
| `GET /gateway/health` | Estado del gateway |
| `GET /gateway/status` | Estado de todos los backends |
| `GET /gateway/routing` | Tabla de enrutamiento |

### Enrutamiento

El gateway enruta según el prefijo más específico:

```
GET /api/users  →  Backend con prefix /api
GET /api/v2/posts  →  Backend con prefix /api/v2 (si existe)
```

---

## 🛠️ Desarrollo

### Estructura

```
backend-gateway/
├── gateway-server.ts      # Servidor de proxy/gateway
├── register-backend.ts    # Cliente de registro
├── install.ts            # Instalador automático
├── deno.json             # Configuración
└── .env.example          # Template de variables
```

### Ejecutar en desarrollo

```bash
# Gateway
deno run -A gateway-server.ts

# Register (otra terminal)
deno run -A register-backend.ts --name=test --backend-url=http://localhost:3000 --backend-token=test --prefix=/test --registry-url=http://localhost:8000 --api-key=test
```

---

## 📝 Notas

- Los tokens se encriptan automáticamente
- El gateway cachea backends cada 30 segundos
- Los backends se actualizan cada 5 minutos en modo daemon
- Si un backend falla 3 veces seguidas, se marca como inactivo
