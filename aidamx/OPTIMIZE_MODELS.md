# 模型加载优化方案

## 问题描述

1. 模型加载很慢，需要很长时间才能显示模型列表
2. 更换浏览器时模型列表不一致
3. 当第三方添加或删除模型时，需要能够实时更新模型列表

## 解决方案

我们实现了以下改进:

### 1. 优化模型加载逻辑
- 不再保存完整的模型列表到数据库和本地存储
- 从API端点直接获取最新的模型列表
- 只在数据库中保存必要的API配置和自定义设置（如图标和标签）

### 2. 改进模型设置存储
- 将用户的模型选择保存到数据库中（对于已登录用户）
- 使用cookies保存匿名用户的模型选择
- 创建user_model_settings表来存储用户的模型偏好

### 3. 添加模型列表刷新功能
- 在聊天界面加入手动刷新模型列表的按钮
- 显示加载状态，提供更好的用户体验

### 4. 数据库表结构修改
- 添加user_model_settings表，用于存储用户的模型选择
- 更新数据库重置API以正确处理新表

## 安装说明

我们已经在`database/init.sql`中添加了`user_model_settings`表定义。要应用这些更改，请按照以下步骤操作：

1. 确保数据库已初始化并运行
2. 执行`database/init.sql`脚本重新初始化数据库结构
3. 重启应用程序以应用更改

如果您已经有数据并且不想重新初始化整个数据库，可以单独执行以下SQL语句来添加新表：

```sql
CREATE TABLE IF NOT EXISTS `user_model_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `selected_model` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `user_id_unique` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`selected_model`) REFERENCES `models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
``` 