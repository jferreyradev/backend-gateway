# Instalación Rápida para PCs Remotas

## Opción 1: Ejecutar directamente (SIN descargar nada)

```bash
deno run -A https://raw.githubusercontent.com/jferreyradev/backend-gateway/main/scripts/register-backend-standalone.ts \
  --registry-url=https://tu-kv-storage.deno.dev \
  --api-key=tu-api-key \
  --encryption-key=tu-clave-32-caracteres \
  --name=mi-api \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=secret123 \
  --prefix=/miapi \
  --daemon
```

✅ **Ventajas**: No necesitas clonar nada, un solo comando

## Opción 2: Descargar solo el script

```bash
# Descargar el script
curl -O https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/scripts/register-backend-standalone.ts

# Configurar variables de entorno (Windows PowerShell)
$env:STORAGE_URL = "https://tu-kv-storage.deno.dev"
$env:API_KEY = "tu-api-key"
$env:ENCRYPTION_KEY = "tu-clave-32-caracteres"

# Ejecutar
deno run -A register-backend-standalone.ts `
  --name=mi-api `
  --use-public-ip `
  --backend-port=3000 `
  --backend-token=secret123 `
  --daemon
```

✅ **Ventajas**: Script local, puedes editarlo, variables de entorno

## Opción 3: Script .bat para Windows

Crea un archivo `register.bat`:

```batch
@echo off
REM Descargar el script standalone
curl -O https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/scripts/register-backend-standalone.ts

REM Configurar y ejecutar
deno run -A register-backend-standalone.ts ^
  --registry-url=https://tu-kv-storage.deno.dev ^
  --api-key=tu-api-key ^
  --encryption-key=tu-clave-32-caracteres ^
  --name=mi-pc ^
  --use-public-ip ^
  --backend-port=3000 ^
  --backend-token=mi-token-secreto ^
  --prefix=/mipc ^
  --daemon

pause
```

Ejecuta: `register.bat`

✅ **Ventajas**: Doble-click y listo, perfecto para usuarios no técnicos

## Lo que NO necesitas en las PCs

❌ No necesitas clonar el repositorio completo  
❌ No necesitas el código del gateway (`src/simple-gateway.ts`)  
❌ No necesitas la documentación completa  
❌ No necesitas las dependencias extras

## Solo necesitas

✅ Deno instalado: `irm https://deno.land/install.ps1 | iex`  
✅ El script standalone (1 archivo)  
✅ Las 3 credenciales (STORAGE_URL, API_KEY, ENCRYPTION_KEY)  
✅ Tu API corriendo en algún puerto

## Comparación de tamaños

| Opción | Archivos | Tamaño |
|--------|----------|--------|
| Repositorio completo | ~20 archivos | ~500 KB |
| Script standalone | 1 archivo | ~10 KB |
| Ejecutar directamente | 0 archivos | 0 KB |

## Credenciales necesarias

Las 3 credenciales deben ser **las mismas** en:
- Todas las PCs que registran backends
- El gateway en Deno Deploy

```
STORAGE_URL=https://tu-kv-storage.deno.dev
API_KEY=tu-api-key-compartida
ENCRYPTION_KEY=clave-de-32-caracteres-minimo
```

## Ejemplo completo PC 1

```bash
# 1. Instalar Deno (si no lo tienes)
irm https://deno.land/install.ps1 | iex

# 2. Ejecutar directamente (sin descargar)
deno run -A https://raw.githubusercontent.com/.../register-backend-standalone.ts `
  --registry-url=https://mi-kv.deno.dev `
  --api-key=clave-compartida-123 `
  --encryption-key=mi-super-clave-de-32-caracteres `
  --name=productos `
  --use-public-ip `
  --backend-port=3000 `
  --backend-token=token-secreto-productos `
  --prefix=/productos `
  --daemon
```

✅ El script detecta tu IP pública automáticamente  
✅ Se registra cada 5 minutos  
✅ Si tu IP cambia, se actualiza automáticamente

## Ejemplo completo PC 2

```bash
deno run -A https://raw.githubusercontent.com/.../register-backend-standalone.ts `
  --registry-url=https://mi-kv.deno.dev `
  --api-key=clave-compartida-123 `
  --encryption-key=mi-super-clave-de-32-caracteres `
  --name=usuarios `
  --use-public-ip `
  --backend-port=4000 `
  --backend-token=token-secreto-usuarios `
  --prefix=/usuarios `
  --daemon
```

## Verificar que funcionó

En cualquier PC (o desde el gateway):

```bash
# Listar backends registrados
curl https://mi-kv.deno.dev/backends \
  -H "X-API-Key: clave-compartida-123"
```

Deberías ver:
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

## Troubleshooting

### Error: "Deno no encontrado"
```bash
# Instalar Deno
irm https://deno.land/install.ps1 | iex

# Reiniciar PowerShell
```

### Error: "Cannot fetch from GitHub"
- Descarga el script manualmente desde GitHub
- O copia/pega el contenido en un archivo local

### El daemon no se mantiene corriendo
- Usa el Programador de Tareas de Windows
- O ejecuta en una sesión de PowerShell persistente

### No puedo acceder desde el gateway
1. Verifica port forwarding en tu router
2. Prueba acceso directo: `curl http://TU_IP_PUBLICA:PUERTO`
3. Revisa firewall de Windows

## Resumen

**Para cada PC remota:**
1. Instala Deno (una vez)
2. Ejecuta el script standalone con tus credenciales
3. Asegura port forwarding en el router
4. ¡Listo! La PC se mantiene registrada automáticamente

**Para el gateway:**
1. Despliega `simple-gateway.ts` en Deno Deploy
2. Configura las mismas 3 variables de entorno
3. Accede a todas las APIs en: `https://tu-gateway.deno.dev/PREFIX/ruta`

No necesitas sincronizar código ni configuraciones complejas. Solo las 3 credenciales compartidas.
