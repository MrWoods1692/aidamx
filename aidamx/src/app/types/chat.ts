export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  loading?: boolean;
  modelId?: string;
  thinking?: string;
  images?: string[]; // 临时图片URLs
  persistentImagePaths?: string[]; // 持久化的图片路径
} 