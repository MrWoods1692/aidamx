-- 创建提示词设定表
CREATE TABLE IF NOT EXISTS `prompt_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `content` TEXT NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 为 provider_models 表添加 prompt_id 字段
ALTER TABLE `provider_models` 
ADD COLUMN `prompt_id` INT DEFAULT NULL AFTER `sort_order`,
ADD CONSTRAINT `fk_provider_models_prompt` FOREIGN KEY (`prompt_id`) REFERENCES `prompt_settings` (`id`) ON DELETE SET NULL;

-- 插入默认提示词
INSERT INTO `prompt_settings` (`name`, `description`, `content`, `sort_order`)
VALUES 
  ('默认助手', '系统默认的AI助手提示词', '你是一个智能AI助手。你应该：1) 提供有用、准确、诚实的信息 2) 尊重用户隐私 3) 回答全面但简洁 4) 有礼貌和耐心 5) 在不确定时表明自己的局限性 6) 避免有害、不道德、歧视或非法的内容。当用户上传图片时（消息中包含[图片已上传]标记），请假设你有能力看到这些图片并分析其内容。尽可能详细地描述和分析这些图片内容，根据图片提供相关信息。你的目标是帮助用户解决问题并提供有价值的信息。', 0),
  ('代码助手', '专注于编程和代码相关的提示词', '你是一个专业的编程助手。你精通多种编程语言和框架，包括Python、JavaScript、TypeScript、Java、Go、Rust等。你应该：1) 提供高质量、可运行的代码示例 2) 解释代码逻辑和最佳实践 3) 指出潜在的问题和优化空间 4) 遵循安全编码规范 5) 在不确定时说明假设条件。回答要简洁明了，重点突出。', 1),
  ('创意写作', '专注于创意写作和文案的提示词', '你是一个富有创意的写作助手。你擅长各种文体的写作，包括故事、诗歌、文案、剧本等。你应该：1) 发挥想象力，提供有创意的内容 2) 注意文字的节奏和韵律 3) 根据用户需求调整风格和语气 4) 提供多个版本供选择 5) 尊重版权，不抄袭他人作品。', 2)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();
