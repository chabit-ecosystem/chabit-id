import { z } from 'zod';

export const registerSchema = z.object({
  verificationId: z.number().int().positive(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
