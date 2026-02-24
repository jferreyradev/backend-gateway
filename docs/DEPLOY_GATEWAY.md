# ☁️ Deploy a Producción

Guía para desplegar el gateway en Deno Deploy o servidor propio.

---

## 🚀 Deploy a Deno Deploy (Recomendado)

### 1. Push a GitHub

```bash
git add .
git commit -m "Deploy gateway"
git push origin main
```

### 2. Crear Proyecto en Deno Deploy

1. Ve a [dash.deno.com](https://dash.deno.com/)
2. **New Project** → **Deploy from GitHub**
3. Autoriza y selecciona el repositorio
4. Entry Point: `main.ts` (auto-detectado)
5. **Deploy Project**

### 3. Configurar Variables de Entorno

En Settings → Environment Variables:

```
STORAGE_URL=https://tu-kv-storage.deno.dev
API_KEY=tu-api-key-secreta
ENCRYPTION_KEY=clave-de-32-caracteres-minimo
```

#### 🔐 ¿Para qué sirven?

- **STORAGE_URL**: URL del KV Storage donde se registran los backends
- **API_KEY**: Autenticación para acceder al KV Storage
- **ENCRYPTION_KEY**: Encripta/desencripta los tokens de los backends
  - Los tokens se guardan encriptados en el KV Storage (AES-GCM 256-bit)
  - El gateway los desencripta para enviarlos a las APIs backend
  - **Debe ser idéntica** en todas las PCs y en el gateway

⚠️ **Importante**: Las 3 variables deben ser **exactamente iguales** en:
- Todas las PCs que registran backends
- El gateway desplegado en Deno Deploy

✅ **¡Listo!** Gateway desplegado en `https://tu-proyecto.deno.dev`

---

## 💻 Deploy con `deployctl`

## 💻 Deploy con `deployctl`

```bash
# Instalar deployctl
deno install --allow-all https://deno.land/x/deploy/deployctl.ts

# Deploy directo
deployctl deploy \
  --project=mi-gateway \
  --env=STORAGE_URL=https://kv-storage.deno.dev \
  --env=API_KEY=tu-api-key \
  --env=ENCRYPTION_KEY=32-chars-key \
  main.ts
```

---

## 🔐 Registrar Backends (URLs Públicas)

⚠️ **Importante:** Backends deben tener URLs públicas (no `localhost`)

```bash
deno run -A scripts/register-backend.ts \
  --name=produccion \
  --backend-url=https://api.miservicio.com \
  --backend-token=token-secreto \
  --prefix=/api/prod
```

---

## 🧪 Probar Gateway Desplegado

```bash
# Health check
curl https://mi-gateway.deno.dev/gateway/health

# Login
curl -X POST https://mi-gateway.deno.dev/gateway/login \
  -d '{"username":"admin","password":"admin123"}'

# Probar ruta
curl https://mi-gateway.deno.dev/api/prod/users
```

---

## 🔄 Actualizaciones Automáticas

Cada push a `main` despliega automáticamente:

```bash
git add .
git commit -m "Update gateway"
git push
# → Deno Deploy redespliega en ~10 segundos
```

---

## 🖥️ Deploy en Servidor Propio

```bash
# Con PM2
pm2 start "deno task start" --name backend-gateway

# O directo
deno task start
```

---

## 💡 Mejores Prácticas

### 1. Variables como Secrets
En Deno Deploy dashboard, usa **Secrets** para `API_KEY` y `ENCRYPTION_KEY`

### 2. Configurar Caché
```bash
CACHE_TTL_MS=300000  # 5 minutos para producción
```

### 3. Dominio Personalizado
En Settings → Domains → Add Domain

### 4. CORS Específico
```bash
ALLOWED_ORIGINS=https://miapp.com,https://www.miapp.com
```

---

## 🐛 Troubleshooting

### Gateway no carga backends
✅ Verifica que `STORAGE_URL` sea público (no `localhost`)  
✅ Verifica `API_KEY` correcta  
✅ Revisa logs en Deno Deploy dashboard

### Backends no responden
✅ URLs de backends deben ser públicas  
✅ Tokens de backend correctos  
✅ Verifica con: `deno task check`

### Error de CORS
✅ Configura `ALLOWED_ORIGINS` específico  
✅ No uses `*` en producción

---

## 📊 Monitoreo

Dashboard de Deno Deploy muestra:
- 📈 Logs en tiempo real
- 📊 Métricas (requests, errores, latencia)
