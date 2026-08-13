-- 多服务商功能数据库迁移脚本
-- 运行此脚本以添加多服务商支持
-- 执行方式: mysql -u root -p your_database < migrations/add_providers.sql

-- 创建服务商表
CREATE TABLE IF NOT EXISTS `providers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `api_key` VARCHAR(255) NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建服务商模型表
CREATE TABLE IF NOT EXISTS `provider_models` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `provider_id` INT NOT NULL,
  `model_id` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(255),
  `is_enabled` BOOLEAN DEFAULT TRUE,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_provider_model` (`provider_id`, `model_id`),
  FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE CASCADE,
  INDEX `idx_provider_id` (`provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 可选：从旧的model_settings表迁移数据到新的providers表
-- 注意：执行前请备份数据库！
-- 取消下面的注释以执行迁移：

/*
INSERT INTO providers (name, endpoint, api_key, is_active, sort_order)
SELECT 
  '默认服务商',
  endpoint,
  api_key,
  TRUE,
  0
FROM model_settings
ORDER BY id DESC
LIMIT 1
ON DUPLICATE KEY UPDATE name = name;

-- 获取刚创建的provider ID
SET @new_provider_id = LAST_INSERT_ID();

-- 如果上面没有插入新记录（因为重复），获取第一个provider
IF @new_provider_id = 0 THEN
  SELECT id INTO @new_provider_id FROM providers ORDER BY id ASC LIMIT 1;
END IF;

-- 迁移已知的模型到provider_models表
INSERT INTO provider_models (provider_id, model_id, display_name, is_enabled, sort_order)
SELECT 
  @new_provider_id,
  id,
  id,
  TRUE,
  0
FROM models
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
*/

SELECT '迁移完成！请根据需要取消注释上面的迁移代码来迁移旧数据。' AS message;