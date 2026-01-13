# 📋 Resumen del Sistema de Gateway

Este sistema consta de **3 componentes** que trabajan juntos para crear un gateway API con autenticación y enrutamiento dinámico.

---

## 🚪 **1. simple-gateway.ts** (Gateway Principal)

Actúa como **proxy inverso** que enruta peticiones a diferentes backends según su prefijo de ruta, con autenticación de usuarios.

### Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `8080` | Puerto donde escucha el gateway |
| `BACKENDS_REGISTRY_URL` | `https://kv-storage-api.deno.dev` | URL del KV storage donde están registrados backends y usuarios |
| `API_KEY` | `desarrollo-api-key-2026` | API Key para autenticarse con el KV storage |
| `TOKEN_TTL_MS` | `3600000` (1 hora) | Tiempo de vida de tokens de sesión de usuarios |
| `ENCRYPTION_KEY` | `go-oracle-api-secure-key-2026` | Clave para desencriptar tokens de backend |

### Funcionalidades Principales

- **Autenticación de Usuarios**: Valida credenciales contra KV storage y genera tokens Bearer
- **Gestión de Sesiones**: Maneja tokens con expiración automática y limpieza
- **Enrutamiento Dinámico**: Redirige peticiones a backends según prefijos registrados
- **Caché de Backends**: Carga backends desde KV storage al inicio y bajo demanda
- **Desencriptación de Tokens**: Desencripta tokens de backend con AES-GCM antes de hacer proxy
- **Auto-recarga**: Si no encuentra un backend, recarga la configuración automáticamente

### Endpoints Públicos (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/gateway/login` | Obtener token de autenticación. Body: `{username, password}` |
| `GET` | `/gateway/health` | Estado del gateway y número de backends |
| `POST` | `/gateway/reload` | Forzar recarga de backends desde KV storage |
| `OPTIONS` | `*` | Soporte CORS |

### Endpoints Protegidos (requieren token Bearer)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` o `/gateway` | Información del gateway, backends y endpoints |
| `GET` | `/gateway/backends` | Lista detallada de backends registrados |
| `GET` | `/gateway/users` | Lista de usuarios (sin contraseñas) |
| `POST` | `/gateway/logout` | Invalidar token actual |
| `*` | `/{prefix}/*` | Proxy a backend correspondiente según prefijo |

### Flujo de Autenticación

```mermaid
sequenceDiagram
    Usuario->>Gateway: POST /gateway/login {username, password}
    Gateway->>KV Storage: Validar credenciales
    KV Storage-->>Gateway: passwordHash
    Gateway->>Gateway: Comparar hash SHA-256
    Gateway-->>Usuario: {token, expiresIn: 3600}
    Usuario->>Gateway: GET /prod/api/data (Bearer token)
    Gateway->>Gateway: Validar token
    Gateway->>Backend: GET /api/data (Bearer backend-token)
    Backend-->>Gateway: Respuesta
    Gateway-->>Usuario: Respuesta + headers X-Proxied-By
```

### Proceso de Proxy

1. **Validación**: Verifica token de usuario (excepto rutas públicas)
2. **Búsqueda**: Encuentra backend por prefijo más largo que coincida
3. **Transformación**: Remueve prefijo de la URL
4. **Desencriptación**: Desencripta token del backend (AES-GCM)
5. **Proxy**: Envía petición al backend con su token
6. **Respuesta**: Retorna respuesta con headers adicionales

---

## 🔧 **2. register-backend.ts** (Registro de Backends)

Script para **registrar backends** en el KV storage. Los backends son servicios que recibirán las peticiones proxy-eadas.

### Argumentos CLI

| Argumento | Requerido | Descripción |
|-----------|-----------|-------------|
| `--name` | ✅ | Identificador único del backend (ej: `produccion`, `desarrollo`) |
| `--backend-url` | ⚠️ | URL del backend (ej: `http://10.6.46.114:3013`) - requerido sin `--use-public-ip` |
| `--backend-token` | ✅ | Token Bearer que el backend espera recibir |
| `--prefix` | ✅ | Prefijo de ruta para enrutamiento (ej: `/prod`, `/desa`) |
| `--registry-url` | ✅ | URL del KV storage API |
| `--api-key` | ✅ | API Key del KV storage |
| `--use-public-ip` | ❌ | Usar IP pública en lugar de `--backend-url` |
| `--backend-port` | ⚠️ | Puerto local (requerido con `--use-public-ip`) |
| `--encryption-key` | ❌ | Clave para encriptar el token del backend |
| `--daemon` | ❌ | Ejecutar en modo continuo (re-registra cada 5 minutos) |

### Variables de Entorno Alternativas

```bash
BACKEND_NAME          # --name
BACKEND_URL           # --backend-url
BACKEND_TOKEN         # --backend-token
BACKEND_PREFIX        # --prefix
BACKENDS_REGISTRY_URL # --registry-url
API_KEY               # --api-key
PORT                  # --backend-port
ENCRYPTION_KEY        # --encryption-key
```

### ¿Qué hace?

1. **Valida configuración**: Verifica que todos los parámetros requeridos estén presentes
2. **Detecta IP pública**: Si `--use-public-ip`, obtiene IP de https://api.ipify.org
3. **Encripta el token**: Usa AES-GCM-256 + PBKDF2 (100,000 iteraciones)
4. **Registra/Actualiza**: 
   - GET primero para verificar si existe
   - PUT si existe (actualización)
   - POST si no existe (creación)
5. **Guarda metadata**: Timestamp, hostname, SO, arquitectura, versión Deno, IP pública
6. **Modo Daemon**: Re-registra cada 5 minutos (útil para IPs dinámicas o health checks)

### Formato de Datos Guardados

```json
{
  "key": "produccion",
  "data": {
    "name": "produccion",
    "url": "http://10.6.46.114:3013",
    "token": "base64-encrypted-token...",
    "prefix": "/prod"
  },
  "metadata": {
    "registeredAt": "2026-01-13T10:30:00.000Z",
    "lastUpdate": "2026-01-13T10:30:00.000Z",
    "system": {
      "hostname": "servidor-prod",
      "os": "linux",
      "arch": "x86_64",
      "denoVersion": "1.40.0",
      "publicIP": "203.0.113.45"
    }
  }
}
```

### Ejemplo de Uso

```bash
# Registro simple
deno run -A src/register-backend.ts \
  --name=produccion \
  --backend-url=http://api.prod.local:3000 \
  --backend-token=secret-prod-token-xyz \
  --prefix=/prod \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=desarrollo-api-key-2026

# Con IP pública y modo daemon
deno run -A src/register-backend.ts \
  --name=desarrollo \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=dev-token-123 \
  --prefix=/desa \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=desarrollo-api-key-2026 \
  --daemon
```

---

## 👤 **3. register-user.ts** (Gestión de Usuarios)

Script para **registrar, listar y eliminar usuarios** que podrán autenticarse en el gateway.

### Argumentos CLI

| Argumento (Alias) | Descripción |
|-------------------|-------------|
| `-u, --username` | Nombre de usuario (solo letras, números, guiones y guiones bajos) |
| `-p, --password` | Contraseña (mínimo 6 caracteres) |
| `-r, --roles` | Roles separados por coma (default: `user`) |
| `--registry-url` | URL del KV storage API |
| `--api-key` | API Key del KV storage |
| `-l, --list` | Listar todos los usuarios existentes |
| `-d, --delete` | Eliminar usuario por nombre |
| `-h, --help` | Mostrar ayuda |

### Variables de Entorno

```bash
BACKENDS_REGISTRY_URL  # URL del registry
API_KEY                # API Key
```

### ¿Qué hace?

#### **Registrar Usuario**
1. **Valida formato**: Username alfanumérico, password mínimo 6 caracteres
2. **Hashea password**: SHA-256 del password
3. **Guarda en KV storage**: Colección `users` con key = username
4. **Incluye metadata**: Roles y timestamp de creación

#### **Listar Usuarios**
- Obtiene todos los usuarios de la colección `users`
- Muestra: username, roles, fecha de creación

#### **Eliminar Usuario**
- DELETE del usuario especificado

### Formato de Datos de Usuario

```json
{
  "username": "admin",
  "passwordHash": "base64-sha256-hash...",
  "roles": ["admin", "user"],
  "createdAt": "2026-01-13T10:15:00.000Z"
}
```

### Ejemplos de Uso

```bash
# Registrar usuario básico
deno run -A src/register-user.ts \
  --username john \
  --password secret123

# Registrar admin
deno run -A src/register-user.ts \
  --username admin \
  --password admin123 \
  --roles admin,user

# Listar usuarios
deno run -A src/register-user.ts --list

# Eliminar usuario
deno run -A src/register-user.ts --delete john

# Con URL personalizada
deno run -A src/register-user.ts \
  --username maria \
  --password pass456 \
  --registry-url https://mi-api.com \
  --api-key mi-api-key
```

### Validaciones

- **Username**: `^[a-zA-Z0-9_-]+$` (solo alfanuméricos, guiones y guiones bajos)
- **Password**: Mínimo 6 caracteres
- **Roles**: String separado por comas, se divide en array

---

## 🔄 **Flujo de Trabajo Completo**

### 1️⃣ Preparación del Sistema

```bash
# A) Registrar Backend de Producción
deno run -A src/register-backend.ts \
  --name=produccion \
  --backend-url=http://api.prod.local:3000 \
  --backend-token=secret-prod-token \
  --prefix=/prod \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=desarrollo-api-key-2026

# B) Registrar Backend de Desarrollo
deno run -A src/register-backend.ts \
  --name=desarrollo \
  --backend-url=http://localhost:3001 \
  --backend-token=dev-token-123 \
  --prefix=/desa \
  --registry-url=https://kv-storage-api.deno.dev \
  --api-key=desarrollo-api-key-2026

# C) Registrar Usuarios
deno run -A src/register-user.ts \
  --username admin \
  --password admin123 \
  --roles admin,user

deno run -A src/register-user.ts \
  --username developer \
  --password dev456 \
  --roles user
```

### 2️⃣ Iniciar Gateway

```bash
# Desarrollo local
deno run -A src/simple-gateway.ts

# Con variables de entorno personalizadas
PORT=8000 \
BACKENDS_REGISTRY_URL=https://kv-storage-api.deno.dev \
API_KEY=desarrollo-api-key-2026 \
TOKEN_TTL_MS=7200000 \
deno run -A src/simple-gateway.ts
```

### 3️⃣ Uso por Cliente

```bash
# 1. Login
curl -X POST http://localhost:8080/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Respuesta:
# {
#   "token": "abc123xyz...",
#   "expiresIn": 3600,
#   "tokenType": "Bearer"
# }

# 2. Consultar información del gateway
curl http://localhost:8080/gateway \
  -H "Authorization: Bearer abc123xyz..."

# 3. Hacer petición a backend de producción
curl http://localhost:8080/prod/api/usuarios \
  -H "Authorization: Bearer abc123xyz..."
# Gateway proxy a: http://api.prod.local:3000/api/usuarios
# Con header: Authorization: Bearer secret-prod-token

# 4. Hacer petición a backend de desarrollo
curl http://localhost:8080/desa/api/test \
  -H "Authorization: Bearer abc123xyz..."
# Gateway proxy a: http://localhost:3001/api/test
# Con header: Authorization: Bearer dev-token-123

# 5. Logout
curl -X POST http://localhost:8080/gateway/logout \
  -H "Authorization: Bearer abc123xyz..."
```

---

## 🔑 **Características de Seguridad**

### Encriptación de Tokens de Backend

**Algoritmo**: AES-GCM-256 con PBKDF2

```typescript
// Proceso de Encriptación (register-backend.ts)
1. Generar salt aleatorio (16 bytes)
2. Derivar clave con PBKDF2:
   - Salt: 16 bytes aleatorios
   - Iteraciones: 100,000
   - Hash: SHA-256
   - Longitud: 256 bits
3. Generar IV aleatorio (12 bytes)
4. Encriptar con AES-GCM
5. Concatenar: salt + iv + datos encriptados
6. Codificar en Base64

// Proceso de Desencriptación (simple-gateway.ts)
1. Decodificar de Base64
2. Extraer salt (16 bytes), iv (12 bytes) y datos
3. Derivar clave con mismo PBKDF2
4. Desencriptar con AES-GCM
5. Usar token desencriptado en petición a backend
```

### Hash de Passwords

**Algoritmo**: SHA-256

```typescript
// register-user.ts y simple-gateway.ts
1. Codificar password en UTF-8
2. Aplicar SHA-256
3. Codificar resultado en Base64
4. Guardar en KV storage

// Validación en login
1. Usuario envía password en texto plano
2. Gateway hashea con SHA-256
3. Compara con hash guardado
4. Si coincide, genera token de sesión
```

### Tokens de Sesión

**Características**:
- Generados con `crypto.getRandomValues()` (32 bytes)
- Codificados en Base64 (sin +, /, =)
- Almacenados en memoria del gateway
- TTL configurable (default: 1 hora)
- Limpieza automática de tokens expirados

### Validación de Tokens

```typescript
// Headers requeridos para endpoints protegidos
Authorization: Bearer <token>

// Validación
1. Extraer token del header
2. Buscar en Map de tokens activos
3. Verificar expiración
4. Si expiró, eliminar y rechazar
5. Si válido, permitir acceso
```

---

## 📊 **Diagrama de Arquitectura**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cliente / Usuario                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    1. POST /gateway/login
                    2. Bearer token en requests
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Simple Gateway (8080)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Valida token de usuario                                │  │
│  │ • Encuentra backend por prefijo                          │  │
│  │ • Desencripta token de backend                           │  │
│  │ • Proxy request con token desencriptado                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────┬────────────────────────────────────┬────────────────────┘
        │                                    │
        │                                    │
        ▼                                    ▼
┌─────────────────┐              ┌──────────────────────┐
│  KV Storage API │              │   Backend Services   │
│                 │              │                      │
│ • users/        │              │ • /prod → api:3000  │
│ • backend/      │              │ • /desa → api:3001  │
│                 │              │                      │
│ Collections:    │              │ Autenticación:       │
│  ├─ users       │              │   Bearer backend-    │
│  └─ backend     │              │   token (decrypt)    │
└─────────────────┘              └──────────────────────┘
        ▲                                    ▲
        │                                    │
        │ 3. Registro                        │ 4. Health checks
        │    periódico                       │    (opcional daemon)
        │                                    │
┌───────┴────────────────────────────────────┴────────────────────┐
│                  Scripts de Administración                       │
│  ┌────────────────────────┐   ┌──────────────────────────┐     │
│  │  register-backend.ts   │   │   register-user.ts       │     │
│  │  • Encripta tokens     │   │   • Hashea passwords     │     │
│  │  • Registra backends   │   │   • Gestiona usuarios    │     │
│  │  • Modo daemon         │   │   • CRUD operaciones     │     │
│  └────────────────────────┘   └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 **Casos de Uso**

### Caso 1: Múltiples Ambientes

```bash
# Backend Producción
register-backend --name=prod --prefix=/prod --backend-url=...

# Backend Staging
register-backend --name=staging --prefix=/staging --backend-url=...

# Backend Desarrollo
register-backend --name=dev --prefix=/dev --backend-url=...

# Cliente accede:
# - https://gateway.com/prod/api/users    → Backend Producción
# - https://gateway.com/staging/api/users → Backend Staging
# - https://gateway.com/dev/api/users     → Backend Desarrollo
```

### Caso 2: IPs Dinámicas

```bash
# Backend con IP dinámica (modo daemon)
register-backend \
  --name=home-server \
  --use-public-ip \
  --backend-port=3000 \
  --prefix=/home \
  --daemon  # Re-registra cada 5 minutos con nueva IP
```

### Caso 3: Microservicios

```bash
# Servicio de Usuarios
register-backend --name=users-svc --prefix=/api/users --backend-url=...

# Servicio de Productos
register-backend --name=products-svc --prefix=/api/products --backend-url=...

# Servicio de Pedidos
register-backend --name=orders-svc --prefix=/api/orders --backend-url=...

# Gateway enruta automáticamente según prefijo
```

---

## 🛠️ **Troubleshooting**

### Problema: "No backend found"

```bash
# Verificar backends registrados
curl http://localhost:8080/gateway/backends \
  -H "Authorization: Bearer <token>"

# Forzar recarga
curl -X POST http://localhost:8080/gateway/reload
```

### Problema: "Unauthorized" en backend

```bash
# El token puede estar mal encriptado/desencriptado
# Verificar que ENCRYPTION_KEY sea la misma en:
# - register-backend.ts (encriptación)
# - simple-gateway.ts (desencriptación)
```

### Problema: "Invalid credentials" en login

```bash
# Listar usuarios
deno run -A src/register-user.ts --list

# Verificar que el usuario existe y password es correcta
# El hash debe coincidir exactamente
```

---

## 📝 **Notas Importantes**

1. **Tokens de Backend**: Se encriptan con AES-GCM antes de guardar en KV storage por seguridad
2. **Passwords de Usuario**: Se hashean con SHA-256 (considerar bcrypt para producción)
3. **CORS**: Configurable mediante `ALLOWED_ORIGINS` (default: `*`)
4. **Prefijos**: El matching usa el prefijo más largo que coincida
5. **Recarga Automática**: Si no encuentra un backend, recarga automáticamente antes de fallar
6. **Metadata**: Los backends guardan información del sistema para debugging
7. **Modo Daemon**: Útil para mantener backends actualizados o con IPs dinámicas

---

## 💡 **Mejoras Futuras**

Para recomendaciones detalladas de mejoras y nuevas funcionalidades, consulta:
- **[MEJORAS_IMPLEMENTADAS.md](MEJORAS_IMPLEMENTADAS.md)** - Mejoras ya implementadas
- Issues en el repositorio para propuestas de la comunidad

**Prioridades sugeridas:**
1. 🔴 Bcrypt para passwords (Seguridad crítica)
2. 🔴 Rate limiting en login (Seguridad crítica)
3. 🟡 Health checks reales de backends (Confiabilidad)

---

**Fecha de Documentación**: 13 de enero de 2026
