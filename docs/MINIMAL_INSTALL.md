# Instalación Mínima para PCs Remotas

Solo necesitas **2 archivos** en cada PC:

## Archivos necesarios

1. **`start-daemon-minimal.bat`** - Script de inicio (editable)
2. **`register-backend-standalone.ts`** - Script de registro (se descarga automático)

## Instalación en 3 pasos

### 1. Instalar Deno (solo una vez)

```powershell
irm https://deno.land/install.ps1 | iex
```

Reinicia PowerShell después de instalar.

### 2. Descargar start-daemon-minimal.bat

**Opción A**: Desde GitHub
```powershell
curl -O https://raw.githubusercontent.com/jferreyradev/backend-gateway/main/start-daemon-minimal.bat
```

**Opción B**: Crear manualmente
- Crea un archivo `start-daemon-minimal.bat`
- Copia el contenido desde GitHub
- Guárdalo en cualquier carpeta

### 3. Editar y ejecutar

1. Abre `start-daemon-minimal.bat` con un editor de texto
2. Edita las variables:
```batch
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=tu-api-key
set ENCRYPTION_KEY=tu-clave-32-caracteres

set BACKEND_NAME=mi-pc
set BACKEND_PORT=3000
set BACKEND_TOKEN=mi-token-secreto
set BACKEND_PREFIX=/mipc
```
3. Guarda el archivo
4. Doble-click en `start-daemon-minimal.bat`

El script descargará automáticamente `register-backend-standalone.ts` si no existe.

## ¿Qué hace?

1. **Primera ejecución**: Descarga `register-backend-standalone.ts` (10 KB)
2. **Detecta tu IP pública** automáticamente
3. **Registra tu API** en el gateway
4. **Se mantiene corriendo** y re-registra cada 5 minutos
5. **Actualiza la IP** si cambia

## Estructura en la PC

```
C:\MiAPI\
  ├── start-daemon-minimal.bat          (TÚ LO EDITAS)
  └── register-backend-standalone.ts    (SE DESCARGA AUTO)
```

Solo 2 archivos, **45 KB total**.

## Ejemplo completo

**PC 1 - Productos**

`start-daemon-minimal.bat`:
```batch
set STORAGE_URL=https://mi-kv.deno.dev
set API_KEY=clave-compartida-123
set ENCRYPTION_KEY=mi-clave-de-32-caracteres-segura

set BACKEND_NAME=productos
set BACKEND_PORT=3000
set BACKEND_TOKEN=token-productos-secreto
set BACKEND_PREFIX=/productos
```

Ejecuta: `start-daemon-minimal.bat`

**PC 2 - Usuarios**

`start-daemon-minimal.bat`:
```batch
set STORAGE_URL=https://mi-kv.deno.dev
set API_KEY=clave-compartida-123
set ENCRYPTION_KEY=mi-clave-de-32-caracteres-segura

set BACKEND_NAME=usuarios
set BACKEND_PORT=4000
set BACKEND_TOKEN=token-usuarios-secreto
set BACKEND_PREFIX=/usuarios
```

Ejecuta: `start-daemon-minimal.bat`

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
✅ **Re-registro cada 5 minutos** sin intervención  
✅ **Fácil de compartir**: solo envía el .bat editado  

## Troubleshooting

### Script standalone no se descarga
Si falla la descarga automática:
1. Descarga manualmente: https://raw.githubusercontent.com/.../register-backend-standalone.ts
2. Ponlo en la misma carpeta que `start-daemon-minimal.bat`
3. Ejecuta de nuevo

### Error: Deno no encontrado
```powershell
irm https://deno.land/install.ps1 | iex
# Reinicia PowerShell
```

### No aparece mi backend en la lista
1. Verifica que el daemon esté corriendo (debe decir "Daemon mode")
2. Revisa las credenciales (STORAGE_URL, API_KEY, ENCRYPTION_KEY)
3. Espera hasta 5 minutos para el primer registro

## Comparación

| Método | Archivos | Tamaño | Complejidad |
|--------|----------|--------|-------------|
| Proyecto completo | ~20 | 500 KB | Alta |
| Script standalone | 1 | 10 KB | Media |
| **start-daemon-minimal** | **2** | **45 KB** | **Baja** |

## Resumen

**En cada PC remota**:
1. Instala Deno
2. Descarga `start-daemon-minimal.bat`
3. Edita las credenciales
4. Ejecuta (doble-click)

**En Deno Deploy**:
1. Sube `simple-gateway.ts`
2. Configura las mismas 3 credenciales
3. Despliega

¡Listo! Todas tus APIs accesibles desde un solo endpoint.
