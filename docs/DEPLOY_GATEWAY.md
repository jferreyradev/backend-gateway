# Desplegar Gateway en Deno Deploy

Guía para desplegar el gateway proxy en Deno Deploy.

## 📋 Requisitos Previos

1. Cuenta en [Deno Deploy](https://dash.deno.com/)
2. Registry Server accesible públicamente (no puede ser localhost)
3. Backends registrados con URLs públicas

---

## 🚀 Opción 1: Deploy desde GitHub

### 1. Preparar el repositorio

```bash
# Crear repositorio en GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/backend-gateway.git
git push -u origin main
```

### 2. Crear proyecto en Deno Deploy

1. Ve a [dash.deno.com](https://dash.deno.com/)
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub"**
4. Autoriza acceso a tu repositorio
5. Selecciona el repositorio `backend-gateway`
4. **Entry Point**: `src/simple-gateway.ts` (para desarrollo) o `src/gateway-server.ts` (con autenticación)
7. Click en **"Deploy Project"**

### 3. Configurar Variables de Entorno

En el dashboard del proyecto:

1. Ve a **Settings** → **Environment Variables**
2. Agrega las siguientes variables:

```
BACKENDS_REGISTRY_URL=https://tu-registry.deno.dev
API_KEY=tu-api-key-secreta
CACHE_TTL_MS=30000
```

3. Click en **"Save"**

El proyecto se redespliegará automáticamente.

---

## 🚀 Opción 2: Deploy con `deployctl`

### 1. Instalar deployctl

```bash
deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts
```

### 2. Deploy desde línea de comandos

```bash
# Simple Gateway (sin autenticación)
deployctl deploy \
  --project=mi-gateway \
  --env=BACKENDS_REGISTRY_URL=https://tu-registry.deno.dev \
  --env=API_KEY=tu-api-key-secreta \
  --env=CACHE_TTL_MS=30000 \
  src/simple-gateway.ts

# Gateway con autenticación
deployctl deploy \
  --project=mi-gateway-auth \
  --env=BACKENDS_REGISTRY_URL=https://tu-registry.deno.dev \
  --env=API_KEY=tu-api-key-secreta \
  src/gateway-server.ts
```

---

## 🔧 Configuración del Registry

El **Registry Server también debe estar en Deno Deploy** o en un servidor público.

### Desplegar Registry en Deno Deploy

1. Modifica `registry-server.ts` para usar Deno KV en lugar de archivo:

```typescript
// Usar Deno KV (automático en Deno Deploy)
const kv = await Deno.openKv();

async function loadBackends(): Promise<Record<string, unknown>> {
  const backends: Record<string, unknown> = {};
  const entries = kv.list({ prefix: ["backend"] });
  
  for await (const entry of entries) {
    const key = (entry.key as string[])[1];
    backends[key] = entry.value;
  }
  
  return backends;
}

async function saveBackend(name: string, data: unknown): Promise<void> {
  await kv.set(["backend", name], data);
}
```

2. Despliega el registry:

```bash
deployctl deploy \
  --project=mi-registry \
  --env=API_KEY=tu-api-key-secreta \
  src/registry-server-kv.ts
```

---

## 🔐 Configurar Backends

Los backends deben tener URLs públicas (no localhost):

```bash
deno run -A scripts/register-backend.ts \
  --name=produccion \
  --backend-url=https://api.miservicio.com \
  --backend-token=token-secreto \
  --prefix=/api/prod \
  --registry-url=https://mi-registry.deno.dev \
  --api-key=tu-api-key-secreta
```

---

## 🧪 Probar el Gateway Desplegado

### Usando curl

```bash
# Health check
curl https://mi-gateway.deno.dev/gateway/health

# Ver backends configurados
curl https://mi-gateway.deno.dev/

# Probar ruta del backend
curl https://mi-gateway.deno.dev/api/prod/users
```

### Usando el script de prueba

```bash
deno run --allow-net scripts/test-gateway.ts https://mi-gateway.deno.dev
```

---

## 📊 Monitoreo

En el dashboard de Deno Deploy puedes ver:

- **Logs en tiempo real** - Tab "Logs"
- **Métricas** - Requests, errores, latencia
- **Uso de recursos** - CPU, memoria
- **Dominios personalizados** - Configurar tu propio dominio

---

## 🔄 Actualizaciones Automáticas

### Con GitHub Integration

Cada push a la rama `main` desplegará automáticamente la nueva versión.

```bash
git add src/gateway-deploy.ts
git commit -m "Update gateway"
git push
```

Deno Deploy detectará el cambio y desplegará en ~10 segundos.

---

## 💡 Mejores Prácticas

### 1. Usar Secrets para credenciales

En lugar de variables de entorno normales, usa **secrets**:

```bash
deployctl deploy \
  --project=mi-gateway \
  --env=BACKENDS_REGISTRY_URL=https://registry.deno.dev \
  --prod
```

Luego configura `API_KEY` como secret en el dashboard.

### 2. Configurar caché apropiado

```bash
# Caché de 1 minuto para desarrollo
CACHE_TTL_MS=60000

# Caché de 5 minutos para producción
CACHE_TTL_MS=300000
```

### 3. Usar dominio personalizado

En el dashboard:
1. Settings → Domains
2. Add Domain
3. Sigue las instrucciones para configurar DNS

### 4. Configurar límites de rate

Usa Deno Deploy KV para implementar rate limiting:

```typescript
const rateLimiter = await Deno.openKv();

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = ["ratelimit", ip];
  const result = await rateLimiter.get(key);
  
  if (!result.value) {
    await rateLimiter.set(key, 1, { expireIn: 60000 }); // 1 minuto
    return true;
  }
  
  const count = result.value as number;
  if (count > 100) return false; // 100 requests por minuto
  
  await rateLimiter.set(key, count + 1, { expireIn: 60000 });
  return true;
}
```

---

## 🐛 Troubleshooting

### El gateway no carga backends

**Problema**: Error al conectar al registry

**Solución**:
1. Verifica que `BACKENDS_REGISTRY_URL` sea una URL pública (https://)
2. Verifica que el registry esté desplegado y respondiendo
3. Revisa los logs en Deno Deploy

### Error 502 al proxy

**Problema**: Backend no responde

**Solución**:
1. Verifica que la URL del backend sea pública y accesible
2. Verifica que el token del backend sea correcto
3. Revisa los logs del backend

### Variables de entorno no funcionan

**Problema**: El gateway no lee las variables

**Solución**:
1. Verifica que las variables estén configuradas en Settings → Environment Variables
2. Redeploy el proyecto después de cambiar variables
3. Las variables no se leen de archivos .env en Deno Deploy

---

## 📚 Recursos

- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Deno KV Guide](https://deno.com/kv)
- [deployctl CLI](https://deno.land/x/deploy)
- [Deno Deploy Pricing](https://deno.com/deploy/pricing)

---

## 💰 Costos

**Deno Deploy Free Tier** incluye:
- 100,000 requests/día
- 100 GB bandwidth/mes
- 1 GB de Deno KV storage
- Edge deployment global

Para más, ver [pricing](https://deno.com/deploy/pricing).

---

## 🔐 Seguridad

### Recomendaciones:

1. **Nunca** commitear API keys en el código
2. Usar secrets para credenciales sensibles
3. Configurar CORS apropiadamente
4. Implementar rate limiting
5. Usar HTTPS siempre (automático en Deno Deploy)
6. Rotar API keys periódicamente
7. Monitorear logs para detectar abusos

---

## 📝 Ejemplo Completo

### 1. Preparar archivos

```bash
# Estructura del proyecto
backend-gateway/
├── src/
│   ├── gateway-deploy.ts       # Gateway para Deno Deploy
│   └── registry-server-kv.ts   # Registry para Deno Deploy
├── scripts/
│   ├── register-backend.ts
│   └── test-gateway.ts
└── deno.json
```

### 2. Deploy registry

```bash
deployctl deploy \
  --project=my-registry \
  --env=API_KEY=secret-key-123 \
  src/registry-server-kv.ts
```

### 3. Deploy gateway

```bash
deployctl deploy \
  --project=my-gateway \
  --env=BACKENDS_REGISTRY_URL=https://my-registry.deno.dev \
  --env=API_KEY=secret-key-123 \
  src/gateway-deploy.ts
```

### 4. Registrar backend

```bash
deno run -A scripts/register-backend.ts \
  --name=api-prod \
  --backend-url=https://api.example.com \
  --backend-token=backend-token-xyz \
  --prefix=/api/v1 \
  --registry-url=https://my-registry.deno.dev \
  --api-key=secret-key-123
```

### 5. Probar

```bash
curl https://my-gateway.deno.dev/api/v1/users
```

¡Listo! Tu gateway está desplegado y funcionando globalmente. 🎉
