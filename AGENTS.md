# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # API 路由
│   │   │   ├── auth/       # 认证（访客会话、注册）
│   │   │   ├── gacha/      # 扭蛋（抽卡、统计、收藏）
│   │   │   └── game/       # 暗区行动（开局、移动、撤离）
│   │   └── page.tsx        # 首页
│   ├── components/
│   │   ├── ui/             # Shadcn UI 组件库
│   │   └── game/           # 暗区行动游戏组件
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/
│   │   ├── auth/           # 认证模块（HMAC 签名、JWT 验证）
│   │   ├── game/           # 游戏逻辑（扭蛋、暗区行动）
│   │   └── utils.ts        # 通用工具函数 (cn)
│   ├── storage/database/   # Drizzle ORM + Supabase
│   └── __tests__/          # 测试（Vitest, 103 tests）
├── drizzle/                # 数据库迁移 SQL
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下`package.json`文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。


## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**


