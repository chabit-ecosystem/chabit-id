import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidBlnkIdentityRefError extends DomainError {
  constructor() { super('BlnkIdentityRef cannot be empty'); }
}

export class BlnkIdentityRef {
  private readonly value: string;
  private constructor(value: string) { this.value = value; }

  static fromPrimitive(raw: string): BlnkIdentityRef {
    if (!raw.trim()) throw new InvalidBlnkIdentityRefError();
    return new BlnkIdentityRef(raw.trim());
  }

  toPrimitive(): string { return this.value; }
  equals(other: BlnkIdentityRef): boolean { return this.value === other.value; }
}
