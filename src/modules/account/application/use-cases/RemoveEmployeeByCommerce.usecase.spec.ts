import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveEmployeeByCommerceUseCase } from './RemoveEmployeeByCommerce.usecase.js';
import { RemoveEmployeeByIdentityRefUseCase } from './RemoveEmployeeByIdentityRef.usecase.js';
import { AddEmployeeByCommerceUseCase } from './AddEmployeeByCommerce.usecase.js';
import { RequestCommerceUseCase } from './RequestCommerce.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { ApproveOrganizerUseCase } from './ApproveOrganizer.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountNotFoundError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';

const COMMERCE_REF = '00000000-0000-4000-8000-000000000001';
const TARGET_REF   = '00000000-0000-4000-8000-000000000002';
const ADMIN_REF    = '00000000-0000-4000-8000-000000000010';

describe('RemoveEmployeeByCommerceUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let removeByAccountId: RemoveEmployeeByCommerceUseCase;
  let removeByIdentityRef: RemoveEmployeeByIdentityRefUseCase;
  let addEmployee: AddEmployeeByCommerceUseCase;
  let createAccount: CreateAccountUseCase;
  let requestCommerce: RequestCommerceUseCase;
  let approveOrganizer: ApproveOrganizerUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    removeByAccountId = new RemoveEmployeeByCommerceUseCase(repo, eventRepo);
    removeByIdentityRef = new RemoveEmployeeByIdentityRefUseCase(repo, eventRepo);
    addEmployee = new AddEmployeeByCommerceUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    requestCommerce = new RequestCommerceUseCase(repo, eventRepo);
    approveOrganizer = new ApproveOrganizerUseCase(repo, eventRepo);
  });

  const seedActiveCommerce = async () => {
    const adminAccount = Account.createAdmin(
      AccountId.generate(),
      IdentityRef.fromPrimitive(ADMIN_REF),
      IdentityRef.fromPrimitive(ADMIN_REF),
    );
    await repo.save(adminAccount);
    await createAccount.execute({ identityRef: COMMERCE_REF, type: 'USER' });
    const { accountId } = await requestCommerce.execute({ callerRef: COMMERCE_REF });
    await approveOrganizer.execute({ accountId, callerRef: ADMIN_REF });
  };

  describe('by accountId', () => {
    it('deactivates an ACTIVE EMPLOYEE account', async () => {
      await seedActiveCommerce();
      const { accountId } = await addEmployee.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF });

      await removeByAccountId.execute({ callerRef: COMMERCE_REF, accountId });

      const account = await repo.findById(AccountId.fromPrimitive(accountId));
      expect(account?.getStatus().toPrimitive()).toBe('DEACTIVATED');
    });

    it('throws InsufficientPermissionsError when caller has no ACTIVE COMMERCE', async () => {
      await expect(
        removeByAccountId.execute({ callerRef: COMMERCE_REF, accountId: '00000000-0000-4000-8000-000000000099' }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });

    it('throws AccountNotFoundError when accountId does not exist', async () => {
      await seedActiveCommerce();
      await expect(
        removeByAccountId.execute({ callerRef: COMMERCE_REF, accountId: '00000000-0000-4000-8000-000000000099' }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws InsufficientPermissionsError when account is not EMPLOYEE', async () => {
      await seedActiveCommerce();
      const { accountId } = await createAccount.execute({ identityRef: TARGET_REF, type: 'USER' });

      await expect(
        removeByAccountId.execute({ callerRef: COMMERCE_REF, accountId }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });
  });

  describe('by identityRef', () => {
    it('deactivates EMPLOYEE account by target identityRef', async () => {
      await seedActiveCommerce();
      await addEmployee.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF });

      await removeByIdentityRef.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF });

      const account = await repo.findByIdentityRefAndType(
        IdentityRef.fromPrimitive(TARGET_REF),
        (await import('../../domain/value-objects/AccountType.vo.js')).AccountType.employee(),
      );
      expect(account?.getStatus().toPrimitive()).toBe('DEACTIVATED');
    });

    it('throws InsufficientPermissionsError when caller has no ACTIVE COMMERCE', async () => {
      await expect(
        removeByIdentityRef.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF }),
      ).rejects.toThrow(InsufficientPermissionsError);
    });

    it('throws AccountNotFoundError when target has no EMPLOYEE account', async () => {
      await seedActiveCommerce();
      await expect(
        removeByIdentityRef.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF }),
      ).rejects.toThrow(AccountNotFoundError);
    });
  });
});
