# 🌐 Backend Gateway (Simplificado + Seguro)

Gateway minimalista para enrutamiento automático de backends con **Deno**.

**Características:**
- ✅ Enrutamiento por prefijos
- ✅ Balanceo de carga round-robin
- ✅ Caché inteligente (30s TTL)
- ✅ Compatible con Deno Deploy
- ✅ Encriptación de tokens
- 🔐 Autenticación con tokens Bearer temporales

---

## � Estructura del Proyecto

```
backend-gateway/
├── src/                    # Código fuente
│   ├── gateway-server.ts   # Gateway principal
│   └── registry-server.ts  # Servidor de registro local
├── scripts/                # Scripts y utilidades
│   ├── register-backend.ts # CLI para registrar backends
│   ├── test-general.ts     # Test completo del sistema
│   ├── test-auth.ts        # Test de autenticación
│   ├── test-kv.ts          # Test del KV storage
│   └── check-backends.ts   # Verificar backends
├── docs/                   # Documentación
│   ├── AUTHENTICATION.md   # Guía de autenticación
│   ├── DEPLOY_DENO.md      # Deploy en Deno Deploy
│   └── QUICKSTART.md       # Inicio rápido
├── backends.json           # Datos para servidor local
├── deno.json               # Configuración de Deno
└── README.md               # Este archivo
```

---

## 🚀 Inicio Rápido

### 1. Iniciar el Gateway

```bash
# Configurar variables de entorno
$env:BACKENDS_REGISTRY_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="tu-api-key"
$env:GATEWAY_USERNAME="admin"
$env:GATEWAY_PASSWORD="tu-password-seguro"

# Iniciar gateway
deno task dev
```

### 2. Autenticarse

```bash
# Obtener token
curl -X POST http://localhost:8000/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu-password-seguro"}'

# Respuesta:
# {"token":"ABC123...","expiresIn":3600,"tokenType":"Bearer"}
```

### 3. Usar el Gateway

```bash
# Ver status (requiere token)
curl http://localhost:8000/gateway/status \
  -H "Authorization: Bearer ABC123..."

# Proxy a backend (requiere token)
curl http://localhost:8000/api/endpoint \
  -H "Authorization: Bearer ABC123..."

# Logout cuando termines
curl -X POST http://localhost:8000/gateway/logout \
  -H "Authorization: Bearer ABC123..."
```

---

## 🧪 Testing

**IMPORTANTE**: Debes tener el gateway corriendo en una terminal antes de ejecutar los tests.

### Iniciar el Gateway (Terminal 1)
```bash
deno task dev
```

### Ejecutar Tests (Terminal 2)

#### Test Simple (Rápido - 3 pruebas)
```bash
deno task test:simple
```

#### Test Completo (13 pruebas)
```bash
deno task test
```

#### Tests Individuales
```bash
# Test de autenticación
deno task test:auth

# Test de KV storage
deno task test:kv

# Verificar backends registrados
deno task check
```

Ver [docs/TESTING.md](docs/TESTING.md) para guía completa de testing.

---

## 🔐 Autenticación

El gateway requiere tokens Bearer para todas las operaciones excepto:
- `POST /gateway/login` - Obtener token
- `GET /gateway/health` - Health check público

**Gestión de sesiones:**
- `POST /gateway/logout` - Revocar token y cerrar sesión

Ver [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) para detalles completos.

---

## 🌍 Deploy en Deno Deploy

1. Push a GitHub
2. Conecta tu repo en [dash.deno.com](https://dash.deno.com)
3. Configura variables:
   - `BACKENDS_REGISTRY_URL`
   - `API_KEY`
4. Deploy automático ✅

---

## 📊 Endpoints

- `GET /gateway/health` - Health check
- `GET /gateway/status` - Estado de backends
- `GET /gateway/routing` - Tabla de rutas
- `/{prefix}/*` - Proxy a backends

---

---

## ⚙️ Variables de Entorno

### Gateway (`simple-gateway.ts`)
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
├── simple-gateway.ts      # Servidor de proxy/gateway
├── register-backend.ts    # Cliente de registro
├── install.ts            # Instalador automático
├── deno.json             # Configuración
└── .env.example          # Template de variables
```

### Ejecutar en desarrollo

```bash
# Gateway
deno run -A simple-gateway.ts

# Register (otra terminal)
deno run -A register-backend.ts --name=test --backend-url=http://localhost:3000 --backend-token=test --prefix=/test --registry-url=http://localhost:8000 --api-key=test
```

---

## 📝 Notas

- Los tokens se encriptan automáticamente
- El gateway cachea backends cada 30 segundos
- Los backends se actualizan cada 5 minutos en modo daemon
- Si un backend falla 3 veces seguidas, se marca como inactivo
