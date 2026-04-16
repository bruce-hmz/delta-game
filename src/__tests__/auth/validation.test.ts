import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, registerSchema, loginSchema } from '@/lib/auth/validation';

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test+123@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should accept valid password (>=8 chars, with letter and number)', () => {
    expect(validatePassword('password123')).toBe(true);
    expect(validatePassword('MyP@ssw0rd')).toBe(true);
  });

  it('should reject short password', () => {
    expect(validatePassword('short1')).toBe(false);
  });

  it('should reject password without letter', () => {
    expect(validatePassword('12345678')).toBe(false);
  });

  it('should reject password without number', () => {
    expect(validatePassword('password')).toBe(false);
  });
});

describe('registerSchema', () => {
  it('should validate valid register input', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      guestSessionId: 'guest-123'
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'invalid-email',
      password: 'password123'
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short'
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without letter', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: '12345678'
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password'
    });
    expect(result.success).toBe(false);
  });

  it('should accept without guestSessionId', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123'
    });
    expect(result.success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('should validate valid login input', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123'
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: ''
    });
    expect(result.success).toBe(false);
  });
});
