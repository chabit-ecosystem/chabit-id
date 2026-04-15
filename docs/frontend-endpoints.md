# chabit-identity — Endpoints para el frontend

Base URL: `http://localhost:3001`

---

## Verificación

### `POST /verification/email`
Envía un OTP al mail.

**Body**
```json
{ "email": "user@example.com" }
```
**Response 201**
```json
{ "verificationId": 42 }
```

---

### `POST /verification/email/verify`
Verifica el OTP. Devuelve el `verificationId` necesario para el registro.

**Body**
```json
{ "email": "user@example.com", "code": "123456" }
```
**Response 200**
```json
{ "verificationId": 42, "usedAt": "2026-04-01T10:00:00.000Z" }
```

---

## Registro

### `POST /register`
Crea el usuario. Requiere un `verificationId` en estado USED.

**Body**
```json
{
  "verificationId": 42,
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "5491112345678",
  "nationality": "Argentine",
  "country": "Argentina",
  "username": "janedoe",
  "password": "supersecret123"
}
```
**Response 201** — devuelve token pair
```json
{ "accessToken": "...", "updateToken": "..." }
```

---

## Auth

### `POST /auth/sign-in`
**Body**
```json
{ "username": "janedoe", "password": "supersecret123" }
```
**Response 200**
```json
{ "accessToken": "...", "updateToken": "..." }
```

---

### `POST /auth/refresh`
Rota el refresh token.

**Body**
```json
{ "updateToken": "uuid" }
```
**Response 200**
```json
{ "accessToken": "...", "updateToken": "..." }
```

---

### `POST /auth/sign-out`
Cierra la sesión actual.

**Headers:** `x-session-id: <sid del JWT>`

---

### `POST /auth/sign-out/all`
Cierra todas las sesiones.

**Headers:** `x-identity-ref: <sub del JWT>`

---

### `POST /auth/forgot-password`
Manda OTP de reset. Siempre devuelve 200 (no revela si el mail existe).

**Body**
```json
{ "email": "jane@example.com" }
```
**Response 200**
```json
{ "verificationId": 43 }
```

---

### `POST /auth/reset-password`
**Body**
```json
{
  "verificationId": 43,
  "code": "654321",
  "email": "jane@example.com",
  "newPassword": "newPass456"
}
```

---

### `PATCH /auth/change-password`
**Headers:** `x-identity-ref`, `x-session-id`

**Body**
```json
{ "currentPassword": "oldPass123", "newPassword": "newPass456" }
```

---

### `PATCH /auth/change-username`
Cooldown de 30 días entre cambios.

**Headers:** `x-identity-ref`

**Body**
```json
{ "newUsername": "jane_doe_new" }
```

---

## Check (disponibilidad)

Todos devuelven `{ "available": true/false }`. Rate limit: 20 req/min.

### `GET /check/username?value=janedoe`
### `GET /check/email?value=jane@example.com`
### `GET /check/phone?value=5491112345678`

---

## Notas

- El `accessToken` es un JWT HS256 con TTL de 15 min.
- El `updateToken` es un UUID con ventana deslizante de 30 días.
- El `sid` claim del JWT es el `x-session-id`.
- El `sub` claim del JWT es el `x-identity-ref`.
