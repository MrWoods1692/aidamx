export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelId?: string;
  modelIcon?: string;
  isLoading?: boolean;
  isLatest?: boolean;
  isError?: boolean;
  transition?: boolean;
  retryFn?: () => void;
  images?: string[]; // 图片URL数组
  persistentImagePaths?: string[]; // 持久化的图片路径
  feedback?: 'like' | 'dislike' | null; // 用户反馈：点赞、踩或无
  preserveFormat?: boolean; // 是否保留原始格式
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  content: string;
  timestamp: Date;
  read: boolean;
  link?: {
    text: string;
    url: string;
  };
}

// 定义TextSegment接口，用于表示文本段落类型
export interface TextSegment {
  type: 'text' | 'code';
  content: string;
} 