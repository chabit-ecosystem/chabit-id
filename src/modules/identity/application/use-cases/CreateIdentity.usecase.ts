import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { Identity } from '../../domain/entities/Identity.entity.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { FullName } from '../../domain/value-objects/FullName.vo.js';
import { Nationality } from '../../domain/value-objects/Nationality.vo.js';
import { Country } from '../../domain/value-objects/Country.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { EmailAlreadyRegisteredError, PhoneAlreadyRegisteredError } from '../../domain/errors/Identity.errors.js';

export interface CreateIdentityDto {
  email: string;
  emailVerifiedAt: Date;
  fullName?: string;
  phone?: string;
  nationality?: string;
  country?: string;
}

export interface CreateIdentityResult {
  identityId: string;
}

export class CreateIdentityUseCase {
  constructor(private readonly repo: IdentityRepository) {}

  async execute(dto: CreateIdentityDto): Promise<CreateIdentityResult> {
    const email = Email.fromPrimitive(dto.email);

    const existing = await this.repo.findByEmail(email);
    if (existing) throw new EmailAlreadyRegisteredError(email.toPrimitive());

    let phone: PhoneNumber | undefined;
    if (dto.phone) {
      phone = PhoneNumber.fromPrimitive(dto.phone);
      const existingPhone = await this.repo.findByPhone(phone);
      if (existingPhone) throw new PhoneAlreadyRegisteredError(phone.toPrimitive());
    }

    const identity = Identity.create({
      id: IdentityId.generate(),
      fullName: dto.fullName ? FullName.fromPrimitive(dto.fullName) : undefined,
      email,
      phone,
      nationality: dto.nationality ? Nationality.fromPrimitive(dto.nationality) : undefined,
      country: dto.country ? Country.fromPrimitive(dto.country) : undefined,
      emailVerifiedAt: dto.emailVerifiedAt,
    });

    await this.repo.save(identity);
    return { identityId: identity.getId().toPrimitive() };
  }
}
