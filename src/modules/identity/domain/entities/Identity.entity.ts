import { IdentityId } from '../value-objects/IdentityId.vo.js';
import { FullName } from '../value-objects/FullName.vo.js';
import { Nationality } from '../value-objects/Nationality.vo.js';
import { Country } from '../value-objects/Country.vo.js';
import { BlnkIdentityRef } from '../value-objects/BlnkIdentityRef.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { BlnkRefAlreadyAssignedError, EmailNotVerifiedError } from '../errors/Identity.errors.js';

export interface IdentityPrimitives {
  id: string;
  fullName: string | undefined;
  email: string;
  phone: string | undefined;
  nationality: string | undefined;
  country: string | undefined;
  blnkIdentityRef: string | undefined;
  emailVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Identity {
  private readonly id: IdentityId;
  private fullName: FullName | undefined;
  private readonly email: Email;
  private phone: PhoneNumber | undefined;
  private nationality: Nationality | undefined;
  private country: Country | undefined;
  private blnkIdentityRef: BlnkIdentityRef | undefined;
  private readonly emailVerifiedAt: Date;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: {
    id: IdentityId;
    fullName: FullName | undefined;
    email: Email;
    phone: PhoneNumber | undefined;
    nationality: Nationality | undefined;
    country: Country | undefined;
    blnkIdentityRef: BlnkIdentityRef | undefined;
    emailVerifiedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.email = props.email;
    this.phone = props.phone;
    this.nationality = props.nationality;
    this.country = props.country;
    this.blnkIdentityRef = props.blnkIdentityRef;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: {
    id: IdentityId;
    fullName?: FullName;
    email: Email;
    phone?: PhoneNumber;
    nationality?: Nationality;
    country?: Country;
    emailVerifiedAt: Date;
  }): Identity {
    if (!props.emailVerifiedAt) throw new EmailNotVerifiedError();
    const now = new Date();
    return new Identity({
      id: props.id,
      fullName: props.fullName,
      email: props.email,
      phone: props.phone,
      nationality: props.nationality,
      country: props.country,
      emailVerifiedAt: props.emailVerifiedAt,
      blnkIdentityRef: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPrimitive(data: IdentityPrimitives): Identity {
    return new Identity({
      id: IdentityId.fromPrimitive(data.id),
      fullName: data.fullName ? FullName.fromPrimitive(data.fullName) : undefined,
      email: Email.fromPrimitive(data.email),
      phone: data.phone ? PhoneNumber.fromPrimitive(data.phone) : undefined,
      nationality: data.nationality ? Nationality.fromPrimitive(data.nationality) : undefined,
      country: data.country ? Country.fromPrimitive(data.country) : undefined,
      blnkIdentityRef: data.blnkIdentityRef ? BlnkIdentityRef.fromPrimitive(data.blnkIdentityRef) : undefined,
      emailVerifiedAt: data.emailVerifiedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  assignBlnkRef(ref: BlnkIdentityRef): void {
    if (this.blnkIdentityRef !== undefined) throw new BlnkRefAlreadyAssignedError();
    this.blnkIdentityRef = ref;
    this.updatedAt = new Date();
  }

  updateProfile(props: {
    fullName?: FullName;
    phone?: PhoneNumber;
    nationality?: Nationality;
    country?: Country;
  }): void {
    if (props.fullName) this.fullName = props.fullName;
    if (props.phone) this.phone = props.phone;
    if (props.nationality) this.nationality = props.nationality;
    if (props.country) this.country = props.country;
    this.updatedAt = new Date();
  }

  getId(): IdentityId { return this.id; }
  getEmail(): Email { return this.email; }
  getPhone(): PhoneNumber | undefined { return this.phone; }
  getFullName(): FullName | undefined { return this.fullName; }
  getNationality(): Nationality | undefined { return this.nationality; }
  getCountry(): Country | undefined { return this.country; }
  getBlnkIdentityRef(): BlnkIdentityRef | undefined { return this.blnkIdentityRef; }
  getEmailVerifiedAt(): Date { return this.emailVerifiedAt; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  toPrimitive(): IdentityPrimitives {
    return {
      id: this.id.toPrimitive(),
      fullName: this.fullName?.toPrimitive(),
      email: this.email.toPrimitive(),
      phone: this.phone?.toPrimitive(),
      nationality: this.nationality?.toPrimitive(),
      country: this.country?.toPrimitive(),
      blnkIdentityRef: this.blnkIdentityRef?.toPrimitive(),
      emailVerifiedAt: this.emailVerifiedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
