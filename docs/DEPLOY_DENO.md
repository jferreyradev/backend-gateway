## 🚀 Desplegar Gateway en Deno Deploy

### Paso 1: Preparar el repositorio

```bash
git add gateway-server.ts register-backend.ts
git commit -m "Gateway compatible con Deno Deploy"
git push origin main
```

### Paso 2: Crear proyecto en Deno Deploy

1. Accede a [https://dash.deno.com](https://dash.deno.com)
2. Click en **New Project**
3. Selecciona **GitHub Integration**
4. Conecta tu repositorio
5. Selecciona el branch `main`
6. En "Production Branch Settings":
   - **Main Entrypoint**: `gateway-server.ts`
   - Click en **Deploy**

### Paso 3: Configurar Variables de Entorno

1. Una vez desplegado, ve a **Project Settings**
2. Click en **Environment Variables**
3. Agrega las variables:

```env
BACKENDS_REGISTRY_URL=https://kv-storage-api.deno.dev
API_KEY=pi3_141516
ENCRYPTION_KEY=go-oracle-api-secure-key-2026
CACHE_TTL_MS=30000
```

4. Click en **Save**

### Paso 4: Probar

Tu gateway estará disponible en:
```
https://{project-name}.deno.dev
```

Prueba:
```bash
curl https://{project-name}.deno.dev/gateway/status
```

Debería retornar los backends registrados.

### Monitoreo

En Deno Deploy Dashboard puedes ver:
- Logs en tiempo real
- Número de requests
- Errores y alertas
- Uso de recursos

### Actualizar Despliegue

Simplemente hace push a tu repositorio:
```bash
git push origin main
```

Deno Deploy se actualizará automáticamente en ~5 segundos.

### URLs de Despliegue

Ejemplo:
```
https://my-gateway.deno.dev/gateway/status
https://my-gateway.deno.dev/api/desa/users
```

Las requests se rutearán automáticamente a los backends registrados según sus prefijos.

### Troubleshooting

**❌ "Configuration error"**
- Asegúrate que `BACKENDS_REGISTRY_URL` y `API_KEY` estén configuradas
- Ve a Project Settings → Environment Variables

**❌ "No backend found"**
- Verifica que hay backends registrados: `/gateway/status`
- Confirma que la ruta coincida con un prefix de backend

**❌ "Backend error"**
- El backend no está accesible desde Deno Deploy
- Verifica que la URL del backend sea pública

### Logs

Para ver los logs:
```bash
deno deploy logs {project-name}
```

O en el dashboard: **Logs** tab.
