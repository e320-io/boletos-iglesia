# 🎫 Sistema de Boletos — Evento Iglesia 2026

Sistema interno de punto de venta para boletos enumerados con mapa de asientos interactivo, sistema de abonos y comprobantes por email.

## Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Email:** Resend
- **Deploy:** Vercel

---

## 🚀 Setup Rápido (15 minutos)

### 1. Supabase

1. Ve a [supabase.com](https://supabase.com) y abre tu proyecto
2. Ve a **SQL Editor** → **New Query**
3. Copia y pega TODO el contenido de `supabase/schema.sql`
4. Haz clic en **Run** ▶️
5. Ve a **Settings** → **API** y copia:
   - `Project URL` → será tu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → será tu `SUPABASE_SERVICE_ROLE_KEY`

**IMPORTANTE:** En **Settings** → **API** → **Realtime**, asegúrate de que las tablas `asientos`, `registros` y `pagos` tengan habilitado Realtime. Si no:
- Ve a **Database** → **Replication**
- Habilita `realtime` para las 3 tablas

### 2. Resend (Email)

1. Crea una cuenta gratis en [resend.com](https://resend.com)
2. Ve a **API Keys** → **Create API Key**
3. Copia la key → será tu `RESEND_API_KEY`
4. (Opcional) Para usar tu dominio propio en vez de `onboarding@resend.dev`:
   - Ve a **Domains** → agrega tu dominio
   - Configura los DNS records que te indica
   - Cambia el `from` en `src/app/api/send-email/route.ts`

### 3. GitHub + Vercel

```bash
# Clona o inicializa el repo
git init
git add .
git commit -m "Initial commit: sistema de boletos"
git remote add origin https://github.com/TU_USUARIO/boletos-iglesia.git
git push -u origin main
```

En Vercel:
1. Importa el repositorio de GitHub
2. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (tu URL de Vercel, ej: `https://boletos-iglesia.vercel.app`)
   - `NEXT_PUBLIC_EVENT_NAME` (nombre de tu evento)
3. Deploy 🚀

### 4. Desarrollo Local

```bash
# Instalar dependencias
npm install

# Copia el archivo de ejemplo de env
cp .env.local.example .env.local
# Edita .env.local con tus keys

# Iniciar el servidor de desarrollo
npm run dev
```

Abre http://localhost:3000

---

## 📖 Funcionalidades

### Punto de Venta
- Registro de persona: nombre, teléfono, correo, nación
- Selección interactiva de asientos en mapa visual
- Sistema de abonos parciales
- Método de pago (efectivo, transferencia, tarjeta, otro)

### Mapa de Asientos
- Refleja exactamente el layout del venue
- Estados: disponible (verde), ocupado (cyan), no disponible (rojo)
- Selección múltiple de asientos
- Actualización en tiempo real via Supabase Realtime

### Gestión de Registros
- Lista completa con filtros (búsqueda, status, nación)
- Detalle con historial de pagos
- Barra de progreso de pago
- Registrar abonos adicionales

### Comprobante por Email
- Se envía automáticamente al registrar o abonar
- Muestra: asientos, status, monto pagado, saldo, nación/mentor
- Diseño profesional tipo voucher
- Botón para reenviar comprobante

---

## 📁 Estructura del Proyecto

```
boletos-iglesia/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── registro/route.ts    # Crear registro
│   │   │   ├── abono/route.ts       # Agregar abono
│   │   │   └── send-email/route.ts  # Enviar comprobante
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                 # POS principal
│   ├── components/
│   │   ├── SeatMap.tsx              # Mapa interactivo
│   │   ├── RegistrosList.tsx        # Lista de registros
│   │   ├── RegistroDetail.tsx       # Detalle + abonos
│   │   └── Toast.tsx                # Notificaciones
│   ├── lib/
│   │   ├── supabase.ts             # Cliente Supabase
│   │   └── constants.ts            # Naciones, config
│   └── types/
│       └── index.ts                 # TypeScript types
├── supabase/
│   └── schema.sql                   # Schema completo
├── package.json
└── README.md
```
