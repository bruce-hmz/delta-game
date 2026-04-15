# 邮件验证码发送配置指南

## 方案一：使用 Resend（推荐）

### 第一步：注册 Resend 账号

1. 访问 https://resend.com
2. 使用 GitHub 或 Google 账号登录
3. 免费额度：每月 3,000 封邮件

### 第二步：获取 API Key

1. 登录 Resend Dashboard
2. 点击 **API Keys** → **Create API Key**
3. 名称填写：`supabase-otp`
4. 复制生成的 API Key（以 `re_` 开头）

### 第三步：配置发件域名（重要）

1. Resend Dashboard → **Domains** → **Add Domain**
2. 输入你的域名（如 `yourdomain.com`）
3. 添加 DNS 记录验证域名：
   ```
   类型: MX
   名称: send
   值: feedback-smtp.us-east-1.amazonses.com
   ```
4. 验证通过后，发件地址可使用 `noreply@yourdomain.com`

**测试阶段**：可直接使用 `onboarding@resend.dev`（只能发给自己注册的邮箱）

### 第四步：在 Supabase 配置密钥

1. 打开 Supabase Dashboard → 你的项目
2. 进入 **Settings** → **Edge Functions**
3. 添加环境变量：
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```
4. 点击 **Save**

### 第五步：部署 Edge Function

**方式 A：通过 Supabase Dashboard（推荐）**

1. Supabase Dashboard → **Edge Functions**
2. 点击 **Create Function**
3. 名称输入：`send-otp-email`
4. 将 `supabase/functions/send-otp-email/index.ts` 的内容粘贴进去
5. 点击 **Deploy**

**方式 B：通过 CLI**

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 关联项目
supabase link --project-ref gcgqqxomjroctsyrzmim

# 部署函数
supabase functions deploy send-otp-email
```

### 第六步：测试

```bash
curl -X POST \
  'https://gcgqqxomjroctsyrzmim.supabase.co/functions/v1/send-otp-email' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"your@email.com","code":"123456"}'
```

---

## 方案二：使用 Supabase 内置邮件

Supabase 免费版邮件发送有限制，需要配置自定义 SMTP。

### 配置步骤

1. Supabase Dashboard → **Settings** → **Auth**
2. 找到 **Email** 部分
3. 配置 SMTP：
   ```
   Host: smtp.gmail.com (或其他 SMTP 服务)
   Port: 587
   User: your-email@gmail.com
   Password: your-app-password
   Sender Email: your-email@gmail.com
   Sender Name: 搜打撤战术模拟
   ```

### 使用 Supabase Magic Link

修改 `send-otp` API 使用 Supabase 原生的 Magic Link：

```typescript
const response = await fetch(`${supabaseUrl}/auth/v1/magiclink`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  },
  body: JSON.stringify({ email }),
});
```

---

## 推荐方案

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Resend** | 免费额度大、API 简单、邮件到达率高 | 需要验证域名 |
| **Supabase SMTP** | 集成度高 | 免费版限制多 |
| **开发模式** | 无需配置 | 仅用于测试 |

---

## 当前状态

- ✅ 验证码生成逻辑已完成
- ✅ 数据库存储验证码
- ⏳ Edge Function 需要部署
- ⏳ 邮件发送需要配置 Resend

**开发模式下**：API 会返回 `devCode`，可直接使用验证码登录，无需真实邮件。
