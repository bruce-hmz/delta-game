import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validatePassword(password: string): boolean {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

export const registerSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string()
    .min(8, '密码至少需要8位')
    .regex(/[a-zA-Z]/, '密码需要包含字母')
    .regex(/\d/, '密码需要包含数字'),
  guestSessionId: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(1, '请输入密码')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
