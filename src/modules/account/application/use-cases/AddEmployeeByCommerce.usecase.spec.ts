import { describe, it, expect, beforeEach } from 'vitest';
import { AddEmployeeByCommerceUseCase } from './AddEmployeeByCommerce.usecase.js';
import { RequestCommerceUseCase } from './RequestCommerce.usecase.js';
import { CreateAccountUseCase } from './CreateAccount.usecase.js';
import { InMemoryAccountRepository } from '../../infrastructure/persistence/InMemoryAccountRepository.js';
import { InMemoryAccountEventRepository } from '../../infrastructure/persistence/InMemoryAccountEventRepository.js';
import { AccountAlreadyExistsError, InsufficientPermissionsError } from '../../domain/errors/Account.errors.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { Account } from '../../domain/entities/Account.entity.js';
import { ApproveOrganizerUseCase } from './ApproveOrganizer.usecase.js';

const COMMERCE_REF = '00000000-0000-4000-8000-000000000001';
const TARGET_REF   = '00000000-0000-4000-8000-000000000002';
const ADMIN_REF    = '00000000-0000-4000-8000-000000000010';

describe('AddEmployeeByCommerceUseCase', () => {
  let repo: InMemoryAccountRepository;
  let eventRepo: InMemoryAccountEventRepository;
  let useCase: AddEmployeeByCommerceUseCase;
  let createAccount: CreateAccountUseCase;
  let requestCommerce: RequestCommerceUseCase;
  let approveOrganizer: ApproveOrganizerUseCase;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
    eventRepo = new InMemoryAccountEventRepository();
    useCase = new AddEmployeeByCommerceUseCase(repo, eventRepo);
    createAccount = new CreateAccountUseCase(repo, eventRepo);
    requestCommerce = new RequestCommerceUseCase(repo, eventRepo);
    approveOrganizer = new ApproveOrganizerUseCase(repo, eventRepo);
  });

  const seedActiveCommerce = async () => {
    const adminId = AccountId.generate();
    const adminAccount = Account.createAdmin(adminId, IdentityRef.fromPrimitive(ADMIN_REF), IdentityRef.fromPrimitive(ADMIN_REF));
    await repo.save(adminAccount);

    await createAccount.execute({ identityRef: COMMERCE_REF, type: 'USER' });
    const { accountId } = await requestCommerce.execute({ callerRef: COMMERCE_REF });
    await approveOrganizer.execute({ accountId, callerRef: ADMIN_REF });
  };

  it('creates an ACTIVE EMPLOYEE account when caller has ACTIVE COMMERCE', async () => {
    await seedActiveCommerce();
    const result = await useCase.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF });
    expect(result.accountId).toBeTruthy();

    const account = await repo.findByIdentityRefAndType(
      IdentityRef.fromPrimitive(TARGET_REF),
      AccountType.employee(),
    );
    expect(account?.getStatus().toPrimitive()).toBe('ACTIVE');
    expect(account?.getCreatedBy()?.toPrimitive()).toBe(COMMERCE_REF);
  });

  it('throws InsufficientPermissionsError when caller has no COMMERCE account', async () => {
    await expect(
      useCase.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it('throws InsufficientPermissionsError when COMMERCE is PENDING (not ACTIVE)', async () => {
    await createAccount.execute({ identityRef: COMMERCE_REF, type: 'USER' });
    await requestCommerce.execute({ callerRef: COMMERCE_REF });

    await expect(
      useCase.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it('throws AccountAlreadyExistsError when target already has EMPLOYEE account', async () => {
    await seedActiveCommerce();
    await useCase.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF });

    await expect(
      useCase.execute({ callerRef: COMMERCE_REF, targetRef: TARGET_REF }),
    ).rejects.toThrow(AccountAlreadyExistsError);
  });
});
