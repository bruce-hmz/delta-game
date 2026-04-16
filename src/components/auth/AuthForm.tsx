'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpWithEmail, signInWithEmail } from '@/lib/supabase-auth-client';

interface AuthFormProps {
  mode: 'register' | 'login';
  guestSessionId?: string;
  onSuccess: (data: { accessToken: string; playerId: string; user: any }) => void;
  onCancel?: () => void;
}

export function AuthForm({ mode, guestSessionId, onSuccess, onCancel }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length < 8) return 'weak';
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*]/.test(pwd);
    
    if (hasLetter && hasNumber && hasSpecial && pwd.length >= 12) return 'strong';
    if (hasLetter && hasNumber) return 'medium';
    return 'weak';
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    if (pwd) {
      setPasswordStrength(checkPasswordStrength(pwd));
    } else {
      setPasswordStrength(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (password.length < 8) {
      setError('密码至少需要8位');
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('密码需要包含字母和数字');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const result = mode === 'register'
        ? await signUpWithEmail(email, password, guestSessionId)
        : await signInWithEmail(email, password);

      if (result.success && result.accessToken && result.playerId) {
        onSuccess({
          accessToken: result.accessToken,
          playerId: result.playerId,
          user: result.user
        });
      } else {
        setError(result.error || '操作失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          placeholder="至少8位，包含字母和数字"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          disabled={loading}
          required
        />
        {mode === 'register' && passwordStrength && (
          <div className="text-xs">
            密码强度: 
            <span className={
              passwordStrength === 'strong' ? 'text-green-500' :
              passwordStrength === 'medium' ? 'text-yellow-500' : 'text-red-500'
            }>
              {passwordStrength === 'strong' ? '强' :
               passwordStrength === 'medium' ? '中' : '弱'}
            </span>
          </div>
        )}
      </div>

      {mode === 'register' && (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
          />
          {confirmPassword && password !== confirmPassword && (
            <div className="text-xs text-red-500">密码不匹配</div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
        >
          {loading ? '处理中...' : (mode === 'register' ? '注册' : '登录')}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            取消
          </Button>
        )}
      </div>
    </form>
  );
}
