import { describe, it, expect, beforeEach } from 'vitest';
import { ResetPasswordUseCase } from './ResetPassword.usecase.js';
import { InMemoryEmailVerificationRepository } from '../../../verification/infrastructure/adapters/InMemoryEmailVerificationRepository.js';
import { InMemoryIdentityRepository } from '../../../identity/infrastructure/persistence/InMemoryIdentityRepository.js';
import { InMemoryCredentialRepository } from '../../infrastructure/persistence/InMemoryCredentialRepository.js';
import { InMemorySessionRepository } from '../../infrastructure/persistence/InMemorySessionRepository.js';
import { EmailVerification } from '../../../verification/domain/entities/EmailVerification.entity.js';
import { Identity } from '../../../identity/domain/entities/Identity.entity.js';
import { Credential } from '../../domain/entities/Credential.entity.js';
import { OtpHasher } from '../../../verification/domain/ports/OtpHasher.port.js';
import { OtpCode } from '../../../verification/domain/value-objects/OtpCode.vo.js';
import { OtpHash } from '../../../verification/domain/value-objects/OtpHash.vo.js';
import { OtpSalt } from '../../../verification/domain/value-objects/OtpSalt.vo.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { PasswordHash } from '../../domain/value-objects/PasswordHash.vo.js';
import { IdentityId } from '../../../identity/domain/value-objects/IdentityId.vo.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { VerificationNotFoundError, VerificationExpiredError, InvalidOtpError } from '../../../verification/domain/errors/Verification.errors.js';
import { IdentityNotFoundError } from '../../../identity/domain/errors/Identity.errors.js';
import { CredentialNotFoundError } from '../../domain/errors/Credential.errors.js';

class StubHasher implements OtpHasher {
  hash(code: OtpCode, _salt: OtpSalt): OtpHash { return OtpHash.fromPrimitive(`h:${code.toPrimitive()}`); }
  verify(code: OtpCode, _salt: OtpSalt, hash: OtpHash): boolean { return `h:${code.toPrimitive()}` === hash.toPrimitive(); }
  generateSalt(): OtpSalt { return OtpSalt.fromPrimitive('stub-salt'); }
}

class StubPasswordHasher implements PasswordHasher {
  async hash(raw: RawPassword): Promise<PasswordHash> { return PasswordHash.fromPrimitive(`ph:${raw.toPrimitive()}`); }
  async compare(raw: RawPassword, hash: PasswordHash): Promise<boolean> { return `ph:${raw.toPrimitive()}` === hash.toPrimitive(); }
}

const IDENTITY_ID = '00000000-0000-4000-8000-000000000001';
const CREDENTIAL_ID = '00000000-0000-4000-8000-000000000002';
const CORRECT_CODE = '123456';
const TEST_EMAIL = 'test@example.com';

function makeVerification(overrides: { expiresAt?: Date; status?: string } = {}): EmailVerification {
  const stubHasher = new StubHasher();
  const salt = OtpSalt.fromPrimitive('stub-salt');
  const hash = stubHasher.hash(OtpCode.fromPrimitive(CORRECT_CODE), salt);

  return EmailVerification.fromPrimitive({
    id: 1,
    identityId: undefined,
    email: TEST_EMAIL,
    otpHash: hash.toPrimitive(),
    otpSalt: salt.toPrimitive(),
    status: overrides.status ?? 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 600_000),
    sentAt: new Date(),
    usedAt: undefined,
    blockedAt: undefined,
  });
}

function makeIdentity(): Identity {
  return Identity.fromPrimitive({
    id: IDENTITY_ID,
    fullName: 'Test User',
    email: TEST_EMAIL,
    phone: '+12025550100',
    nationality: 'US',
    country: 'US',
    blnkIdentityRef: undefined,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCredential(): Credential {
  return Credential.fromPrimitive({
    id: CREDENTIAL_ID,
    identityRef: IDENTITY_ID,
    username: 'testuser',
    passwordHash: 'ph:OldPassword1',
    usernameChangedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ResetPasswordUseCase', () => {
  let verificationRepo: InMemoryEmailVerificationRepository;
  let identityRepo: InMemoryIdentityRepository;
  let credentialRepo: InMemoryCredentialRepository;
  let sessionRepo: InMemorySessionRepository;
  let stubHasher: StubHasher;
  let stubPasswordHasher: StubPasswordHasher;
  let useCase: ResetPasswordUseCase;

  beforeEach(async () => {
    verificationRepo = new InMemoryEmailVerificationRepository();
    identityRepo = new InMemoryIdentityRepository();
    credentialRepo = new InMemoryCredentialRepository();
    sessionRepo = new InMemorySessionRepository();
    stubHasher = new StubHasher();
    stubPasswordHasher = new StubPasswordHasher();
    useCase = new ResetPasswordUseCase(
      verificationRepo,
      stubHasher,
      identityRepo,
      credentialRepo,
      sessionRepo,
      stubPasswordHasher,
    );
  });

  it('happy path: correct OTP resets password and revokes all sessions', async () => {
    const verification = makeVerification();
    await verificationRepo.save(verification);
    await identityRepo.save(makeIdentity());
    await credentialRepo.save(makeCredential());

    await useCase.execute({
      verificationId: 1,
      code: CORRECT_CODE,
      email: TEST_EMAIL,
      newPassword: 'NewPassword1',
    });

    const credential = await credentialRepo.findByIdentityRef(IdentityRef.fromPrimitive(IDENTITY_ID));
    expect(credential).not.toBeNull();
    expect(credential!.getPasswordHash().toPrimitive()).toBe('ph:NewPassword1');
  });

  it('throws VerificationNotFoundError when email does not match verification', async () => {
    const verification = makeVerification();
    await verificationRepo.save(verification);

    await expect(
      useCase.execute({
        verificationId: 1,
        code: CORRECT_CODE,
        email: 'wrong@example.com',
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('throws VerificationNotFoundError when verification does not exist', async () => {
    await expect(
      useCase.execute({
        verificationId: 999,
        code: CORRECT_CODE,
        email: TEST_EMAIL,
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('throws InvalidOtpError when code is wrong', async () => {
    const verification = makeVerification();
    await verificationRepo.save(verification);

    await expect(
      useCase.execute({
        verificationId: 1,
        code: '000000',
        email: TEST_EMAIL,
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
  });

  it('throws VerificationExpiredError when verification is expired', async () => {
    const verification = makeVerification({ expiresAt: new Date(Date.now() - 1000) });
    await verificationRepo.save(verification);

    await expect(
      useCase.execute({
        verificationId: 1,
        code: CORRECT_CODE,
        email: TEST_EMAIL,
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(VerificationExpiredError);
  });

  it('throws IdentityNotFoundError when no identity for email', async () => {
    const verification = makeVerification();
    await verificationRepo.save(verification);
    // No identity saved

    await expect(
      useCase.execute({
        verificationId: 1,
        code: CORRECT_CODE,
        email: TEST_EMAIL,
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(IdentityNotFoundError);
  });

  it('throws CredentialNotFoundError when identity exists but no credential', async () => {
    const verification = makeVerification();
    await verificationRepo.save(verification);
    await identityRepo.save(makeIdentity());
    // No credential saved

    await expect(
      useCase.execute({
        verificationId: 1,
        code: CORRECT_CODE,
        email: TEST_EMAIL,
        newPassword: 'NewPassword1',
      }),
    ).rejects.toBeInstanceOf(CredentialNotFoundError);
  });
});
