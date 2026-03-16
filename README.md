# chabit-identity

Microservicio de identidad, autenticación y gestión de cuentas para la plataforma Chabit.

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 22, TypeScript (ESM strict) |
| Framework HTTP | Hono + @hono/node-server |
| Base de datos | PostgreSQL 16 |
| ORM / queries | `pg` (queries crudas, sin ORM) |
| Validación | Zod |
| Hashing passwords | bcryptjs (rounds=10) |
| Tokens JWT | jsonwebtoken (HS256, TTL 15 min) |
| Logging | pino (pretty en dev, JSON en prod) |
| Tests | Vitest (152 tests: unitarios + E2E) |
| Docs | OpenAPI 3.0.3 + Swagger UI |
| Contenedores | Docker multi-stage + docker-compose |

## Arquitectura

El servicio sigue **arquitectura hexagonal** (ports & adapters) con módulos organizados por subdominio DDD:

```
src/
├── modules/
│   ├── verification/   # Verificación de email via OTP (HMAC-SHA256)
│   ├── identity/       # Datos personales del usuario
│   ├── credential/     # Username, password hash, sesiones JWT
│   ├── account/        # Tipo de cuenta (USER / ORGANIZER / ADMIN) y estado
│   └── registration/   # RegisterSaga: orquesta los 4 subdominios en una tx
├── shared/
│   ├── domain/         # Value objects compartidos (Email, IdentityRef…)
│   ├── infrastructure/ # pgPool, MigrationRunner, logger (pino)
│   └── presentation/   # server, error-handler, CORS, openapi.ts, test-app
└── e2e/                # Smoke tests con InMemory repos (sin Postgres)
```

Cada módulo tiene las capas `domain → application → infrastructure → presentation`. El dominio no depende de nada externo; la infraestructura implementa los puertos del dominio.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/docs/spec` | OpenAPI JSON |
| `POST` | `/verification/email` | Solicitar OTP por email |
| `POST` | `/verification/email/verify` | Verificar OTP |
| `POST` | `/register` | Registro completo (saga) |
| `POST` | `/auth/sign-in` | Iniciar sesión |
| `POST` | `/auth/refresh` | Renovar access token |
| `POST` | `/auth/sign-out` | Cerrar sesión actual |
| `POST` | `/auth/sign-out/all` | Cerrar todas las sesiones |
| `POST` | `/auth/forgot-password` | Solicitar reset de contraseña |
| `POST` | `/auth/reset-password` | Resetear contraseña con OTP |
| `PATCH` | `/auth/change-password` | Cambiar contraseña |
| `PATCH` | `/auth/change-username` | Cambiar username (cooldown 30 días) |
| `POST` | `/accounts/organizer-request` | Solicitar rol organizador |
| `POST` | `/accounts/:id/approve` | Aprobar solicitud (admin) |
| `POST` | `/accounts/:id/reject` | Rechazar solicitud (admin) |
| `POST` | `/accounts/organizer-re-request` | Re-solicitar tras rechazo |
| `GET` | `/accounts` | Listar cuentas por identidad |

La documentación interactiva completa está en `/docs` (Swagger UI).

## Setup local

### Requisitos

- Node.js 22+
- PostgreSQL 16 (o Docker)

### Variables de entorno

Copiar `.env.example` y completar:

```bash
cp .env.example .env
```

```env
PORT=3001

PG_HOST=localhost
PG_PORT=5432
PG_USER=chabit
PG_PASSWORD=chabit
PG_DATABASE=chabit_identity
PG_POOL_MAX=20
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECTION_TIMEOUT_MS=5000

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

OTP_HMAC_SECRET=change-me-in-production
JWT_SECRET=change-me-in-production
LOG_LEVEL=info

# Email (SMTP)
# Si no se configura SMTP_HOST, el servidor loggea el OTP en consola (modo desarrollo)
SMTP_HOST=localhost      # host del servidor Postfix
SMTP_PORT=25             # 25 (local), 587 (STARTTLS), 465 (TLS)
SMTP_SECURE=false        # true solo para puerto 465
SMTP_FROM=noreply@chabit.com
# SMTP_USER=             # opcional, si el relay requiere autenticación
# SMTP_PASS=             # opcional
```

### Instalación y arranque

```bash
npm install
npm run dev        # modo watch con tsx
```

Las migraciones se corren automáticamente al iniciar el servidor. Para correrlas manualmente:

```bash
npm run migrate
```

### Build de producción

```bash
npm run build      # compila TypeScript + copia migrations a dist/
npm start
```

## Docker

### Con docker-compose (recomendado)

```bash
# Crear .env con JWT_SECRET y OTP_HMAC_SECRET
echo "JWT_SECRET=supersecret" >> .env
echo "OTP_HMAC_SECRET=supersecret" >> .env

docker compose up --build
```

Levanta PostgreSQL + la app. Las migraciones corren automáticamente al inicio.

### Solo el servicio (imagen)

```bash
docker build -t chabit-identity .
docker run -p 3001:3001 --env-file .env chabit-identity
```

## Tests

```bash
npm test           # corre todos los tests una vez
npm run test:watch # modo watch
```

El suite incluye:

- **Tests unitarios** — entidades, value objects, casos de uso (con InMemory repos)
- **E2E smoke tests** — flujos HTTP completos con `app.request()` de Hono, sin Postgres ni red

Cada test E2E crea su propia instancia de la app con repos en memoria, completamente aislada.

## Decisiones técnicas

| Decisión | Motivo |
|----------|--------|
| `SERIAL` para `VerificationId` | La DB asigna el id — más simple que UUID para este agregado |
| HMAC-SHA256 con salt por OTP | Resistente a rainbow tables, usa `node:crypto` sin deps extra |
| Sesiones sliding window (30 días) | El `UpdateToken` (UUID v4) rota en cada refresh; máx. 10 sesiones activas por usuario (LRU) |
| JWT HS256, TTL 15 min | Access token corto para minimizar ventana de compromiso |
| `attempt()` incrementa antes de verificar | Fiel a la arquitectura: el intento cuenta aunque sea correcto |
| Fire & forget para eventos de auditoría | No bloquean el flujo principal; fallos logueados con `logger.warn` |
| `RegisterSaga` con compensaciones | Consistencia eventual: si falla un paso, se hace hardDelete de lo creado |
| `StubEmailSender` con `sentEmails[]` | Permite capturar OTPs en tests E2E sin mockear el módulo |
| Rate limiters dentro de factory functions | Evita estado compartido entre instancias de test |
| Selección de EmailSender por `SMTP_HOST` | Si no está configurado cae al Stub — sin cambios de código entre dev y prod |

## Estructura de módulos

```
modules/<nombre>/
├── domain/
│   ├── entities/        # Lógica de negocio pura
│   ├── value-objects/   # Tipos con validación y semántica
│   ├── errors/          # Errores de dominio tipados
│   └── ports/           # Interfaces de repositorios y servicios
├── application/
│   └── use-cases/       # Casos de uso (orquestación)
├── infrastructure/
│   ├── persistence/     # Implementaciones Postgres e InMemory
│   └── adapters/        # Adaptadores externos (hasher, JWT, email…)
└── presentation/
    └── http/            # Rutas Hono + schemas Zod
```
