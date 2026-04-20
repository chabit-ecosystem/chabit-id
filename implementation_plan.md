# Implementación Inicial - Módulo de Comercio (CRM Comercio) V2

Este plan detalla los pasos de implementación para el módulo "Comercio" tomando en cuenta el flujo global actualizado de autenticación (Chabit-ID).

## Aclaración Fundamental (Arquitectura)
1. **Chabit-ID Centralizado:** Ya **no** existirá un login paralelo con PIN y Email para Empleados/Staff (`staff-auth`). **TODOS** serán Usuarios bajo la misma entidad global `User`.
2. **Roles Globales en Chabit-ID:** En la base de Chabit-ID (y el token), se manejarán roles más abarcativos: *Administrador, Organizador, Comercio, Empleado, Staff*.
3. **Entidad Comercio:** Sigue siendo indispensable, ya que funciona como el agrupador entre el Usuario Dueño y sus Usuarios Empleados, su inventario y balance.

---

## Cambios Propuestos (Backend / Base de Datos)

### 1. Actualización en Schema de Prisma (`schema.prisma`)

Ahora tanto el Dueño como el Empleado son simplemente la entidad abstracta `User`. La base de datos debe reflejar a qué comercio pertenece un usuario cuando ingresa con rol "Empleado".

#### Nuevos Modelos a crear:

```prisma
// Entidad que representa al Comercio/Negocio
model Commerce {
  id          String       @id @default(uuid())
  name        String
  taxId       String?      // CUIT / RUT (Opcional)
  ownerId     String       
  owner       User         @relation("CommerceOwner", fields: [ownerId], references: [chabitIdentityRef]) // O 'id' según la norma.
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  employees   Employee[]
  // Futuras relaciones: inventoryOrders, products, etc.
}

// Entidad que representa la relación entre un Usuario global y un Comercio donde trabaja.
model Employee {
  id          String       @id @default(uuid())
  userId      String       // El usuario (persona de Chabit-ID)
  user        User         @relation("EmployeeUser", fields: [userId], references: [id])
  commerceId  String       // El comercio donde trabaja
  commerce    Commerce     @relation(fields: [commerceId], references: [id])
  
  canSell     Boolean      @default(true) // Permisos específicos
  active      Boolean      @default(true)
  createdAt   DateTime     @default(now())

  logs        EmployeeLog[]

  // Un usuario no debería ser empleado del mismo comercio dos veces.
  @@unique([userId, commerceId])
}

// Logeo de auditoría de actividad (aperturas de caja, ventas)
model EmployeeLog {
  id          String    @id @default(uuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id])
  action      String
  status      String
  timestamp   DateTime  @default(now())
}
```

**[IMPORTANTE]** Se deberá añadir relaciones al modelo `User` existente en `schema.prisma`:
```prisma
  // En model User agregar:
  ownedCommerces  Commerce[] @relation("CommerceOwner")
  employments     Employee[] @relation("EmployeeUser")
```
*También es altamente probable que el enum `UserRole` en este schema deba ser actualizado o directamente se asuma que el Guard valida el JWT de Chabit-ID.*

---

## Estructura de Módulos (NestJS)

Dada la nueva arquitectura, eliminamos los módulos de autenticación local. Todo el backend asumirá requirimientos de validación del token de Chabit-ID (`req.user` mediante `JwtGuard` o lo que reemplace a `AuthGuard`).

#### [NUEVO] `src/commerce`
- Estará destinado a rutas de dueño / negocio.
- **Rutas clave:**
  - `POST /commerce` (Registrar el comercio para un `User` que viene en el token)
  - `GET /commerce/:id/dashboard` (Retorna Balance, Ventas del mes y Tx Recientes)
  - `PUT /commerce/:id` (Modificar info del comercio, logo, etc.)

#### [NUEVO] `src/employee`
- Orientado a todo lo relacionado con empleados de un comercio.
- **Rutas clave (Para el Dueño):**
  - `POST /commerce/:id/employee` (Asignar un usuario a mi comercio)
  - `GET /commerce/:id/employee` (Listar empleados de mi comercio)
  - `PUT /employee/:id` (Dar/Quitar permisos de venta, o Activar/Desactivar)

---

## Flujos de Negocio

1. **El Comerciante (Dueño):**
   - Entra al FrontEnd `CRM Comercio`.
   - Se loguea o registra vía Chabit-ID.
   - Si no tiene comercio creado, ve pantalla de onboarding -> Llama a `POST /commerce`.
   - Si ya tiene comercio, ve la view **Dashboard** -> Llama a `GET /commerce/:id/dashboard`.

2. **El Empleado:**
   - Entra al FrontEnd `Comercio` (o a una URL tipo `/employee`).
   - Se loguea con Chabit-ID.
   - El sistema detecta su rol (`Employee`), pide a la API sus `comercios` asociados (`user.employments`).
   - Una vez elije o detecta el comercio activo, avanza a su tablero directamente sin pasar por Dashboard de Cajas centralizadas, sino a operar.

## Preguntas Abiertas Actualizadas

> [!WARNING]
> 1. Para crear un empleado en un local comercial (`POST /employee`), ¿el comerciante va a invitarlo vía Email o le pedirá el `$chabit_name`/usuario para buscarlo y asignarlo en la tabla? Todo usuario primero tiene que existir en Chabit-ID antes de ser asignado como Empleado.
> 2. Respecto al **Balance y Fondos** del Comercio, sigue latente la duda: ¿las operaciones (cobros, ventas) impactan al saldo general del Usuario (dueño) o se le creará una billetera/saldo interno específico alojado para el `Commerce`?

---

## Verificación Plan
- `npx prisma format` y aplicar las migraciones.
- Revisar que la arquitectura en Nest no importe dependencias viejas de `staff-auth`.
- Asegurar que la estructura JWT esperada desde Chabit-ID (puerto 3001) inyecte apropiadamente los datos en `req.user`.
