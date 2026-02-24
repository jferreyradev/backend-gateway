# 🚀 Guía de Puesta en Marcha - Backend Gateway

Guía paso a paso para desplegar el Backend Gateway desde cero.

---

## 📋 Requisitos Previos

- ✅ [Deno](https://deno.land/) instalado (v1.40+)
- ✅ Acceso a un KV Storage (Deno KV o API compatible)
- ✅ Git instalado

---

## ⚡ Inicio Rápido (5 minutos)

### 1️⃣ Configurar Variables de Entorno

**Opción A: Variables en línea de comando** ⚡ (Recomendado - más rápido)

```bash
# Windows PowerShell - En cada comando
deno run -A scripts/register-user.ts --username admin --password admin123 `
  --registry-url https://tu-kv-storage.deno.dev `
  --api-key tu-api-key-secreta

# O establecer temporalmente para la sesión
$env:STORAGE_URL="https://tu-kv-storage.deno.dev"; $env:API_KEY="tu-api-key"; $env:ENCRYPTION_KEY="clave-32-chars-min"

# Linux/Mac - Variables inline
STORAGE_URL="https://tu-kv-storage.deno.dev" \
API_KEY="tu-api-key" \
ENCRYPTION_KEY="clave-32-chars-min" \
deno task dev
```

**Opción B: Configurar globalmente para la sesión**

```bash
# Windows PowerShell
$env:STORAGE_URL="https://tu-kv-storage.deno.dev"
$env:API_KEY="tu-api-key-secreta"
$env:ENCRYPTION_KEY="clave-de-32-caracteres-minimo-para-seguridad"

# Linux/Mac
export STORAGE_URL="https://tu-kv-storage.deno.dev"
export API_KEY="tu-api-key-secreta"
export ENCRYPTION_KEY="clave-de-32-caracteres-minimo-para-seguridad"
```

**Opción C: Archivo .env** (Persistente)

Crea un archivo `.env` en el directorio raíz (ver [.env.example](.env.example))

**Variables opcionales:**
```bash
PORT=8080                           # Puerto del gateway (default: 8080)
TOKEN_TTL_MS=3600000                # TTL de tokens en ms (default: 1 hora)
ALLOWED_ORIGINS=*                   # CORS origins (default: todos)
```

### 2️⃣ Registrar un Usuario Administrador

```bash
# Con variables en línea de comando
deno run -A scripts/register-user.ts \
  --username admin \
  --password admin123 \
  --email admin@example.com \
  --registry-url https://tu-kv-storage.deno.dev \
  --api-key tu-api-key

# O si ya configuraste las variables de entorno
deno run -A scripts/register-user.ts \
  --username admin \
  --password admin123 \
  --email admin@example.com
```

### 3️⃣ Registrar un Backend

```bash
# Con TODAS las variables en línea de comando
deno run -A scripts/register-backend.ts \
  --name=produccion \
  --prefix=/api \
  --backend-url=https://tu-api.com \
  --backend-token=token-del-backend \
  --registry-url=https://tu-kv-storage.deno.dev \
  --api-key=tu-api-key

# O si ya configuraste las variables de entorno
deno run -A scripts/regis (usa variables de entorno)
deno task dev

# Opción B: Manual con variables en línea (PowerShell)
$env:STORAGE_URL="https://kv.deno.dev"; $env:API_KEY="key"; $env:ENCRYPTION_KEY="32-chars-min"; deno serve --allow-net --allow-env src/simple-gateway.ts

# Opción C: Manual con variables en línea (Linux/Mac)
STORAGE_URL="https://kv.deno.dev" \
API_KEY="key" \
ENCRYPTION_KEY="32-chars-min" \tps://tu-api.com \
  --backend-token=token-del-backend
```

### 4️⃣ Iniciar el Gateway

```bash
# Opción A: Con deno task
deno task dev

# Opción B: Manual
deno serve --allow-net --allow-env src/simple-gateway.ts
```

### 5️⃣ Probar que Funciona

```bash
# Health check (sin autenticación)
curl http://localhost:8000/gateway/health

# Login
curl -X POST http://localhost:8000/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Guardar el token y usarlo
curl http://localhost:8000/api/endpoint \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

✅ **¡Gateway funcionando!**

---

## 🔧 Configuración Detallada

### Variables de Entorno Completas

> **Nota:** `STORAGE_URL` puede apuntar a **cualquier API que implemente la estructura KV requerida**. No necesita ser un servicio específico - puede ser Deno KV, tu propia API REST, o cualquier sistema compatible con las operaciones GET/POST/DELETE para almacenar datos en formato clave-valor.

| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `STORAGE_URL` | URL de cualquier API compatible con estructura KV | - | ✅ |
| `API_KEY` | API Key del KV Storage | - | ✅ |
| `ENCRYPTION_KEY` | Clave encriptación (32+ chars) | - | ✅ |
| `PORT` | Puerto del servidor | 8080 | ❌ |
| `TOKEN_TTL_MS` | TTL de tokens de auth | 3600000 | ❌ |
| `ALLOWED_ORIGINS` | CORS origins (separados por coma) | * | ❌ |

### Archivo .env.example

```bash
# KV Storage
STORAGE_URL=https://kv-storage-api.deno.dev
API_KEY=tu-api-key-secreta

# Seguridad
ENCRYPTION_KEY=clave-super-segura-de-al-menos-32-caracteres-aqui

# Servidor
PORT=8080
TOKEN_TTL_MS=3600000

# CORS
ALLOWED_ORIGINS=https://miapp.com,https://www.miapp.com
```

**Con parámetros en línea de comando:**

```bash
# Pasando TODO por línea de comando
deno run -A scripts/register-backend.ts \
  --name=desarrollo \
  --prefix=/dev \
  --backend-url=http://localhost:3000 \
  --backend-token=dev-token-123 \
  --registry-url=https://kv-storage.deno.dev \
  --api-key=tu-api-key \
  --encryption-key=clave-32-caracteres

# O usando variables de entorno ya configuradas
deno run -A scripts/register-backend.ts \
  --name=desarrollo \
  --prefix=/dev \
  --backend-url=http://localhost:3000 \
  --backend-token=dev-token-123
```

**Parámetros disponibles:**
- `--name` - Nombre del backend (requerido)
- `--prefix` - Prefijo de ruta (requerido)
- `--backend-url` - URL del backend (requerido)
- `--backend-token` - Token del backend (requerido)
- `--registry-url` - URL del KV Storage (opcional, usa env)
- `--api-key` - API Key (opcional, usa env)
- `--encryption-key` - Clave de encriptación (opcional, usa env)bash
deno run -A scripts/register-backend.ts \
  --name=desarrollo \
  --prefix=/dev \
  --backend-url=http://localhost:3000 \
  --backend-token=dev-token-123
```

### Ver Backends Registrados

```bash
# Opción A: Script
deno run -A scripts/check-backends.ts

**Con parámetros en línea de comando:**

```bash
# Pasando TODO por línea de comando
deno run -A scripts/register-user.ts \
  --username johndoe \
  --password securepass123 \
  --email john@example.com \
  --registry-url https://kv-storage.deno.dev \
  --api-key tu-api-key

# O usando variables de entorno
deno run -A scripts/register-user.ts \
  --username johndoe \
  --password securepass123 \
  --email john@example.com
```

**Parámetros disponibles:**
- `--username` - Nombre de usuario (requerido)
- `--password` - Contraseña (requerido)
- `--email` - Email (opcional)
- `--role` - Rol del usuario (opcional, default: user)
- `--registry-url` - URL del KV Storage (opcional, usa env)
- `--api-key` - API Key (opcional, usa env)
```bash
deno run -A scripts/delete-backend.ts --name=desarrollo
```

### Recargar Backends (sin reiniciar)

```bash
curl -X POST http://localhost:8000/gateway/reload
```

---

## 👥 Gestión de Usuarios

### Crear Usuario

```bash
deno run -A scripts/register-user.ts \
  --username johndoe \
  --password securepass123 \
  --email john@example.com
```

### Listar Usuarios

```bash
deno run -A scripts/register-user.ts --list
```

### Eliminar Usuario

```bash
deno run -A scripts/register-user.ts --delete johndoe
```

---

## 🧪 Testing

### Test Completo

```bash
# Test suite completo (incluye auth, proxy, etc.)
deno run -A scripts/test-general.ts
```

### Tests Específicos

```bash
# Solo autenticación
deno run -A scripts/test-auth.ts

# Solo gateway/proxy
deno run -A scripts/test-gateway.ts
```

### Desarrollo Local (Offline)

```bash
# Terminal 1: Mock KV Storage
deno run -A scripts/registry-server.ts

# Terminal 2: Gateway (apuntando al mock)
STORAGE_URL=http://localhost:8001 \
deno serve --allow-net --allow-env src/simple-gateway.ts
```

---

## 🚀 Deploy a Producción

### Opción 1: Deno Deploy (Recomendado)

1. **Push a GitHub**
   ```bash
   git add .
   git commit -m "Deploy gateway"
   git push origin main
   ```

2. **Conectar en Deno Deploy**
   - Ve a [dash.deno.com](https://dash.deno.com)
   - New Project → Link GitHub repo
   - Entry point: `main.ts` (auto-detectado)

3. **Configurar Variables de Entorno**
   - Settings → Environment Variables
   - Agregar: `STORAGE_URL`, `API_KEY`, `ENCRYPTION_KEY`

4. **¡Listo!** Tu gateway está en producción

### Opción 2: Servidor Propio

```bash
# Con PM2 o similar
deno task start

# O con systemd
sudo systemctl start backend-gateway
```

Ver [DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md) para más detalles.

---

## 📡 Endpoints Disponibles

### Públicos (sin autenticación)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/gateway/health` | GET | Health check |
| `/gateway/login` | POST | Autenticación |
| `/gateway/backends` | GET | Ver backends |
| `/gateway/reload` | POST | Recargar backends |

### Protegidos (requieren token)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/gateway` | GET | Info del gateway |
| `/gateway/logout` | POST | Cerrar sesión |

### Proxy (sin autenticación del gateway)

Cualquier ruta que coincida con un prefijo de backend será proxeada automáticamente:
- `/api/*` → Backend con prefix `/api`
- `/users/*` → Backend con prefix `/users`
- etc.

---

## 🔍 Troubleshooting

### Error: "Cannot find name 'Deno'"

❌ **Problema:** Error de TypeScript en el editor

✅ **Solución:** Es solo del editor, ignóralo. El código funciona correctamente con `deno run`.

### Error: "Configuration error"
### Con Variables de Entorno

```bash
# Configurar variables (una vez por sesión)
$env:STORAGE_URL="https://kv.deno.dev"
$env:API_KEY="tu-api-key"
$env:ENCRYPTION_KEY="clave-32-caracteres-min"

# Iniciar gateway
deno task dev

# Crear usuario
deno run -A scripts/register-user.ts --username admin --password pass

# Crear backend
deno run -A scripts/register-backend.ts --name=prod --prefix=/api --backend-url=https://api.com --backend-token=xxx

# Ver backends
deno run -A scripts/check-backends.ts
```

### Sin Variables de Entorno (Todo en Línea)

```bash
# Crear usuario (todo inline)
deno run -A scripts/register-user.ts \
  --username admin --password pass \
  --registry-url https://kv.deno.dev --api-key tu-api-key

# Crear backend (todo inline)
deno run -A scripts/register-backend.ts \
  --name=prod --prefix=/api \
  --backend-url=https://api.com --backend-token=xxx \
  --registry-url=https://kv.deno.dev --api-key=tu-api-key --encryption-key=clave-32-chars

# Iniciar gateway (todo inline - PowerShell)
$env:STORAGE_URL="https://kv.deno.dev"; $env:API_KEY="key"; $env:ENCRYPTION_KEY="32chars"; deno task dev
```

### HTTP Testing

```bash2. Revisa el puerto correcto (default: 8000 con `deno serve`)
3. Verifica firewall/antivirus

### Error: "Backend not found"

❌ **Problema:** No hay backends registrados

✅ **Solución:**
1. Registra al menos un backend con `register-backend.ts`
2. O recarga con: `curl -X POST http://localhost:8000/gateway/reload`

---

## 📚 Documentación Adicional

- **[README.md](../README.md)** - Introducción general
- **[ESQUEMA_PROYECTO.md](../ESQUEMA_PROYECTO.md)** - Arquitectura completa
- **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Detalles de autenticación
- **[TESTING.md](docs/TESTING.md)** - Guía de testing
- **[DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)** - Deploy avanzado
- **[src/lib/README.md](../src/lib/README.md)** - Arquitectura de módulos

---

## ⚡ Comandos Rápidos (Cheat Sheet)

```bash
# Iniciar gateway
deno task dev

# Crear usuario
deno run -A scripts/register-user.ts --username admin --password pass

# Crear backend
deno run -A scripts/register-backend.ts --name=prod --prefix=/api --backend-url=https://api.com --backend-token=xxx

# Ver backends
deno run -A scripts/check-backends.ts

# Test completo
deno run -A scripts/test-general.ts

# Login
curl -X POST http://localhost:8000/gateway/login -d '{"username":"admin","password":"pass"}'

# Health
curl http://localhost:8000/gateway/health

# Recargar
curl -X POST http://localhost:8000/gateway/reload
```

---

## 🆘 Soporte

- 📖 Lee la documentación en `/docs`
- 🐛 Reporta issues en GitHub
- 💬 Consulta el código en `/src`

---

**¡Feliz coding! 🚀**
