import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidNationalityError extends DomainError {
  constructor(reason: string) { super(`Invalid nationality: ${reason}`); }
}

const ALLOWED = /^[\p{L}\s\-]+$/u;

export class Nationality {
  private readonly value: string;
  private constructor(value: string) { this.value = value; }

  static fromPrimitive(raw: string): Nationality {
    const v = raw.trim();
    if (v.length === 0) throw new InvalidNationalityError('cannot be empty');
    if (v.length > 100) throw new InvalidNationalityError('max 100 characters');
    if (!ALLOWED.test(v)) throw new InvalidNationalityError('contains invalid characters');
    return new Nationality(v);
  }

  toPrimitive(): string { return this.value; }
  equals(other: Nationality): boolean { return this.value === other.value; }
}
