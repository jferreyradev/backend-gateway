# 🌐 Backend Gateway

Gateway API modular con autenticación y enrutamiento dinámico de backends.

**Versión 2.0** - Arquitectura refactorizada y optimizada

---

## 📚 Índice de Documentación

### 🎯 ¿Qué quieres hacer?

| Tu caso | Documentación |
|---------|---------------|
| **Entender el proyecto** | [docs/RESUMEN_EJECUTIVO.md](docs/RESUMEN_EJECUTIVO.md) |
| **Empezar rápido (desarrollo)** | [docs/QUICKSTART.md](docs/QUICKSTART.md) |
| **Registrar PCs remotas** | [docs/MINIMAL_INSTALL.md](docs/MINIMAL_INSTALL.md) |
| **Configurar múltiples PCs** | [docs/MULTI_PC_SETUP.md](docs/MULTI_PC_SETUP.md) |
| **Desplegar a producción** | [docs/DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md) |
| **Probar el gateway** | [docs/TESTING.md](docs/TESTING.md) |

### 📖 Guías Detalladas

<details>
<summary><strong>🚀 Inicio Rápido</strong></summary>

- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** - Guía completa paso a paso
- **[docs/RESUMEN_EJECUTIVO.md](docs/RESUMEN_EJECUTIVO.md)** - Overview del proyecto y casos de uso

</details>

<details>
<summary><strong>🖥️ PCs Remotas con IP Dinámica</strong></summary>

- **[docs/MINIMAL_INSTALL.md](docs/MINIMAL_INSTALL.md)** - Solo 2 archivos por PC
- **[docs/MULTI_PC_SETUP.md](docs/MULTI_PC_SETUP.md)** - Ejemplo 3 PCs completo
- **[setup-pc-daemon.md](setup-pc-daemon.md)** - Configuración daemon detallada

</details>

<details>
<summary><strong>🔧 Operaciones y Deploy</strong></summary>

- **[docs/REGISTER_BACKENDS.md](docs/REGISTER_BACKENDS.md)** - 3 métodos de registro
- **[docs/DEPLOY_GATEWAY.md](docs/DEPLOY_GATEWAY.md)** - Desplegar a Deno Deploy
- **[docs/TESTING.md](docs/TESTING.md)** - Cómo probar

</details>

---

---

## 🎯 Características

- 🔐 **Autenticación Bearer** con tokens temporales
- 🔄 **Proxy HTTP** automático a backends
- ⚡ **Caché inteligente** de backends
- 🌐 **Enrutamiento dinámico** por prefijos
- 🔒 **Encriptación AES-GCM** de tokens backend
- 📊 **IP pública dinámica** con verificación cada 30 min
- ☁️ **Deploy ready** para Deno Deploy
- 🏗️ **Arquitectura modular** TypeScript

---

## ⚡ Inicio Rápido (3 comandos)

### Desarrollo Local

```bash
# 1. Configurar variables (una sola vez)
$env:STORAGE_URL="https://kv-storage-api.deno.dev"
$env:API_KEY="tu-api-key"
$env:ENCRYPTION_KEY="clave-de-32-caracteres-minimo-segura"

# 2. Registrar backend
deno run -A scripts/register-backend.ts --name=prod --prefix=/api --backend-url=https://tu-api.com --backend-token=secret

# 3. Iniciar gateway
deno task dev
```

**📖 [Guía paso a paso →](docs/QUICKSTART.md)**

### PC Remota con IP Dinámica

```bash
# Opción 1: Ejecutar directamente (sin archivos locales)
export STORAGE_URL=https://tu-kv.deno.dev
export API_KEY=tu-api-key
export ENCRYPTION_KEY=clave-32-caracteres

deno run -A https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/scripts/register-backend-standalone.ts \
  --name=mi-pc --use-public-ip --backend-port=3000 \
  --backend-token=secret --daemon

# Opción 2: Usar archivos de ejemplo
cp register-daemon.example.sh register-daemon.sh  # Linux/Mac
copy register-daemon.example.bat register-daemon.bat  # Windows
# Editar variables y ejecutar
```

**📖 [Instalación mínima →](docs/MINIMAL_INSTALL.md)**

---

## 🔑 Variables de Entorno (3 obligatorias)

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `STORAGE_URL` | URL del KV Storage | ✅ |
| `API_KEY` | API Key del KV Storage | ✅ |
| `ENCRYPTION_KEY` | Encriptación AES-GCM (32+ chars) | ✅ |
| `PORT` | Puerto (default: 8080, ignorado en Deno Deploy) | ❌ |
| `TOKEN_TTL_MS` | TTL tokens usuario (default: 1h) | ❌ |
| `ALLOWED_ORIGINS` | CORS (default: *) | ❌ |

<details>
<summary><strong>🔐 ¿Para qué sirve ENCRYPTION_KEY?</strong></summary>

Los tokens de backends se almacenan **encriptados** (AES-GCM 256-bit) en el KV Storage:

```
PC → Encripta token → KV Storage
Gateway ← Desencripta token ← KV Storage → Envía a API backend
```

⚠️ **Debe ser idéntica** en todas las PCs que registran backends y en el gateway.

**[Más detalles →](docs/DEPLOY_GATEWAY.md)**

</details>

---

## 📦 Scripts Disponibles

```bash
# Desarrollo
deno task dev                    # Iniciar gateway
deno task check-backends         # Listar backends registrados

# Registro (3 métodos)
deno task register:simple nombre url token [prefix]   # Rápido
deno task register:bulk                                # Masivo (JSON)
deno run -A scripts/register-backend.ts --daemon       # Con daemon
```

**📖 [Ver todos los métodos →](docs/REGISTER_BACKENDS.md)**

---

---

## 🧪 Testing

```bash
deno run -A scripts/test-general.ts     # Test completo
deno run -A scripts/check-backends.ts   # Ver backends registrados
```

**📖 [Guía de testing →](docs/TESTING.md)**

---

## 🚀 Deploy a Producción

```bash
# Deno Deploy (recomendado)
1. Push a GitHub
2. Conectar en dash.deno.com
3. Configurar las 3 variables obligatorias
4. ¡Deploy automático!
```

**📖 [Guía completa de deploy →](docs/DEPLOY_GATEWAY.md)**

---

## 📡 Endpoints del Gateway

### Públicos
- `GET /gateway/health` - Health check
- `POST /gateway/login` - Autenticación

### Protegidos (requieren Bearer token)
- `<PREFIX>/*` - Proxy a backends registrados

---

## 🏗️ Arquitectura

```
PCs Remotas                Gateway (Deno Deploy)        Clientes
━━━━━━━━━━━━━━━           ━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━
PC 1: API :3000  ─┐                                   ┌─ Web App
PC 2: API :4000  ─┼─► KV Storage ◄─► Gateway ◄──────┼─ Mobile
PC 3: API :5000  ─┘     (registros)   (proxy)        └─ Otros
```

**[Ver resumen ejecutivo →](docs/RESUMEN_EJECUTIVO.md)**

---

## 📄 Licencia

MIT

---

## 🤝 Contribuir

Issues y PRs son bienvenidos. Ver [docs/CHECKLIST_PRE_PUBLICACION.md](docs/CHECKLIST_PRE_PUBLICACION.md) antes de contribuir.


---

## 🆘 Soporte

- 📖 [Guía de Inicio Rápido](QUICKSTART.md)
- 📚 [Documentación](docs/)
- 🐛 Reporta issues en GitHub

---

**¡Feliz coding! 🚀**
