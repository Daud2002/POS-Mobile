import { z } from 'zod';

/**
 * Change-password validation.
 *
 * The 6-character minimum mirrors the backend's `@MinLength(6)` on
 * ChangePasswordDto, so the client rejects what the server would reject anyway
 * — without a round-trip. The same rules are applied on the web form.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
