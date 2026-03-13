import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { IdentityNotFoundError } from '../../domain/errors/Identity.errors.js';
import { IdentityPrimitives } from '../../domain/entities/Identity.entity.js';

export interface GetIdentityDto { identityId: string; }

export class GetIdentityUseCase {
  constructor(private readonly repo: IdentityRepository) {}

  async execute(dto: GetIdentityDto): Promise<IdentityPrimitives> {
    const id = IdentityId.fromPrimitive(dto.identityId);
    const identity = await this.repo.findById(id);
    if (!identity) throw new IdentityNotFoundError(dto.identityId);
    return identity.toPrimitive();
  }
}
