import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';
import { AccountEventRepository } from '../../domain/ports/AccountEventRepository.port.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface RemoveEmployeeByCommerceDto {
  callerRef: string;
  accountId: string;
}

export class RemoveEmployeeByCommerceUseCase {
  constructor(
    private readonly repo: AccountRepository,
    private readonly eventRepo: AccountEventRepository,
  ) {}

  async execute(dto: RemoveEmployeeByCommerceDto): Promise<void> {
    const callerRef = IdentityRef.fromPrimitive(dto.callerRef);

    const callerCommerce = await this.repo.findByIdentityRefAndType(callerRef, AccountType.commerce());
    if (!callerCommerce || !callerCommerce.getStatus().isActive()) {
      throw new InsufficientPermissionsError();
    }

    const account = await this.repo.findById(AccountId.fromPrimitive(dto.accountId));
    if (!account) throw new AccountNotFoundError();
    if (!account.getType().isEmployee()) throw new InsufficientPermissionsError();

    account.deactivate();
    await this.repo.save(account);

    this.eventRepo.save({ accountId: account.getId(), type: 'deactivated', performedBy: callerRef })
      .catch(err => logger.warn({ err }, '[RemoveEmployeeByCommerce] event error'));
  }
}
