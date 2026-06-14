# Code Assistant 项目

一个集成了QQ邮箱登录和验证码功能的AI助手应用。

## 项目特点

- QQ邮箱验证码登录
- 自动获取QQ头像和昵称
- 响应式设计，支持暗色模式
- 个人中心和用户资料管理
- 管理员后台

## 技术栈

- 前端：React, Next.js 15, TailwindCSS
- 后端：Next.js API Routes
- 数据库：MySQL
- 认证：JWT, 邮箱验证码

## 启动项目

1. 安装依赖：
   ```bash
   npm install
   ```

2. 配置环境变量：
   确保`.env`文件包含所有必要的配置：
   - 数据库配置
   - JWT密钥
   - 邮箱配置
   - 管理员代码

3. 启动开发服务器：
   ```bash
   npm run dev
   ```
   
   应用将在 http://localhost:6677 上运行

## 数据库管理

### 初始化数据库

数据库表结构初始化可通过以下URL访问：

```
http://localhost:6677/api/admin/database/init?code=YOUR_ADMIN_CODE
```

替换`YOUR_ADMIN_CODE`为您在`.env`文件中设置的`ADMIN_CODE`值。

也可以运行：
```bash
npm run db:init
```
然后访问提示的URL。

### 查看数据库状态

```
http://localhost:6677/api/admin/database/status?code=YOUR_ADMIN_CODE
```

或运行：
```bash
npm run db:status
```

### 重置数据库

⚠️ 警告：这将删除所有数据！

```
http://localhost:6677/api/admin/database/reset?code=YOUR_ADMIN_CODE
```

或运行：
```bash
npm run db:reset
```

## 访问前端页面

- 主页：http://localhost:6677/
- 登录页：http://localhost:6677/login
- 个人中心：http://localhost:6677/profile
- 管理员登录：http://localhost:6677/code/login

## API路由

### 用户API

- 发送验证码：`POST /api/auth/send-code`
- 用户登录：`POST /api/auth/login`
- 更新用户信息：`PUT /api/user/update`

### 管理员API

- 管理员登录：`POST /api/admin/login`
- 数据库初始化：`GET /api/admin/database/init`
- 数据库状态：`GET /api/admin/database/status`
- 数据库重置：`GET /api/admin/database/reset`
