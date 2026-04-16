import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('supports TypeScript', () => {
    const quality: 'white' | 'blue' | 'purple' | 'red' | 'gold' = 'red';
    expect(quality).toBe('red');
  });
});
