import { z } from 'zod';

export function authFormSchema(mode: 'login' | 'register') {
  return z
    .object({
      name: z.string().trim().max(100, 'Use at most 100 characters.'),
      email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')),
      password: z
        .string()
        .min(
          mode === 'register' ? 8 : 1,
          mode === 'register' ? 'Use at least 8 characters.' : 'Enter your password.',
        )
        .max(72, 'Use a shorter password.')
        .refine(
          (value) => new TextEncoder().encode(value).length <= 72,
          'Use at most 72 UTF-8 bytes.',
        ),
      confirmPassword: z.string(),
    })
    .superRefine((value, ctx) => {
      if (mode !== 'register') return;
      if (!value.name)
        ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter your name.' });
      if (value.password !== value.confirmPassword)
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'Passwords do not match.',
        });
    });
}
export type AuthFormValues = z.infer<ReturnType<typeof authFormSchema>>;
