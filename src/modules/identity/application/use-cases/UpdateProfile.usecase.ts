import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { FullName } from '../../domain/value-objects/FullName.vo.js';
import { Nationality } from '../../domain/value-objects/Nationality.vo.js';
import { Country } from '../../domain/value-objects/Country.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { IdentityNotFoundError, PhoneAlreadyRegisteredError } from '../../domain/errors/Identity.errors.js';

export interface UpdateProfileDto {
  identityId: string;
  fullName?: string;
  phone?: string;
  nationality?: string;
  country?: string;
}

export class UpdateProfileUseCase {
  constructor(private readonly repo: IdentityRepository) {}

  async execute(dto: UpdateProfileDto): Promise<void> {
    const id = IdentityId.fromPrimitive(dto.identityId);
    const identity = await this.repo.findById(id);
    if (!identity) throw new IdentityNotFoundError(dto.identityId);

    let phone: PhoneNumber | undefined;
    if (dto.phone) {
      phone = PhoneNumber.fromPrimitive(dto.phone);
      const existing = await this.repo.findByPhone(phone);
      if (existing && !existing.getId().equals(id)) {
        throw new PhoneAlreadyRegisteredError(dto.phone);
      }
    }

    identity.updateProfile({
      fullName: dto.fullName ? FullName.fromPrimitive(dto.fullName) : undefined,
      phone,
      nationality: dto.nationality ? Nationality.fromPrimitive(dto.nationality) : undefined,
      country: dto.country ? Country.fromPrimitive(dto.country) : undefined,
    });

    await this.repo.save(identity);
  }
}
