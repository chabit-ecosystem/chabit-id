import { EmailVerificationRepository } from '../../../verification/domain/ports/EmailVerificationRepository.port.js';
import { OtpHasher } from '../../../verification/domain/ports/OtpHasher.port.js';
import { OtpCode } from '../../../verification/domain/value-objects/OtpCode.vo.js';
import { VerificationId } from '../../../verification/domain/value-objects/VerificationId.vo.js';
import { IdentityRepository } from '../../../identity/domain/ports/IdentityRepository.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.port.js';
import { RawPassword } from '../../domain/value-objects/RawPassword.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { VerificationNotFoundError, VerificationExpiredError, VerificationBlockedError, InvalidOtpError } from '../../../verification/domain/errors/Verification.errors.js';
import { IdentityNotFoundError } from '../../../identity/domain/errors/Identity.errors.js';
import { CredentialNotFoundError } from '../../domain/errors/Credential.errors.js';

export interface ResetPasswordDto {
  verificationId: number;
  code: string;
  email: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly verificationRepo: EmailVerificationRepository,
    private readonly otpHasher: OtpHasher,
    private readonly identityRepo: IdentityRepository,
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    // 1. Load verification by ID
    const verificationId = VerificationId.fromPrimitive(dto.verificationId);
    const verification = await this.verificationRepo.findById(verificationId);
    if (!verification) throw new VerificationNotFoundError(dto.email);

    // 2. Email must match
    const email = Email.fromPrimitive(dto.email);
    if (verification.getEmail().toPrimitive() !== email.toPrimitive()) {
      throw new VerificationNotFoundError(dto.email);
    }

    // 3. Check expiry before attempt
    if (verification.isExpired()) {
      verification.expire();
      await this.verificationRepo.save(verification);
      throw new VerificationExpiredError();
    }

    // 4. Attempt OTP
    const code = OtpCode.fromPrimitive(dto.code);
    const result = verification.attempt(code, this.otpHasher);
    await this.verificationRepo.save(verification);

    if (result === 'blocked') {
      const BLOCKED_COOLDOWN_MS = 30 * 60 * 1000;
      const retryAfter = new Date(verification.getBlockedAt()!.getTime() + BLOCKED_COOLDOWN_MS);
      throw new VerificationBlockedError(retryAfter);
    }

    if (result === 'wrong_code') {
      throw new InvalidOtpError(verification.getMaxAttempts() - verification.getAttempts());
    }

    // result === 'used' — proceed with password reset

    // 5. Find Identity by email
    const identity = await this.identityRepo.findByEmail(email);
    if (!identity) throw new IdentityNotFoundError(dto.email);

    // 6. Find Credential by identityRef
    const identityRef = IdentityRef.fromPrimitive(identity.getId().toPrimitive());
    const credential = await this.credentialRepo.findByIdentityRef(identityRef);
    if (!credential) throw new CredentialNotFoundError();

    // 7. Hash new password and update
    const newHash = await this.passwordHasher.hash(RawPassword.fromPrimitive(dto.newPassword));
    credential.updatePassword(newHash);
    await this.credentialRepo.save(credential);

    // 8. Revoke all sessions
    await this.sessionRepo.deleteAllByCredentialId(credential.getId());
  }
}
