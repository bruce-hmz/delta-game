'use client';

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { AuthForm } from './AuthForm';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  guestSessionId?: string;
  onUpgradeSuccess: (data: { accessToken: string; playerId: string; user: any }) => void;
}

export function UpgradePrompt({ isOpen, onClose, guestSessionId, onUpgradeSuccess }: UpgradePromptProps) {
  const [step, setStep] = useState<'intro' | 'form'>('intro');

  const handleSuccess = (data: { accessToken: string; playerId: string; user: any }) => {
    onUpgradeSuccess(data);
    onClose();
    setStep('intro');
  };

  const handleCancel = () => {
    onClose();
    setStep('intro');
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DrawerContent className="bg-zinc-900 border-zinc-800">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="text-center">
            <DrawerTitle className="text-white">
              {step === 'intro' ? '升级账号' : '创建账号'}
            </DrawerTitle>
            <DrawerDescription className="text-zinc-400">
              {step === 'intro' 
                ? '升级后可保存抽卡记录，每日开箱次数从3次提升到5次'
                : '请输入邮箱和密码完成注册'
              }
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 pb-8">
            {step === 'intro' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-zinc-800 p-3 rounded-lg">
                    <div className="text-2xl mb-1">3</div>
                    <div className="text-xs text-zinc-500">当前每日次数</div>
                  </div>
                  <div className="bg-amber-500/20 p-3 rounded-lg border border-amber-500/30">
                    <div className="text-2xl mb-1 text-amber-400">5</div>
                    <div className="text-xs text-amber-400">升级后每日次数</div>
                  </div>
                </div>

                <ul className="text-sm text-zinc-400 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    永久保存抽卡历史
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    每日开箱次数 +2
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    跨设备同步数据
                  </li>
                </ul>

                <button
                  onClick={() => setStep('form')}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
                >
                  立即升级
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-3 text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  稍后再说
                </button>
              </div>
            ) : (
              <AuthForm
                mode="register"
                guestSessionId={guestSessionId}
                onSuccess={handleSuccess}
                onCancel={() => setStep('intro')}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
