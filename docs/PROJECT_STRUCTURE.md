# 📂 Estructura del Proyecto

```
backend-gateway/
│
├── 📁 src/                         # Código fuente principal
│   ├── gateway-server.ts           # ⭐ Gateway principal con autenticación
│   └── registry-server.ts          # Servidor de registro local (desarrollo)
│
├── 📁 scripts/                     # Scripts y utilidades
│   ├── register-backend.ts         # Registrar backends en el KV storage
│   ├── test-general.ts             # ⭐ Test completo del sistema (13 tests)
│   ├── test-auth.ts                # Test específico de autenticación
│   ├── test-kv.ts                  # Test de conexión al KV storage
│   └── check-backends.ts           # Verificar estado de backends
│
├── 📁 docs/                        # Documentación
│   ├── AUTHENTICATION.md           # Guía completa de autenticación
│   ├── DEPLOY_DENO.md              # Instrucciones para Deno Deploy
│   └── QUICKSTART.md               # Guía de inicio rápido
│
├── 📄 README.md                    # ⭐ Documentación principal
├── 📄 deno.json                    # Configuración y tareas de Deno
├── 📄 .env.example                 # Variables de entorno de ejemplo
├── 📄 .gitignore                   # Archivos ignorados por Git
└── 📄 backends.json                # Datos para servidor local
```

## 🎯 Archivos Principales

### Gateway Principal
- **`src/gateway-server.ts`** - Gateway con autenticación Bearer, enrutamiento, balanceo de carga y proxy a backends

### Tests
- **`scripts/test-general.ts`** - Test completo (13 pruebas):
  - ✅ Endpoints públicos
  - ✅ Seguridad y autenticación
  - ✅ Endpoints protegidos
  - ✅ Validación de respuestas
  - ✅ Manejo de errores

### Utilidades
- **`scripts/register-backend.ts`** - CLI para registrar nuevos backends
- **`src/registry-server.ts`** - Servidor local para desarrollo

## 🚀 Comandos Rápidos

```bash
# Desarrollo
deno task dev              # Iniciar gateway
deno task test             # Ejecutar todos los tests
deno task test:auth        # Test de autenticación
deno task register         # Registrar backend

# Producción
deno task start            # Iniciar en producción
```

## 📊 Características

✅ **Código simplificado** - 471 líneas (reducido 66%)  
✅ **Autenticación segura** - Tokens Bearer temporales  
✅ **Tests completos** - 13 pruebas automatizadas  
✅ **Organizado** - Estructura clara por carpetas  
✅ **Documentado** - Guías detalladas en `/docs`  
✅ **Ready for Deploy** - Compatible con Deno Deploy  

## 🔄 Flujo de Trabajo

1. **Configurar** → Editar variables de entorno
2. **Iniciar** → `deno task dev`
3. **Registrar backends** → `deno task register`
4. **Autenticarse** → POST `/gateway/login`
5. **Usar** → Proxy automático con token Bearer
6. **Verificar** → `deno task test`
