import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface RemoveEmployeeByIdentityRefDto {
  callerRef: string;
  targetRef: string;
}

export class RemoveEmployeeByIdentityRefUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RemoveEmployeeByIdentityRefDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);
    const targetRef = IdentityRef.fromPrimitive(dto.targetRef);

    const callerCommerce = await this.repo.findByIdentityRefAndType(callerRef, AccountType.commerce());
    if (!callerCommerce || !callerCommerce.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const account = await this.repo.findByIdentityRefAndType(targetRef, AccountType.employee());
    if (!account) throw new AccountNotFoundError();

    account.deactivate();
    await this.repo.save(account);

    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RemoveEmployeeByIdentityRef] event error'));
  }
}
