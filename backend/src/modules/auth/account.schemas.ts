import { z } from 'zod';
import { registerSchema } from './auth.schemas.js';
export const forgotSchema = z.strictObject({ email: registerSchema.shape.email });
export const tokenSchema = z.strictObject({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const resetSchema = tokenSchema.extend({ password: registerSchema.shape.password });
