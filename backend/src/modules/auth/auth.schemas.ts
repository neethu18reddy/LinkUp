import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z
  .string()
  .min(1)
  .max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Use at most 72 UTF-8 bytes.');

export const registerSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100)
    .refine(
      (value) =>
        [...value].every(
          (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      'Use a valid name.',
    ),
  email,
  password: password.refine((value) => value.length >= 8, 'Use at least 8 characters.'),
});
export const loginSchema = z.strictObject({ email, password });
export const emptyBodySchema = z.strictObject({});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
