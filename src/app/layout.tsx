import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import CozeAnalytics from '@/components/CozeAnalytics';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI 战术参谋 | 三角洲行动 - 智能撤离模拟',
    template: '%s | 三角洲行动',
  },
  description:
    'AI 驱动的智能撤离模拟器。你的每一次决策，都有 AI 战术参谋实时分析。每局事件由 AI 生成永不重复，风格标签记录你的战术偏好。探索、博弈、撤离 —— 这是你的专属 AI 战术故事。',
  keywords: [
    'AI 战术',
    '智能撤离',
    '三角洲行动',
    'Delta Ops',
    '战术模拟',
    'AI 参谋',
    '文字游戏',
    '策略游戏',
    'AI 游戏',
  ],
  authors: [{ name: 'Delta Ops Team' }],
  openGraph: {
    title: 'AI 战术参谋 | 三角洲行动',
    description:
      'AI 实时分析你的决策，推荐撤离时机。每局 AI 生成事件永不重复，你的战术风格被 AI 记住。',
    siteName: '三角洲行动',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
        <CozeAnalytics />
      </body>
    </html>
  );
}
