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

## 📁 Estructura del Proyecto

```
backend-gateway/
├── src/                        # 🎯 Código fuente principal
│   ├── simple-gateway.ts       # Gateway principal
│   ├── register-backend.ts     # CLI para registrar backends
│   └── register-user.ts        # CLI para gestionar usuarios
│
├── scripts/                    # 🧪 Testing y desarrollo
│   ├── registry-server.ts      # Mock del KV Storage (desarrollo local)
│   ├── test-auth.ts            # Test de autenticación
│   ├── test-gateway.ts         # Test del gateway
│   ├── test-general.ts         # Test completo del sistema
│   └── check-backends.ts       # Verificar backends
│
├── docs/                       # 📚 Documentación
│   ├── SISTEMA_GATEWAY.md      # ⭐ Resumen completo del sistema
│   ├── MEJORAS_IMPLEMENTADAS.md# Mejoras recientes
│   ├── AUTHENTICATION.md       # Guía de autenticación
│   ├── DEPLOY_GATEWAY.md       # Deploy en Deno Deploy
│   ├── USER_MANAGEMENT.md      # Gestión de usuarios
│   └── TESTING.md              # Guía de testing
│
├── 📄 *.json                   # Archivos de datos
│   ├── backends.json           # Datos de ejemplo (mock server)
│   ├── users.json              # Usuarios de ejemplo (mock server)
│   ├── user-admin.json         # Usuario admin de ejemplo
│   └── deno.json               # Configuración de Deno
│
├── .env.example                # Ejemplo de variables de entorno
├── GUIA_RAPIDA.md              # Guía rápida de uso
├── main.ts                     # Entry point para Deno Deploy
└── README.md                   # ⭐ Este archivo
```

### 🎭 Desarrollo Local vs Producción

**Producción** (Recomendado):
- Gateway → KV Storage en la nube (`https://kv-storage-api.deno.dev`)
- Sin necesidad de `registry-server.ts`
- Sin archivos JSON

**Desarrollo Local** (Offline):
- `scripts/registry-server.ts` simula el KV Storage
- Usa `backends.json` y `users.json`
- Ideal para desarrollo sin internet

---

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
# Copiar ejemplo de configuración
copy .env.example .env

# Editar .env con tus valores
# O configurar en PowerShell:
$env:BACKENDS_REGISTRY_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="tu-api-key"
$env:ENCRYPTION_KEY="clave-segura-de-al-menos-32-caracteres"
```

### 2. Registrar Usuarios

```bash
# Registrar usuario administrador
deno run -A src/register-user.ts \
  --username admin \
  --password admin123 \
  --roles admin,user

# Registrar usuario normal
deno run -A src/register-user.ts \
  --username developer \
  --password dev456
```

### 3. Registrar Backends

```bash
# Registrar backend de producción
deno run -A src/register-backend.ts \
  --name=produccion \
  --backend-url=http://api.prod:3000 \
  --backend-token=secret-prod-token \
  --prefix=/prod \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=tu-api-key

# Registrar backend de desarrollo
deno run -A src/register-backend.ts \
  --name=desarrollo \
  --backend-url=http://localhost:3001 \
  --backend-token=dev-token-123 \
  --prefix=/desa \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=tu-api-key
```

### 4. Iniciar el Gateway

```bash
# Iniciar gateway
deno run -A src/simple-gateway.ts

# O con variables personalizadas
PORT=8000 deno run -A src/simple-gateway.ts
```

### 5. Usar el Gateway

```bash
# 1. Login para obtener token
curl -X POST http://localhost:8080/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Respuesta: {"token":"abc123...","expiresIn":3600,"tokenType":"Bearer"}

# 2. Ver información del gateway
curl http://localhost:8080/gateway \
  -H "Authorization: Bearer abc123..."

# 3. Hacer petición a backend
curl http://localhost:8080/prod/api/users \
  -H "Authorization: Bearer abc123..."

# 4. Logout
curl -X POST http://localhost:8080/gateway/logout \
  -H "Authorization: Bearer abc123..."
```

---

## 🧪 Testing

### Tests Disponibles

```bash
# Test de autenticación
deno run -A scripts/test-auth.ts

# Test del gateway completo
deno run -A scripts/test-gateway.ts

# Verificar backends registrados
deno run -A scripts/check-backends.ts
```

Ver [docs/TESTING.md](docs/TESTING.md) para guía completa de testing.

---

## 🏠 Desarrollo Local (Offline)

Para desarrollar sin conexión o sin acceso al KV Storage en la nube:

```bash
# Terminal 1: Iniciar mock del KV Storage
deno run -A scripts/registry-server.ts
# Escucha en http://localhost:8001
# Usa backends.json y users.json

# Terminal 2: Gateway apuntando al mock local
BACKENDS_REGISTRY_URL=http://localhost:8001 \
API_KEY=desarrollo-api-key-2026 \
deno run -A src/simple-gateway.ts

# Terminal 3: Registrar backend en el mock
deno run -A src/register-backend.ts \
  --name=test \
  --backend-url=http://localhost:3000 \
  --backend-token=test-token \
  --prefix=/test \
  --registry-url=http://localhost:8001 \
  --api-key=desarrollo-api-key-2026
```

**Ventajas del mock local:**
- ✅ Desarrollo sin internet
- ✅ Testing rápido sin dependencias externas
- ✅ Datos persistentes en JSON
- ✅ Mismo comportamiento que KV Storage real

---

## 🔐 Autenticación

El gateway requiere tokens Bearer para todas las operaciones excepto:
- `POST /gateway/login` - Obtener token
- `GET /gateway/health` - Health check público

**Gestión de sesiones:**
- `POST /gateway/logout` - Revocar token y cerrar sesión

Ver [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) para detalles completos.

---

## 📚 Documentación Completa

- **[📋 SISTEMA_GATEWAY.md](docs/SISTEMA_GATEWAY.md)** - Documentación completa del sistema
- **[✨ MEJORAS_IMPLEMENTADAS.md](docs/MEJORAS_IMPLEMENTADAS.md)** - Mejoras recientes
- **[🔐 AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Guía de autenticación
- **[🚀 DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)** - Deploy en Deno Deploy
- **[👤 USER_MANAGEMENT.md](docs/USER_MANAGEMENT.md)** - Gestión de usuarios
- **[🧪 TESTING.md](docs/TESTING.md)** - Guía de testing
- **[⚡ GUIA_RAPIDA.md](GUIA_RAPIDA.md)** - Guía rápida de uso

---

## 🌍 Deploy en Deno Deploy

1. Push tu código a GitHub
2. Conecta tu repositorio en [dash.deno.com](https://dash.deno.com)
3. Configura las variables de entorno:
   - `BACKENDS_REGISTRY_URL` - URL del KV storage
   - `API_KEY` - API Key para el KV storage
   - `ENCRYPTION_KEY` - Clave de encriptación (32+ caracteres)
   - `ALLOWED_ORIGINS` - Orígenes CORS permitidos
4. Deploy automático ✅

Más detalles en [DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)

---

## 📊 Características Principales

### 🔒 Seguridad
- ✅ Autenticación con tokens Bearer
- ✅ Encriptación AES-GCM-256 para tokens de backend
- ✅ Hash SHA-256 para passwords
- ✅ CORS configurable
- ✅ Headers de seguridad (X-Frame-Options, X-XSS-Protection)
- ✅ Validación de configuración al inicio

### 🎯 Observabilidad
- ✅ Request IDs únicos (X-Request-ID)
- ✅ Medición de latencia (X-Response-Time)
- ✅ Logging estructurado con IDs
- ✅ Health checks

### 🚀 Performance
- ✅ Enrutamiento por prefijos
- ✅ Caché de backends configurable
- ✅ Auto-recarga de configuración

---

## ⚙️ Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `8080` | Puerto del gateway |
| `BACKENDS_REGISTRY_URL` | `https://kv-storage-api.deno.dev` | URL del KV storage |
| `API_KEY` | `desarrollo-api-key-2026` | API Key del KV storage |
| `ENCRYPTION_KEY` | `go-oracle-api-secure-key-2026` | Clave de encriptación (32+ chars) |
| `TOKEN_TTL_MS` | `3600000` | TTL de tokens de sesión (1h) |
| `ALLOWED_ORIGINS` | `*` | Orígenes CORS (separados por comas) |
| `CACHE_TTL_MS` | `30000` | TTL del caché de backends (30s) |

---

## 🛠️ Comandos Útiles

```bash
# Ver usuarios registrados
deno run -A src/register-user.ts --list

# Eliminar usuario
deno run -A src/register-user.ts --delete username

# Verificar backends
deno run -A scripts/check-backends.ts

# Test de autenticación
deno run -A scripts/test-auth.ts
```

---

## 📝 Notas

- Los tokens de backend se almacenan **encriptados** en el KV storage
- Los passwords de usuario se almacenan **hasheados** con SHA-256
- Los tokens de sesión son temporales y se almacenan en memoria
- CORS está configurado como `*` por default (cambiar en producción)

### 📦 Archivos JSON

Los archivos `*.json` en la raíz son **datos de ejemplo** para el mock server:
- `backends.json` - Backend de ejemplo (usado por `scripts/registry-server.ts`)
- `users.json` - Usuario admin de ejemplo (password: `admin123`)
- `user-admin.json` - Otro formato de usuario de ejemplo
- `deno.json` - ⚠️ **NO TOCAR** - Configuración de Deno

**En producción**, estos archivos JSON NO se usan. El sistema usa KV Storage en la nube.

---

## 🤝 Contribuir

Para contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo licencia MIT - ver el archivo LICENSE para más detalles.

---

**Última actualización**: 13 de enero de 2026

## 📝 Notas

- Los tokens se encriptan automáticamente
- El gateway cachea backends cada 30 segundos
- Los backends se actualizan cada 5 minutos en modo daemon
- Si un backend falla 3 veces seguidas, se marca como inactivo
