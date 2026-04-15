import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '三角洲战利品 | 开箱模拟',
    template: '%s | 三角洲战利品',
  },
  description:
    'CS:GO风格的军事箱子开箱模拟器。点击、翻转、开箱。红色品质触发粒子爆炸和自动录屏。每次开箱只需8秒。',
  keywords: [
    '开箱模拟',
    'gacha',
    '三角洲行动',
    '军事箱子',
    '抽卡',
    '手机游戏',
    '短视频分享',
  ],
  authors: [{ name: 'Delta Ops Team' }],
  openGraph: {
    title: '三角洲战利品 | 开箱模拟',
    description:
      '军事箱子开箱模拟，红色战利品粒子爆炸+自动录屏分享。',
    siteName: '三角洲战利品',
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
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
