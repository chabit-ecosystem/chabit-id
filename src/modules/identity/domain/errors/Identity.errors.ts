import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export abstract class IdentityDomainError extends DomainError {}

export class IdentityNotFoundError extends IdentityDomainError {
  constructor(id: string) { super(`Identity not found: ${id}`); }
}

export class EmailAlreadyRegisteredError extends IdentityDomainError {
  constructor(email: string) { super(`Email already registered: ${email}`); }
}

export class PhoneAlreadyRegisteredError extends IdentityDomainError {
  constructor(phone: string) { super(`Phone already registered: ${phone}`); }
}

export class EmailNotVerifiedError extends IdentityDomainError {
  constructor() { super('Email must be verified before creating an identity'); }
}

export class BlnkRefAlreadyAssignedError extends IdentityDomainError {
  constructor() { super('BlnkIdentityRef is already assigned and immutable'); }
}
