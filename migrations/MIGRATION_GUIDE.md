# Supabase 迁移指南

本指南帮助你创建自己的 Supabase 实例并迁移数据。

## 第一步：创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并登录（支持 GitHub、Google 账号登录）
2. 点击「New Project」创建新项目
3. 填写项目信息：
   - **Organization**: 选择或创建组织
   - **Project name**: `delta-ops`（或你喜欢的名字）
   - **Database Password**: 设置一个强密码（请记住）
   - **Region**: 选择离你最近的区域（推荐：Singapore 或 Tokyo）
4. 点击「Create new project」，等待项目创建完成（约2分钟）

## 第二步：获取 API 密钥

项目创建完成后：

1. 进入项目 Dashboard
2. 点击左侧菜单「Settings」→「API」
3. 记录以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 第三步：配置 Google OAuth（可选）

如果你要启用 Google 登录：

### 3.1 创建 Google OAuth 应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建新项目或选择现有项目
3. 点击「Create Credentials」→「OAuth client ID」
4. 应用类型选择「Web application」
5. 添加授权重定向 URI：
   ```
   https://你的项目ID.supabase.co/auth/v1/callback
   ```
6. 记录 **Client ID** 和 **Client Secret**

### 3.2 在 Supabase 配置 Google OAuth

1. 进入 Supabase Dashboard
2. 点击左侧菜单「Authentication」→「Providers」
3. 找到「Google」，点击启用
4. 填入：
   - **Client ID**: 从 Google Cloud Console 获取
   - **Client Secret**: 从 Google Cloud Console 获取
5. 点击「Save」

## 第四步：导入数据库结构

### 方法一：使用 SQL Editor（推荐）

1. 进入 Supabase Dashboard
2. 点击左侧菜单「SQL Editor」
3. 点击「New query」
4. 复制 `migrations/supabase_schema.sql` 的全部内容
5. 粘贴到编辑器中
6. 点击「Run」执行

### 方法二：使用命令行

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 连接项目
supabase link --project-ref 你的项目ID

# 执行迁移
supabase db push
```

## 第五步：更新项目环境变量

在沙箱中执行以下命令更新环境变量：

```bash
# 设置新的 Supabase 凭据
# 注意：需要通过系统设置环境变量，或联系管理员配置
```

或者，我可以帮你修改代码，支持从 `.env.local` 读取配置。

## 第六步：迁移数据（可选）

如果你要迁移现有数据：

### 方法一：使用 CSV 导入

1. 从旧数据库导出数据（执行 `migrations/export_data.sql`）
2. 在新 Supabase 中使用 Table Editor 导入 CSV

### 方法二：使用 pg_dump

```bash
# 从旧数据库导出
pg_dump "旧数据库连接字符串" > backup.sql

# 导入到新数据库
psql "新数据库连接字符串" < backup.sql
```

## 环境变量配置

创建 `.env.local` 文件：

```env
# Supabase 配置
COZE_SUPABASE_URL=https://你的项目ID.supabase.co
COZE_SUPABASE_ANON_KEY=你的anon_key

# LLM API 配置（如需使用 AI 功能）
COZE_DASHSCOPE_API_KEY=你的API密钥
```

## 验证配置

执行以下测试：

```bash
# 测试数据库连接
curl -s "https://你的项目ID.supabase.co/rest/v1/players" \
  -H "apikey: 你的anon_key" \
  -H "Authorization: Bearer 你的anon_key"
```

如果返回 `[]` 或数据列表，说明配置成功。

---

## 需要我帮你做什么？

1. **修改代码**：让项目支持自定义 Supabase 配置
2. **生成迁移脚本**：导出现有数据
3. **其他问题**：随时告诉我

请告诉我你的 Supabase 项目 URL 和 anon key，我可以帮你更新项目配置。
