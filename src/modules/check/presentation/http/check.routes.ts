import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import { usernameCheckSchema, emailCheckSchema, phoneCheckSchema } from './check.schemas.js';
import type { IdentityRepository } from '../../../identity/domain/ports/IdentityRepository.port.js';
import type { CredentialRepository } from '../../../credential/domain/ports/CredentialRepository.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { Username } from '../../../credential/domain/value-objects/Username.vo.js';

export function createCheckRoutes(
  identityRepo: IdentityRepository,
  credentialRepo: CredentialRepository,
): Hono {
  const router = new Hono();

  const checkLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 20,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  });

  // GET /check/username?value=foo
  router.get(
    '/username',
    checkLimiter,
    zValidator('query', usernameCheckSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid query param', details: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const { value } = c.req.valid('query');
      const existing = await credentialRepo.findByUsername(Username.fromPrimitive(value.trim().toLowerCase()));
      return c.json({ available: existing === null }, 200);
    },
  );

  // GET /check/email?value=foo@bar.com
  router.get(
    '/email',
    checkLimiter,
    zValidator('query', emailCheckSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid query param', details: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const { value } = c.req.valid('query');
      const existing = await identityRepo.findByEmail(Email.fromPrimitive(value));
      return c.json({ available: existing === null }, 200);
    },
  );

  // GET /check/phone?value=+541112345678
  router.get(
    '/phone',
    checkLimiter,
    zValidator('query', phoneCheckSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid query param', details: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const { value } = c.req.valid('query');
      const existing = await identityRepo.findByPhone(PhoneNumber.fromPrimitive(value));
      return c.json({ available: existing === null }, 200);
    },
  );

  return router;
}
