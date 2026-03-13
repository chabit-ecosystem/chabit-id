import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidFullNameError extends DomainError {
  constructor(reason: string) { super(`Invalid full name: ${reason}`); }
}

const ALLOWED = /^[\p{L}\s\-']+$/u;

export class FullName {
  private readonly value: string;
  private constructor(value: string) { this.value = value; }

  static fromPrimitive(raw: string): FullName {
    const v = raw.trim();
    if (v.length === 0) throw new InvalidFullNameError('cannot be empty');
    if (v.length > 150) throw new InvalidFullNameError('max 150 characters');
    if (!ALLOWED.test(v)) throw new InvalidFullNameError('contains invalid characters');
    return new FullName(v);
  }

  toPrimitive(): string { return this.value; }
  equals(other: FullName): boolean { return this.value === other.value; }
}
