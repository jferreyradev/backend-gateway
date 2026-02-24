# Instalación Mínima para PCs Remotas

**Un solo comando** con Deno. Compatible con Windows, Linux y Mac.

## Instalación en 2 pasos

### 1. Instalar Deno (solo una vez)

```powershell
irm https://deno.land/install.ps1 | iex
```

Reinicia PowerShell después de instalar.

## Archivos de Ejemplo Incluidos

El proyecto incluye 3 scripts de ejemplo:

```
register-daemon.example.bat    # Windows CMD (doble-click)
register-daemon.example.ps1    # Windows PowerShell
register-daemon.example.sh     # Linux/Mac/WSL
```

Solo copia el apropiado para tu sistema, edita las variables y ejecuta.

## ¿Qué hace?

1. **Detecta tu IP pública** automáticamente
2. **Registra tu API** en el gateway
3. **Verifica IP cada 30 minutos**
4. **Registra solo si la IP cambió**

## Sin archivos locales necesarios

Puedes ejecutar el script directamente desde GitHub sin descargar nada:

```bash
# Ejecutar remotamente (todas las plataformas)
deno run -A https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/scripts/register-backend-standalone.ts \
  --registry-url=https://tu-kv.deno.dev \
  --api-key=tu-api-key \
  --encryption-key=tu-clave-32-caracteres \
  --name=mi-pc \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=secret \
  --daemon
```

O descarga el script una vez y ejecútalo localmente.

## Ejemplo completo

**PC 1 - Productos**

```bash
export STORAGE_URL="https://mi-kv.deno.dev"
export API_KEY="clave-compartida-123"
export ENCRYPTION_KEY="mi-clave-de-32-caracteres-segura"

deno run -A scripts/register-backend-standalone.ts \
  --name=productos \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token-productos-secreto \
  --prefix=/productos \
  --daemon
```

**PC 2 - Usuarios**

```bash
export STORAGE_URL="https://mi-kv.deno.dev"
export API_KEY="clave-compartida-123"
export ENCRYPTION_KEY="mi-clave-de-32-caracteres-segura"

deno run -A scripts/register-backend-standalone.ts \
  --name=usuarios \
  --use-public-ip \
  --backend-port=4000 \
  --backend-token=token-usuarios-secreto \
  --prefix=/usuarios \
  --daemon
```

## Port Forwarding

No olvides configurar port forwarding en el router de cada PC:

- PC 1: Puerto **3000** → IP interna de PC 1
- PC 2: Puerto **4000** → IP interna de PC 2

## Verificar registro

Desde cualquier PC:

```powershell
curl https://mi-kv.deno.dev/backends `
  -H "X-API-Key: clave-compartida-123"
```

Verás:
```json
{
  "productos": {
    "url": "http://85.123.45.67:3000",
    "prefix": "/productos"
  },
  "usuarios": {
    "url": "http://92.45.123.89:4000",
    "prefix": "/usuarios"
  }
}
```

## Desplegar Gateway (Deno Deploy)

Una vez todas las PCs registradas:

1. Sube `src/simple-gateway.ts` a Deno Deploy
2. Configura las variables de entorno:
```
STORAGE_URL=https://mi-kv.deno.dev
API_KEY=clave-compartida-123
ENCRYPTION_KEY=mi-clave-de-32-caracteres-segura
```
3. Despliega

Accede a todas las APIs:
```bash
# API de productos (PC 1)
curl https://tu-gateway.deno.dev/productos/items

# API de usuarios (PC 2)
curl https://tu-gateway.deno.dev/usuarios/list
```

## Ventajas

✅ **Solo 2 archivos** por PC remota  
✅ **45 KB total** vs 500 KB del proyecto completo  
✅ **Descarga automática** del script standalone  
✅ **IP pública dinámica** manejada automáticamente  
✅ **Verificación cada 30 minutos** sin intervención  
✅ **Registra solo si IP cambió** (eficiente)
✅ **Fácil de compartir**: solo envía el .bat editado  

## Troubleshooting

### Script standalone no se descarga
Si falla la descarga automática:
1. Descarga manualmente desde GitHub
2. Coloca `register-backend-standalone.ts` en la carpeta del proyecto
3. Ejecuta de nuevo

### Error: Deno no encontrado
```powershell
irm https://deno.land/install.ps1 | iex
# Reinicia PowerShell
```

### No aparece mi backend en la lista
1. Verifica que el daemon esté corriendo (debe decir "Daemon mode")
2. Revisa las credenciales (STORAGE_URL, API_KEY, ENCRYPTION_KEY)
3. Espera hasta 30 minutos para la primera verificación o verifica los logs

## Comparación

| Método | Archivos | Tamaño | Complejidad |
|--------|----------|--------|-------------|
| Proyecto completo | ~20 | 500 KB | Alta |
| Script standalone | 1 | 10 KB | Media |
| **Archivos de ejemplo** | **1** | **~2 KB** | **Baja** |
| **Comando directo** | **0** | **0 KB** | **Muy baja** |

## Resumen

**En cada PC remota**:
1. Instala Deno (una vez)
2. Copia el script de ejemplo apropiado (.bat, .ps1 o .sh)
3. Edita las credenciales
4. Ejecuta

**En Deno Deploy**:
1. Sube `simple-gateway.ts`
2. Configura las mismas 3 credenciales
3. Despliega

¡Listo! Todas tus APIs accesibles desde un solo endpoint.
