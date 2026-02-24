# 🌐 Backend Gateway

Gateway API modular con autenticación y enrutamiento dinámico de backends.

**Versión 2.0** - Arquitectura refactorizada y optimizada

**📋 [Ver Resumen Ejecutivo del Proyecto →](RESUMEN_EJECUTIVO.md)**

---

## ⚡ Inicio Rápido

### Opción A: Desarrollo Local

```bash
# 1. Configurar variables
$env:STORAGE_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="tu-api-key"
$env:ENCRYPTION_KEY="clave-de-32-caracteres-minimo-segura"

# 2. Registrar usuario y backend
deno run -A scripts/register-user.ts --username admin --password admin123
deno run -A scripts/register-backend.ts --name=prod --prefix=/api --backend-url=https://tu-api.com --backend-token=secret

# 3. Iniciar gateway
deno task dev
```

**📖 [Ver Guía Completa →](QUICKSTART.md)**

### Opción B: PCs Remotas con IP Pública Dinámica

Para registrar APIs desde PCs con IP pública que puede cambiar:

```bash
# Solo necesitas 2 archivos en cada PC
# 1. Descarga start-daemon-minimal.bat
# 2. Edita las credenciales
# 3. Ejecuta (doble-click)
```

**📖 [Ver Instalación Mínima para PCs →](docs/MINIMAL_INSTALL.md)**

---

## 🎯 Características

- 🔐 **Autenticación Bearer** con tokens temporales
- 🔄 **Proxy HTTP** automático a backends
- ⚡ **Caché inteligente** de backends
- 🌐 **Enrutamiento dinámico** por prefijos
- 🔒 **Encriptación** AES-GCM de tokens
- 📊 **Monitoreo** y health checks
- ☁️ **Deploy ready** para Deno Deploy
- 🏗️ **Arquitectura modular** v2.0

---

## 🎯 Uso Básico

### Login
```bash
curl -X POST http://localhost:8000/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Usar con Token
```bash
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer TU_TOKEN"
```

### Health Check
```bash
curl http://localhost:8000/gateway/health
```

---

## 📁 Estructura v2.0

```
src/
├── simple-gateway.ts       # 🚀 Gateway principal (272 líneas)
└── lib/                    # 📚 Módulos
    ├── types.ts           # Interfaces TypeScript
    ├── config.ts          # Configuración centralizada
    ├── crypto.ts          # Encriptación AES-GCM
    ├── auth.ts            # Autenticación y tokens
    ├── backends.ts        # Gestión de backends
    └── middleware.ts      # CORS, headers, HTTP

scripts/                    # 🛠️ Utilidades
├── register-backend.ts    # Registrar backends
├── register-user.ts       # Gestionar usuarios
├── delete-backend.ts      # Eliminar backends
└── test-*.ts              # Tests

docs/                       # 📚 Documentación
└── *.md                   # Guías detalladas
```

---

## 📚 Documentación

### 🚀 Para Empezar
- **[QUICKSTART.md](QUICKSTART.md)** - Guía completa paso a paso
- **[MINIMAL_INSTALL.md](docs/MINIMAL_INSTALL.md)** - Instalación mínima para PCs remotas (2 archivos)

### 🖥️ Configuración de PCs Remotas
- **[MULTI_PC_SETUP.md](docs/MULTI_PC_SETUP.md)** - Configurar múltiples PCs con IP dinámica
- **[setup-pc-daemon.md](setup-pc-daemon.md)** - Daemon para registro automático

### 🔧 Operaciones
- **[REGISTER_BACKENDS.md](docs/REGISTER_BACKENDS.md)** - Cómo registrar backends (3 métodos)
- **[DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)** - Desplegar a Deno Deploy
- **[TESTING.md](docs/TESTING.md)** - Cómo probar el gateway

### 📦 Scripts Disponibles

**Para desarrollo local:**
```bash
deno task dev              # Iniciar gateway en modo desarrollo
deno task check-backends   # Listar backends registrados
```

**Para registrar backends:**
```bash
# Método 1: Simple (pocos argumentos)
deno task register:simple nombre url token [prefix] [port]

# Método 2: Bulk (desde JSON)
deno task register:bulk

# Método 3: Completo (con daemon)
deno run -A scripts/register-backend.ts --name=... --daemon
```

**Para PCs remotas:**
- Descarga `start-daemon-minimal.bat` (Windows)
- O usa `register-backend-standalone.ts` (multiplataforma)

---

## 🔑 Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `STORAGE_URL` | URL del KV Storage | ✅ |
| `API_KEY` | API Key del KV Storage | ✅ |
| `ENCRYPTION_KEY` | Clave encriptación (32+ chars) | ✅ |
| `PORT` | Puerto del gateway (default: 8080) | ❌ |
| `TOKEN_TTL_MS` | TTL tokens (default: 3600000) | ❌ |
| `ALLOWED_ORIGINS` | CORS origins (default: *) | ❌ |

Ver [.env.example](.env.example) para más opciones.

---

## 🧪 Testing

```bash
# Test completo
deno run -A scripts/test-general.ts

# Tests específicos  
deno run -A scripts/test-auth.ts       # Autenticación
deno run -A scripts/test-gateway.ts    # Gateway/Proxy

# Ver backends
deno run -A scripts/check-backends.ts
```

---

## 🚀 Deploy

### Deno Deploy (Recomendado)

```bash
# 1. Push a GitHub
git push origin main

# 2. Conectar en dash.deno.com
# 3. Configurar variables de entorno
# 4. ¡Listo!
```

### Servidor Propio

```bash
deno task start
```

**📖 [Guía de Deploy Completa →](docs/DEPLOY_GATEWAY.md)**

---

## 📡 Endpoints

### Públicos (sin autenticación)
- `GET /gateway/health` - Health check
- `POST /gateway/login` - Autenticación
- `GET /gateway/backends` - Ver backends
- `POST /gateway/reload` - Recargar backends

### Protegidos (requieren token)
- `GET /gateway` - Info del gateway
- `POST /gateway/logout` - Cerrar sesión

### Proxy (sin autenticación del gateway)
- Cualquier ruta que coincida con un prefijo de backend

---

## 📚 Documentación

- **[QUICKSTART.md](QUICKSTART.md)** - 🚀 Guía completa de inicio
- **[docs/REGISTER_BACKENDS.md](docs/REGISTER_BACKENDS.md)** - 📝 Registro de backends
- **[docs/DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)** - ☁️ Deploy en producción
- **[docs/TESTING.md](docs/TESTING.md)** - 🧪 Testing
- **[src/lib/README.md](src/lib/README.md)** - 📦 Arquitectura modular

---

## ⚡ Comandos Rápidos

```bash
# Desarrollo
deno task dev                    # Iniciar gateway
deno task registry               # Mock KV Storage (offline)

# Gestión
deno task register              # Registrar backend
deno task register:user         # Registrar usuario
deno task delete                # Eliminar backend
deno task check                 # Ver backends

# Testing
deno task test                  # Test completo
deno task test:auth             # Test autenticación
deno task test:gateway          # Test gateway
```

---

## 🆘 Soporte

- 📖 [Guía de Inicio Rápido](QUICKSTART.md)
- 📚 [Documentación](docs/)
- 🐛 Reporta issues en GitHub

---

**¡Feliz coding! 🚀**
