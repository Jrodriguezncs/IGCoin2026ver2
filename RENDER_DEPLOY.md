# IGCoin — Despliegue en Render

Guía paso a paso para desplegar el backend de IGCoin en Render.com.

---

## Estructura del repo (importante)

Los archivos deben estar **en la raíz del repositorio**, no dentro de una subcarpeta:

```
mi-repo/
├── package.json       ← acá, en la raíz
├── server.js
├── blockchain.js
├── .gitignore
├── README.md
└── public/
    └── index.html
```

Si tu repo tiene una carpeta intermedia (ej: `mi-repo/igcoin-backend/package.json`), tenés dos opciones:

**Opción A (recomendada):** mover todos los archivos a la raíz del repo y borrar la carpeta intermedia.

**Opción B:** en Render, en Settings → Root Directory, poner el nombre de la subcarpeta (ej: `igcoin-backend`).

---

## Paso a paso del deploy

### 1. Subir el código a GitHub
Asegurate de que el repo tenga la estructura de arriba.

### 2. Crear el servicio en Render
1. Andá a https://dashboard.render.com
2. Click en **New +** → **Web Service**
3. Conectá tu cuenta de GitHub si no lo hiciste antes
4. Seleccioná el repositorio del proyecto

### 3. Configuración del servicio
Completá los campos así:

| Campo | Valor |
|---|---|
| **Name** | `igcoin-backend` (o el nombre que prefieras) |
| **Region** | la más cercana (Oregon o Ohio para Argentina) |
| **Branch** | `main` |
| **Root Directory** | dejarlo vacío (a menos que uses la Opción B de arriba) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### 4. Click en "Create Web Service"
Render va a clonar el repo, instalar dependencias y arrancar el servidor. Tarda unos 2 a 4 minutos la primera vez.

### 5. Verificar que funciona
Cuando termine el deploy, Render te da una URL del estilo:
```
https://igcoin-backend.onrender.com
```

Probá los endpoints:
- `https://igcoin-backend.onrender.com/health` → debe devolver JSON con status ok
- `https://igcoin-backend.onrender.com/` → debe mostrar el panel de visualización
- `https://igcoin-backend.onrender.com/chain` → debe devolver el bloque génesis

---

## Errores comunes y soluciones

### Error: "Cannot find module"
Render no encontró el `package.json` o los archivos están mal ubicados.
**Solución:** revisá la estructura del repo (paso 1 de arriba).

### Error: "Application failed to respond" o el servicio queda en "Deploy in progress"
El servidor no escucha en el puerto correcto.
**Solución:** verificar en `server.js` que se use `process.env.PORT` y no un puerto fijo. El código de este repo ya lo hace.

### Error: "Build failed: npm install failed"
Versión de Node incompatible.
**Solución:** verificá que el `package.json` tenga el campo `engines`:
```json
"engines": { "node": ">=18.0.0" }
```

### El servicio funciona pero a los 15 minutos deja de responder
Es normal en el plan free: Render duerme los servicios sin tráfico.
**Solución:** primera petición tarda 30 segundos en despertar el servicio. Para evitarlo, hay servicios externos como UptimeRobot que pingean cada 5 minutos.

### La blockchain se reinicia sola cada tanto
Filesystem efímero del plan free: cada vez que Render reinicia el servicio, se borra `blockchain.json`.
**Solución para desarrollo:** ninguna, es esperable.
**Solución para producción/Expo:** migrar persistencia a Supabase (ver sección siguiente).

---

## Persistencia real con Supabase (opcional, para producción)

Si querés que la blockchain sobreviva los reinicios de Render, hay que reemplazar el almacenamiento en archivo por una base de datos. Supabase es una buena opción gratuita.

**Pasos resumidos:**
1. Crear un proyecto en Supabase
2. Crear dos tablas:
   - `blocks` (id, index, timestamp, transactions JSONB, previous_hash, hash)
   - `pending_transactions` (id, sender, recipient, amount, timestamp)
3. Instalar el cliente: `npm install @supabase/supabase-js`
4. Reemplazar las funciones `guardarLedger()` y la carga inicial por queries a Supabase
5. Configurar las variables de entorno en Render: `SUPABASE_URL` y `SUPABASE_KEY`

Si querés que arme esta versión adaptada a Supabase, avisame y la genero.

---

## Variables de entorno (avanzado)

Si en el futuro agregás funcionalidades que requieran configuración (claves de API, URLs externas), en Render se configuran en:

**Dashboard del servicio → Environment → Add Environment Variable**

Ejemplos de variables que podrías necesitar:
- `NODE_ENV=production`
- `SUPABASE_URL=...`
- `SUPABASE_KEY=...`

---

## Comandos útiles para debug

Desde tu computadora, podés probar los endpoints así:

```bash
# Verificar que el servicio responde
curl https://TU-URL.onrender.com/health

# Crear una wallet de prueba
curl -X POST https://TU-URL.onrender.com/wallet/crear \
  -H "Content-Type: application/json" \
  -d '{"walletId":"test","saldoInicial":100}'

# Ver la cadena
curl https://TU-URL.onrender.com/chain

# Ver saldo
curl https://TU-URL.onrender.com/wallet/test/saldo
```

---

## Notas para el día de la Expo

**No recomiendo usar Render para el evento mismo**, por dos motivos:

1. El servicio puede dormirse en momentos críticos (15 min sin tráfico)
2. La WiFi del evento puede no tener internet o ser inestable

**Recomendación:** correr el sistema en una notebook conectada a la red WiFi del evento. Todo el flujo (wallets, transacciones, ranking) funciona offline siempre que los dispositivos estén en la misma red local.

Render queda perfecto para desarrollo, pruebas y para que los estudiantes accedan al sistema desde casa entre semana.

---

**Proyecto desarrollado en el marco de ISC Tech Expo 2026 — Instituto González Catán**
