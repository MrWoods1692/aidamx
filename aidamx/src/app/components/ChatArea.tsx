'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo, useReducer } from 'react';
import { FiUser, FiCpu, FiBell, FiInfo, FiAlertTriangle, FiCheck, FiExternalLink, FiLoader, FiChevronDown, FiChevronUp, FiCopy, FiPlay, FiEye, FiX, FiCheckCircle, FiThumbsUp, FiThumbsDown, FiCode, FiMessageCircle, FiFileText, FiBook, FiArrowRight } from 'react-icons/fi';
import { BsSoundwave } from 'react-icons/bs';
import ChatInput from './ChatInput';
import { useI18n } from '../providers/I18nProvider';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useUser } from '@/app/hooks/useUser';
import { FiSend } from 'react-icons/fi';
import { FaRobot, FaUser } from 'react-icons/fa';
import Loader from './Loader';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message, Notification } from './ChatTypes';
import { chatReducer, initialChatState } from './ChatReducer';
import { findLastIndex } from 'lodash';

// 添加在组件外部，存储已经完成打字机效果的消息ID
const typedMessageIds = new Set<string>();
// 添加记录当前正在进行打字机效果的消息ID
let currentTypingMessageId: string | null = null;
// 添加记录打字机效果已完成的百分比
const typingProgress = new Map<string, number>();

// 定义TextSegment接口，用于表示文本段落类型
interface TextSegment {
  type: 'text' | 'code';
  content: string;
}

// 节流函数，用于限制函数调用频率
const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): T => {
  let inThrottle: boolean = false;
  let lastResult: any;
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = func(...args);
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  }) as T;
};

// 创建一个滚动函数的实用工具
const createScrollToBottom = (messagesEndRef: React.RefObject<HTMLDivElement | null>, options = { smooth: false, delay: 0 }) => {
  return () => {
    if (!messagesEndRef.current) return;
    
    // 如果需要延迟，则使用setTimeout
    const executeScroll = () => {
      const scrollElement = messagesEndRef.current?.parentElement?.parentElement;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ 
        behavior: options.smooth ? 'smooth' : 'auto', 
        block: 'end' 
      });
    };
    
    if (options.delay > 0) {
      setTimeout(executeScroll, options.delay);
    } else {
      executeScroll();
    }
  };
};

// 修改复制代码到剪贴板工具函数，增加对预览功能的支持
const useCopyToClipboard = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<{language: string, code: string, id: string} | null>(null);
  const lastToggleTimeRef = useRef<number>(0);
  
  const copyToClipboard = useCallback((code: string, language: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(language);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(err => {
      console.error('无法复制代码:', err);
    });
  }, []);
  
  const togglePreview = useCallback((code: string, language: string, id: string) => {
    // 增加防抖控制，避免快速点击多次触发
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 300) {
      return; // 防止短时间内重复触发
    }
    lastToggleTimeRef.current = now;
    
    // 比较完整ID而不仅仅是语言类型
    if (previewCode && previewCode.id === id) {
      // 只有当点击的是当前打开的预览时才关闭
      setPreviewCode(null); // 关闭预览
    } else {
      // 打开新预览
      setPreviewCode({ language, code, id }); // 打开预览，记录ID
      
      // 延长等待时间确保DOM有足够时间渲染
      setTimeout(() => {
        // 寻找对应的预览元素并滚动到那里
        const previewElement = document.getElementById(`preview-${id}`);
        if (previewElement) {
          previewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200); // 增加延迟时间到200ms
    }
  }, [previewCode]);
  
  return { copiedCode, copyToClipboard, previewCode, togglePreview };
};

// 代码预览组件
const CodePreview = ({ code, language, id }: { code: string, language: string, id: string }) => {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // 当预览加载完成后自动滚动到预览区域
  useEffect(() => {
    if (!loading && previewRef.current) {
      // 使用更长的延迟确保DOM已完全渲染
      setTimeout(() => {
        try {
          // 获取预览区域的位置
          if (previewRef.current) {
            const previewRect = previewRef.current.getBoundingClientRect();
            const scrollContainer = document.querySelector('.flex-1.overflow-y-scroll');
            
            if (scrollContainer) {
              // 计算需要滚动的位置：预览区域的顶部位置 + 当前滚动位置 - 一些偏移量(100px)使其不在最顶部
              const scrollTop = previewRect.top + scrollContainer.scrollTop - 100;
              
              // 使用平滑滚动
              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              });
              
              // 额外的保险措施，如果上面的方法失败，再尝试使用scrollIntoView
              setTimeout(() => {
                if (previewRef.current) {
                  previewRef.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' // 滚动到中间位置
                  });
                }
              }, 100);
            }
          }
        } catch (err) {
          console.error('滚动到预览区域失败:', err);
          // 最后尝试直接滚动
          if (previewRef.current) {
            previewRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 300); // 增加延迟到300ms
    }
  }, [loading]);
  
  // 移除代码块标记符号
  const cleanCode = code.replace(/```[\w]*\n|```$/g, '');
  
  // 准备HTML内容
  const getPreviewContent = useCallback(() => {
    let htmlContent = '';
    
    switch (language) {
      case 'html':
        htmlContent = cleanCode;
        break;
      case 'css':
        htmlContent = `
          <html>
            <head>
              <style>${cleanCode}</style>
            </head>
            <body>
              <div id="preview-container" class="preview-container">
                <!-- CSS预览示例元素 -->
                <h1>标题样式</h1>
                <p>段落样式</p>
                <button>按钮样式</button>
                <div class="box">盒子样式</div>
                <a href="#">链接样式</a>
                <ul>
                  <li>列表项 1</li>
                  <li>列表项 2</li>
                </ul>
              </div>
            </body>
          </html>
        `;
        break;
      case 'javascript':
      case 'js':
        htmlContent = `
          <html>
            <head>
              <style>
                body { font-family: system-ui, sans-serif; padding: 20px; }
                #output { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                .console-error { color: red; }
                .console-warn { color: orange; }
                .console-info { color: blue; }
                .console-log { color: black; }
              </style>
            </head>
            <body>
              <div id="output"></div>
              <script>
                // 捕获控制台输出
                const output = document.getElementById('output');
                const originalConsole = {
                  log: console.log,
                  error: console.error,
                  warn: console.warn,
                  info: console.info
                };
                
                // 重写console方法
                console.log = function(...args) {
                  originalConsole.log(...args);
                  const div = document.createElement('div');
                  div.className = 'console-log';
                  div.textContent = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                  ).join(' ');
                  output.appendChild(div);
                };
                
                console.error = function(...args) {
                  originalConsole.error(...args);
                  const div = document.createElement('div');
                  div.className = 'console-error';
                  div.textContent = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                  ).join(' ');
                  output.appendChild(div);
                };
                
                console.warn = function(...args) {
                  originalConsole.warn(...args);
                  const div = document.createElement('div');
                  div.className = 'console-warn';
                  div.textContent = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                  ).join(' ');
                  output.appendChild(div);
                };
                
                console.info = function(...args) {
                  originalConsole.info(...args);
                  const div = document.createElement('div');
                  div.className = 'console-info';
                  div.textContent = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                  ).join(' ');
                  output.appendChild(div);
                };
                
                // 执行用户代码
                try {
                  ${cleanCode}
                } catch (error) {
                  console.error('执行错误:', error.message);
                }
              </script>
            </body>
          </html>
        `;
        break;
      default:
        htmlContent = `<div style="padding: 20px; font-family: system-ui, sans-serif;">不支持预览 ${language} 代码</div>`;
    }
    
    // 创建data URL，确保内容被正确编码
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    return dataUrl;
  }, [cleanCode, language]);
  
  useEffect(() => {
    if (iframeRef.current) {
      setLoading(true);
      
      // 直接设置iframe的src为data URL
      const iframe = iframeRef.current;
      iframe.src = getPreviewContent();
      
      // 监听加载完成事件
      iframe.onload = () => {
        setLoading(false);
      };
    }
  }, [getPreviewContent]);
  
  return (
    <div 
      ref={previewRef} 
      id={`preview-${id}`}
      className="code-preview-container mt-2 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-800"
    >
      <div className="code-preview-header flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">
        <div className="flex items-center">
          <FiEye className="mr-1" /> 
          代码预览 ({language})
        </div>
      </div>
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-800/50 z-10">
            <div className="flex items-center space-x-2">
              <div className="loading-icon-container">
                <FiLoader className="loading-spinner-icon" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">加载预览...</span>
            </div>
          </div>
        )}
        <iframe 
          ref={iframeRef}
          className="w-full rounded-b-md bg-white dark:bg-gray-800"
          style={{ height: language === 'css' ? '200px' : '300px', border: 'none' }}
          sandbox="allow-scripts"
          title="代码预览"
        />
      </div>
    </div>
  );
};

// 添加音频缓存管理功能
interface TTSCache {
  getAudio: (text: string) => Promise<Blob | null>;
  setAudio: (text: string, audioBlob: Blob) => Promise<void>;
}

// 创建TTS缓存工具
const createTTSCache = (): TTSCache => {
  const DB_NAME = 'tts_cache_db';
  const STORE_NAME = 'audio_cache';
  const DB_VERSION = 1;
  let db: IDBDatabase | null = null;

  // 初始化数据库
  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('IndexedDB错误:', event);
        reject('无法打开数据库');
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'text' });
          console.log('创建TTS缓存数据库');
        }
      };
      
      request.onsuccess = (event) => {
        db = (event.target as IDBOpenDBRequest).result;
        console.log('TTS缓存数据库连接成功');
        resolve(db);
      };
    });
  };

  // 从缓存获取音频
  const getAudio = async (text: string): Promise<Blob | null> => {
    try {
      const database = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(text);
        
        request.onerror = () => {
          console.error('获取缓存音频失败');
          resolve(null);
        };
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.audio) {
            console.log('从缓存获取音频成功');
            resolve(result.audio);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('访问缓存失败:', error);
      return null;
    }
  };

  // 将音频存入缓存
  const setAudio = async (text: string, audioBlob: Blob): Promise<void> => {
    try {
      const database = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ text, audio: audioBlob, timestamp: Date.now() });
        
        request.onerror = () => {
          console.error('缓存音频失败');
          reject('缓存音频失败');
        };
        
        request.onsuccess = () => {
          console.log('缓存音频成功');
          resolve();
        };
      });
    } catch (error) {
      console.error('存储缓存失败:', error);
    }
  };

  return { getAudio, setAudio };
};

// 创建加载组件，以便可以使用React hooks
const LoadingIndicator = () => {
  // 定义更多的加载步骤和对应的颜色
  const loadingSteps = [
    { text: '解析查询', color: '#4F86F7' }, // 蓝色
    { text: '读取语境', color: '#30D5C8' }, // 青色
    { text: '思考中', color: '#9A4EAE' },   // 紫色
    { text: '检索知识库', color: '#FF7518' }, // 橙色
    { text: '推理中', color: '#76C7C0' },   // 薄荷绿
    { text: '分析数据', color: '#E43F6F' }, // 粉红色
    { text: '生成答案', color: '#69C181' }, // 绿色
    { text: '评估响应', color: '#FF69B4' }, // 粉色
    { text: '优化回复', color: '#6A5ACD' }, // 蓝紫色
    { text: '检查准确性', color: '#FF6B81' }, // 珊瑚色
    { text: '格式化输出', color: '#4B8B3B' }, // 森林绿
    { text: '最终润色', color: '#F25555' }  // 红色
  ];
  
  // 使用state追踪当前步骤
  const [currentStep, setCurrentStep] = useState(0);
  
  // 设置定时器自动更新步骤
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentStep(prevStep => (prevStep + 1) % loadingSteps.length);
    }, 1000); // 更快的步骤切换速度
    
    // 清理定时器
    return () => clearInterval(intervalId);
  }, []);
  
  // 获取当前步骤的颜色
  const currentColor = loadingSteps[currentStep].color;
  
  // 计算当前进度百分比
  const progressPercentage = ((currentStep + 1) / loadingSteps.length) * 100;
  
  return (
    <div className="flex flex-col space-y-1.5 w-full max-w-md px-1 mt-1">
      {/* 进度条容器 - 现在放在上方 */}
      <div className="h-1.5 w-full bg-gray-200/60 dark:bg-gray-800/40 rounded-full overflow-hidden backdrop-blur-sm">
        {/* 美化的进度条 */}
        <div 
          className="h-full rounded-full relative overflow-hidden"
          style={{ 
            width: `${progressPercentage}%`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            background: `linear-gradient(to right, ${currentColor}99, ${currentColor})`
          }}
        >
          {/* 光效动画 */}
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 opacity-80" 
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'shimmer 1.5s infinite',
              transform: 'translateX(-100%)'
            }}
          />
        </div>
      </div>
      
      {/* 显示当前步骤文本 - 现在放在下方 */}
      <div className="text-center">
        <span className="text-xs font-medium transition-colors duration-300" style={{ color: currentColor }}>
          {loadingSteps[currentStep].text}...
        </span>
      </div>
      
      {/* 添加CSS动画 */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default function ChatArea() {
  // 使用useReducer替代多个useState
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const {
    messages,
    isTyping,
    currentChatId,
    currentChatTitle,
    isLoadingChat,
    selectedModel,
    modelEndpoint,
    models,
    lastSelectedModelId
  } = state;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputFieldRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useI18n();
  const { user } = useUser();
  
  // 在ChatArea级别使用copyToClipboard，以保持预览状态一致
  const { copiedCode, copyToClipboard, previewCode, togglePreview } = useCopyToClipboard();
  
  // 示例通知列表
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'info',
      title: t('notifications.modelUpdate.title'),
      content: t('notifications.modelUpdate.content'),
      timestamp: new Date(),
      read: false,
      link: {
        text: t('notifications.modelUpdate.learnMore'),
        url: '#'
      }
    },
    {
      id: '2',
      type: 'success',
      title: t('notifications.welcome.title'),
      content: t('notifications.welcome.content'),
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 一天前
      read: false
    }
  ];
  
  // 加载模型设置
  const loadModelSettings = async () => {
    try {
      // 获取缓存失效时间戳
      const checkCacheTimestamp = async () => {
        try {
          const timestampResponse = await fetch('/api/models/check-cache?t=' + new Date().getTime());
          const timestampData = await timestampResponse.json();
          
          if (timestampData.success && timestampData.needsRefresh) {
            console.log('检测到服务器缓存已失效，清除本地缓存');
            localStorage.removeItem('cached_models');
            localStorage.removeItem('cached_selected_model');
            localStorage.removeItem('modelData');
            localStorage.removeItem('modelSettings');
          }
        } catch (error) {
          console.error('检查缓存状态失败:', error);
        }
      };
      
      // 先检查缓存状态
      await checkCacheTimestamp();
        
      // 尝试先从本地存储读取数据
      const cachedModels = localStorage.getItem('cached_models');
      const cachedSelectedModel = localStorage.getItem('cached_selected_model');
      let foundCachedModel = false;
      
      if (cachedModels) {
        try {
          const parsedModels = JSON.parse(cachedModels);
          if (Array.isArray(parsedModels) && parsedModels.length > 0) {
            // 设置模型列表
            if (!models || models.length === 0) {
              dispatch({ type: 'SET_MODELS', payload: parsedModels });
            }
            
            // 如果有缓存的选中模型，尝试找到完整的模型对象
            if (cachedSelectedModel) {
              const foundModel = parsedModels.find((m: any) => m.id === cachedSelectedModel);
              if (foundModel) {
                dispatch({ type: 'SET_SELECTED_MODEL', payload: foundModel });
                foundCachedModel = true;
                console.log('从缓存加载选中模型:', foundModel.name);
              }
            }
          }
        } catch (error) {
          console.error('解析缓存的模型数据失败:', error);
        }
      }
      
        // 清除本地存储的旧数据
        if (typeof window !== 'undefined') {
          localStorage.removeItem('modelData');
          localStorage.removeItem('modelSettings');
        }
        
      // 获取模型列表 (添加时间戳防止缓存)
      const timestamp = new Date().getTime();
      const modelsResponse = await fetch(`/api/models/list?t=${timestamp}`);
      const modelsData = await modelsResponse.json();
      
      if (modelsData.success && modelsData.data && modelsData.data.length > 0) {
        // 存储完整的模型对象列表
        const modelsList = modelsData.data;
        dispatch({ type: 'SET_MODELS', payload: modelsList });
        
        // 缓存到本地存储
        localStorage.setItem('cached_models', JSON.stringify(modelsList));
        
        // 获取模型设置 (添加时间戳防止缓存)
        const settingsResponse = await fetch(`/api/models/settings?t=${timestamp}`);
        const settingsData = await settingsResponse.json();
        
        if (settingsData.success && settingsData.data) {
          const selectedModelId = settingsData.data.model;
          const modelEndpoint = settingsData.data.endpoint || '';
          
          // 如果有选中的模型ID，找到完整的模型对象
          if (selectedModelId) {
            const foundModel = modelsList.find((m: any) => m.id === selectedModelId);
            if (foundModel) {
              dispatch({ type: 'SET_SELECTED_MODEL', payload: foundModel });
              // 缓存选中的模型到本地存储
              localStorage.setItem('cached_selected_model', selectedModelId);
              console.log('已加载模型:', foundModel.name, '图标:', foundModel.icon);
            } else if (modelsList.length > 0) {
              // 如果找不到选中的模型，使用第一个模型
              dispatch({ type: 'SET_SELECTED_MODEL', payload: modelsList[0] });
              // 缓存选中的模型到本地存储
              localStorage.setItem('cached_selected_model', modelsList[0].id);
              console.log('使用默认模型:', modelsList[0].name, '图标:', modelsList[0].icon);
            }
          } else if (modelsList.length > 0 && !foundCachedModel) {
            // 如果没有选中的模型且没有从缓存找到，使用第一个模型
            dispatch({ type: 'SET_SELECTED_MODEL', payload: modelsList[0] });
            // 缓存选中的模型到本地存储
            localStorage.setItem('cached_selected_model', modelsList[0].id);
            console.log('未选择模型，使用第一个:', modelsList[0].name, '图标:', modelsList[0].icon);
          }
          
          dispatch({ type: 'SET_MODEL_ENDPOINT', payload: modelEndpoint });
        }
        }
      } catch (error) {
        console.error('加载模型设置失败:', error);
      }
    };
    
  useEffect(() => {
    // 初始加载
    loadModelSettings();
    
    // 设置定期刷新 (每分钟刷新一次模型数据)
    const refreshInterval = setInterval(loadModelSettings, 60000);
    
    // 清理定时器
    return () => clearInterval(refreshInterval);
  }, []);
  
  // 监听模型选择变化
  useEffect(() => {
    // 创建自定义事件监听器
    const handleModelSelect = (event: CustomEvent) => {
      const newModel = event.detail;
      if (newModel) {
        console.log('ChatArea 接收到模型选择变化:', newModel);
        dispatch({ type: 'SET_SELECTED_MODEL', payload: newModel });
        
        // 当模型变化时，记录最后选择的模型ID
        if (newModel.id !== lastSelectedModelId) {
          dispatch({ type: 'SET_LAST_SELECTED_MODEL_ID', payload: newModel.id });
        }
      }
    };
    
    // 添加事件监听
    window.addEventListener('modelSelected', handleModelSelect as EventListener);
    
    // 清理函数
    return () => {
      window.removeEventListener('modelSelected', handleModelSelect as EventListener);
    };
  }, [lastSelectedModelId]);
  
  // 获取所有模型数据
  const loadModelsData = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/models/list?t=${timestamp}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        dispatch({ type: 'SET_MODELS', payload: data.data });
      }
    } catch (error) {
      console.error('加载模型数据失败:', error);
    }
  }, []);
  
  // 组件加载时获取所有模型数据
  useEffect(() => {
    loadModelsData();
  }, [loadModelsData]);
  
  // 根据模型ID获取完整的模型信息
  const getModelById = useCallback((modelId: string) => {
    return models.find(model => model.id === modelId);
  }, [models]);
  
  // 自动生成聊天标题
  const generateChatTitle = async (chatId: number) => {
    try {
      // 这里可以使用用户的第一条消息作为标题生成的基础
      const firstUserMessage = state.messages.find(m => m.role === 'user');
      if (!firstUserMessage) return;
      
      // 先在本地生成一个有意义的标题
      const localTitle = firstUserMessage.content.trim().substring(0, 30) + 
        (firstUserMessage.content.length > 30 ? '...' : '');
      
      // 先使用本地标题更新UI
      dispatch({ 
        type: 'SET_CHAT_TITLE',
        payload: localTitle
      });
      
      // 触发自定义事件，立即通知聊天列表更新
      const localUpdateEvent = new CustomEvent('chatTitleUpdated', {
        detail: {
          chatId,
          title: localTitle
        }
      });
      window.dispatchEvent(localUpdateEvent);
      
      // 调用API将本地生成的标题保存到数据库
      // 注意：我们不使用API生成的标题，而是直接发送我们本地生成的标题
      await fetch('/api/chat/history/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          messageContent: firstUserMessage.content,
          // 添加本地生成的标题，让API直接使用而不是生成新的
          localTitle: localTitle
        }),
      });
      
      // 不再使用API返回的标题，因为它可能是日期格式
      // 我们已经使用本地生成的标题，并且已经触发了更新事件
    } catch (error) {
      console.error('生成标题失败:', error);
    }
  };
  
  // 发送消息
  const handleSendMessage = async (content: string, images?: File[]) => {
    try {
      console.log('开始发送消息:', content, images ? `附带${images.length}张图片` : '无图片');
      
      // 定义辅助函数：将文件转换为Base64
      const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      }
      
      // 转换图片为base64字符串（如果有）
      let imageDataArray: string[] = [];
      
      if (images && images.length > 0) {
        // 将图片转换为base64编码
        for (const image of images) {
          const base64 = await convertFileToBase64(image);
          imageDataArray.push(base64);
        }
      }
      
      // 创建消息对象 - 完全保留原始content内容，不做任何处理或格式化
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content, // 直接使用原始content，不做任何修改
        timestamp: new Date(),
        // 如果有图片，添加图片预览URL
        ...(images && images.length > 0 && {
          images: images.map(image => URL.createObjectURL(image))
        }),
        preserveFormat: true // 添加标志，表示此消息应保留原始格式
      };
      
      // 创建加载中的临时回复消息
      const loadingMessage: Message = {
        id: `loading-${Date.now()}`,
        role: 'assistant',
        content: "思考中...",
        timestamp: new Date(),
        modelId: selectedModel?.id,
        modelIcon: selectedModel?.icon,
        isLoading: true,
      };
      
      console.log('添加用户消息和加载消息');
      
      // 一次性添加用户消息和加载消息
      dispatch({ 
        type: 'SET_MESSAGES', 
        payload: [...state.messages.map(msg => ({...msg, isLatest: false})), userMessage, loadingMessage]
      });
      dispatch({ type: 'SET_TYPING', payload: true });
      
      let retries = 0;
      const maxRetries = 3;
      
      const sendRequest = async () => {
        try {
          console.log('发送API请求');
          
          // 统一使用JSON格式发送请求
          const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content, // 直接使用原始content，不做任何处理
              chatId: currentChatId,
              modelId: selectedModel?.id,
              images: imageDataArray.length > 0 ? imageDataArray : undefined,
              preserveFormat: true // 添加标志，通知后端保留原始格式
            }),
          });
          
          // 检查是否是账户封禁错误
          if (response.status === 403) {
            const data = await response.json();
            throw new Error(data.message || '您的账户已被封禁，无法发送消息');
          }
          
          const data = await response.json();
          console.log('收到API响应:', data.success);
          
          if (data.success && data.data) {
            // 创建完整的助手回复消息
            const assistantMessage = {
              ...data.data,
              id: data.data.id || `assistant-${Date.now()}`, // 确保有唯一ID
              modelId: selectedModel?.id,
              modelIcon: selectedModel?.icon,
              isLatest: true // 标记为最新消息
            };
            
            console.log('替换加载消息为真实消息');
            // 使用新的action替换加载消息为真实消息
            dispatch({ 
              type: 'REPLACE_LOADING_MESSAGE', 
              payload: assistantMessage 
            });
            
            // 如果API返回了图片路径，更新用户消息的持久化图片路径
            if (data.data.userImagePaths && data.data.userImagePaths.length > 0) {
              console.log('保存持久化图片路径：', data.data.userImagePaths);
              
              // 查找用户消息并更新
              const userMessageIndex = state.messages.findIndex(m => m.id === userMessage.id);
              if (userMessageIndex !== -1) {
                // 更新持久化路径，确保UI能正确显示图片
                dispatch({
                  type: 'UPDATE_MESSAGE',
                  payload: {
                    id: userMessage.id,
                    updates: { 
                      persistentImagePaths: data.data.userImagePaths
                    }
                  }
                });
                
                // 这里不需要再次清理URL，因为已经在上面处理过了
                // 移除重复的URL释放代码，避免图片裂开
              }
            }
            
            // 保存聊天ID用于持续会话
            if (data.data.chatId && !currentChatId) {
              dispatch({ type: 'SET_CHAT_ID', payload: data.data.chatId });
              
              // 自动生成标题
              generateChatTitle(data.data.chatId);
            }
            
            // 无论是新建还是现有聊天，都立即触发事件通知侧边栏更新
            console.log('触发聊天历史更新事件');
            const updateEvent = new CustomEvent('chatTitleUpdated');
            window.dispatchEvent(updateEvent);
          } else {
            throw new Error(data.message || '未知错误');
          }
        } catch (error: any) {
          console.error('发送消息失败:', error);
          
          // 如果还有重试次数，则重试
          if (retries < maxRetries) {
            retries++;
            console.log(`重试 ${retries}/${maxRetries}`);
            // 显示重试状态 - 使用UPDATE_MESSAGE action更新加载消息的内容
            dispatch({ 
              type: 'UPDATE_MESSAGE', 
              payload: {
                id: loadingMessage.id,
                updates: { content: `思考中... (正在重试 ${retries}/${maxRetries})` }
              }
            });
            
            // 指数退避策略
            const delay = 1000 * Math.pow(2, retries - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 重试请求
            return sendRequest();
          }
          
          console.log('创建错误消息');
          // 创建错误消息，包含重试按钮
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `抱歉，发送消息失败: ${error.message || '服务连接不稳定'}。`,
            timestamp: new Date(),
            modelId: selectedModel?.id,
            modelIcon: selectedModel?.icon,
            isLatest: true, // 标记为最新消息
            isError: true,  // 标记为错误消息
            retryFn: () => {
              console.log('重试发送消息');
              // 移除错误消息，重新添加加载消息
              const newLoadingMessage = {
                ...loadingMessage,
                id: `loading-${Date.now()}`
              };
              
              // 使用UPDATE_MESSAGE移除错误状态
              dispatch({ 
                type: 'SET_MESSAGES', 
                payload: [...state.messages.filter(msg => !msg.isError), newLoadingMessage]
              });
              
              // 重置重试计数并重新发送请求
              retries = 0;
              sendRequest();
            }
          };
          
          console.log('替换加载消息为错误消息');
          // 替换加载消息为错误消息
          dispatch({ 
            type: 'REPLACE_LOADING_MESSAGE', 
            payload: errorMessage 
          });
        } finally {
          dispatch({ type: 'SET_TYPING', payload: false });
        }
      };
      
      // 开始发送请求
      await sendRequest();
    } catch (error: any) {
      console.error('handleSendMessage出现未捕获的错误:', error);
    }
  };
  
  // 创建优化后的滚动函数
  const scrollToBottomImmediate = useMemo(() => 
    createScrollToBottom(messagesEndRef, { smooth: false, delay: 0 }), 
    []
  );
  
  const scrollToBottomSmooth = useMemo(() => 
    createScrollToBottom(messagesEndRef, { smooth: true, delay: 0 }), 
    []
  );

  // 添加调试功能，记录状态变化
  useEffect(() => {
    console.log('消息状态更新:', state.messages.length, '条消息');
  }, [state.messages]);

  // 优化后的滚动逻辑，减少重复调用
  useEffect(() => {
    if (messages.length > 0) {
      console.log('触发滚动到底部');
      // 使用单次延迟滚动替代多次滚动
      const delayedScroll = createScrollToBottom(messagesEndRef, { smooth: false, delay: 300 });
      delayedScroll();
    }
  }, [messages, isTyping, scrollToBottomImmediate]); // 添加依赖
  
  // 获取通知图标
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <FiInfo className="text-blue-500" />;
      case 'warning':
        return <FiAlertTriangle className="text-yellow-500" />;
      case 'success':
        return <FiCheck className="text-green-500" />;
      default:
        return <FiBell className="text-blue-500" />;
    }
  };
  
  // 格式化时间
  const formatDate = (date: Date, notificationId: string) => {
    // 通知ID为1对应"今天"，ID为2对应"昨天"
    if (notificationId === '1') {
      return t('notifications.modelUpdate.date');
    } else if (notificationId === '2') {
      return t('notifications.welcome.date');
    } else {
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return '今天';
      } else if (diffDays === 1) {
        return '昨天';
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return date.toLocaleDateString();
      }
    }
  };

  // 修改消息内容组件，支持加载动画、思考内容折叠和打字机效果
  const MessageContent = memo(({ 
    content, 
    isLoading, 
    isLatest, 
    messageId,
    copiedCode,
    copyToClipboard,
    previewCode,
    togglePreview,
    images,
    persistentImagePaths
  }: { 
    content: string, 
    isLoading?: boolean, 
    isLatest?: boolean, 
    messageId: string,
    copiedCode: string | null,
    copyToClipboard: (code: string, language: string) => void,
    previewCode: {language: string, code: string, id: string} | null,
    togglePreview: (code: string, language: string, id: string) => void,
    images?: string[],
    persistentImagePaths?: string[]
  }) => {
    const [showThinking, setShowThinking] = useState(false);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const typingSpeed = 20; // 降低到20ms以减轻卡顿感
    const typingRef = useRef<{
      interval: number | null,
      position: number,
      content: string,
      rafId: number | null,
      lastRenderTime: number
    }>({
      interval: null,
      position: 0,
      content: '',
      rafId: null,
      lastRenderTime: 0
    });
    
    // 检查是否已经完成打字机效果
    const hasCompletedTyping = typedMessageIds.has(messageId);
    
    // 创建节流版本的滚动函数
    const throttledScroll = useMemo(() => 
      throttle(() => {
        if (isLatest && messagesEndRef.current) {
          scrollToBottomImmediate();
        }
      }, 100),
      [isLatest, scrollToBottomImmediate]
    );
    
    // 检查消息是否为用户消息（用于确定是否保留原始格式）
    const isUserMessage = useMemo(() => {
      // 查找与当前消息ID匹配的消息，检查其角色
      const message = state.messages.find(msg => msg.id === messageId);
      return message?.role === 'user';
    }, [messageId, state.messages]);
    
    // 使用父组件的scrollToBottomImmediate函数
    const scrollToBottom = useCallback(() => {
      if (isLatest && messagesEndRef.current) {
        if (typingRef.current.rafId) {
          cancelAnimationFrame(typingRef.current.rafId);
        }
        
        typingRef.current.rafId = requestAnimationFrame(() => {
          throttledScroll();
          typingRef.current.rafId = null;
        });
      }
    }, [isLatest, throttledScroll]);
    
    // 处理思考内容 - 使用useMemo减少重复计算
    const processedContent = useMemo(() => {
      // 匹配<think>标签内的内容
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
      
      if (!thinkMatch) {
        // 如果没有思考内容，直接返回原始内容
        return { hasThinking: false, thinking: '', actualContent: content };
      }
      
      const thinking = thinkMatch[1]; // 思考内容
      // 将<think>标签及内容从原文中移除，得到实际内容
      const actualContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      
      return { hasThinking: true, thinking, actualContent };
    }, [content]);
    
    // 优化的文本分段处理函数 - 使用useMemo减少重复计算
    const preparedTextSegments = useMemo(() => {
      const textToType = processedContent.hasThinking ? processedContent.actualContent : content;
      const codeBlockRegex = /```[\s\S]+?```/g;
      const segments: TextSegment[] = [];
      let lastIndex = 0;
      let match;
      
      // 查找所有代码块并分割文本
      while ((match = codeBlockRegex.exec(textToType)) !== null) {
        // 添加代码块前的文本
        if (match.index > lastIndex) {
          segments.push({
            type: 'text',
            content: textToType.substring(lastIndex, match.index)
          });
        }
        
        // 添加代码块
        segments.push({
          type: 'code',
          content: match[0]
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // 添加最后一段文本
      if (lastIndex < textToType.length) {
        segments.push({
          type: 'text',
          content: textToType.substring(lastIndex)
        });
      }
      
      // 如果没有代码块，就当作普通文本处理
      if (segments.length === 0) {
        segments.push({
          type: 'text',
          content: textToType
        });
      }
      
      return { segments, textToType };
    }, [content, processedContent]);
    
    // 打字机效果 - 优化逻辑
    useEffect(() => {
      // 如果消息已经完成打字或不是最新消息或正在加载，则跳过
      if (hasCompletedTyping || !isLatest || isLoading) {
        return;
      }
      
      const { textToType } = preparedTextSegments;
      const { segments } = preparedTextSegments;
      
      // 如果当前正在输入的消息ID不是这个消息，且有其他消息正在输入
      if (currentTypingMessageId && currentTypingMessageId !== messageId) {
        // 获取已保存的进度
        const savedProgress = typingProgress.get(messageId);
        if (savedProgress !== undefined) {
          // 使用已保存的进度继续显示
          const position = Math.floor(textToType.length * savedProgress);
          setDisplayedText(textToType.substring(0, position));
          typingRef.current.position = position;
          typingRef.current.content = textToType;
          return;
        }
      }
      
      // 设置当前正在输入的消息ID
      currentTypingMessageId = messageId;
      
      setIsTyping(true);
      // 不立即清空显示文本，避免闪烁
      if (textToType.length > 0) {
        // 无论是代码块还是普通文本，都只显示开头的少量字符
        setDisplayedText(textToType.substring(0, Math.min(5, textToType.length)));
      }
      
      typingRef.current.position = 0;
      typingRef.current.content = textToType;
      typingRef.current.lastRenderTime = 0;
      
      // 清除可能存在的旧定时器
      if (typingRef.current.interval) {
        clearInterval(typingRef.current.interval);
      }
      
      // 使用RAF实现更平滑的打字效果
      let currentSegmentIndex = 0;
      let positionInSegment = 0;
      // 不使用displayedText状态作为初始值，避免循环依赖
      let displayText = '';
      
      const animateTyping = (timestamp: number) => {
        // 控制更新频率，减少状态更新次数
        if (timestamp - typingRef.current.lastRenderTime < typingSpeed) {
          typingRef.current.rafId = requestAnimationFrame(animateTyping);
          return;
        }
        
        typingRef.current.lastRenderTime = timestamp;
        
        const currentSegment = segments[currentSegmentIndex];
        
        if (!currentSegment) {
          // 所有段落处理完毕
          setIsTyping(false);
          typedMessageIds.add(messageId);
          scrollToBottom();
          if (currentTypingMessageId === messageId) {
            currentTypingMessageId = null;
          }
          return;
        }
        
        // 确保displayText不为空白，避免闪烁
        if (displayText.length === 0 && currentSegment.content.length > 0) {
          // 无论是代码块还是普通文本，都只显示开头部分
          const initialChars = Math.min(5, currentSegment.content.length);
          displayText = currentSegment.content.substring(0, initialChars);
          positionInSegment = initialChars;
        } else if (currentSegment.type === 'code') {
          // 代码块分批显示，每次显示一部分
          const batchSize = Math.min(50, currentSegment.content.length - positionInSegment);
          displayText += currentSegment.content.substring(
            positionInSegment, 
            positionInSegment + batchSize
          );
          positionInSegment += batchSize;
          
          // 如果当前代码块段已完成，移动到下一个段落
          if (positionInSegment >= currentSegment.content.length) {
            currentSegmentIndex++;
            positionInSegment = 0;
          }
        } else {
          // 普通文本批量显示 - 增加批处理大小
          const batchSize = Math.max(10, Math.floor(currentSegment.content.length / 30));
          positionInSegment = Math.min(positionInSegment + batchSize, currentSegment.content.length);
          displayText += currentSegment.content.substring(
            positionInSegment - batchSize, 
            positionInSegment
          );
          
          // 如果当前段落已完成，移动到下一个段落
          if (positionInSegment >= currentSegment.content.length) {
            currentSegmentIndex++;
            positionInSegment = 0;
          }
        }
        
        // 更新显示文本 - 使用函数式更新以避免状态依赖问题
        setDisplayedText(displayText);
        
        // 计算整体进度
        const totalLength = textToType.length;
        const currentPosition = displayText.length;
        typingProgress.set(messageId, currentPosition / totalLength);
        
        // 代码块后和段落结束时强制滚动
        if (currentSegment.type === 'code' || positionInSegment === 0) {
          scrollToBottom();
        }
        
        // 继续动画
        if (currentSegmentIndex < segments.length || positionInSegment < currentSegment?.content.length) {
          typingRef.current.rafId = requestAnimationFrame(animateTyping);
        } else {
          // 全部完成后，再滚动一次确保显示最新内容
          setTimeout(scrollToBottom, 50);
        }
      };
      
      typingRef.current.rafId = requestAnimationFrame(animateTyping);
      
      return () => {
        // 组件卸载时清除动画帧和定时器
        if (typingRef.current.rafId) {
          cancelAnimationFrame(typingRef.current.rafId);
        }
        if (typingRef.current.interval) {
          clearInterval(typingRef.current.interval);
        }
      };
    }, [content, isLatest, isLoading, messageId, hasCompletedTyping, scrollToBottom, preparedTextSegments]); // 移除displayedText依赖
    
    // 渲染纯文本（保留原始格式）
    const renderPlainText = useCallback((text: string) => {
      return (
        <div className="whitespace-pre-wrap break-words">
          {text}
        </div>
      );
    }, []);
    
    // 优化渲染Markdown的性能
    const renderMarkdownMemoized = useCallback((text: string) => {
      return (
        <ReactMarkdown
          components={{
            // @ts-ignore - 强制忽略类型错误，这是ReactMarkdown已知的类型问题
            code: ({ inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              
              if (!inline && match) {
                // 提取代码和语言
                const language = match[1];
                const code = String(children).replace(/\n$/, '');
                const codeId = `code-${language}-${messageId}`; // 使用消息ID和语言创建唯一ID
                const isCopied = copiedCode === language;
                const isPreviewable = ['html', 'css', 'javascript', 'js'].includes(language);
                const isCurrentlyPreviewing = previewCode && previewCode.id === codeId;
                
                return (
                  <div className="code-block-container relative rounded-md overflow-hidden">
                    {/* 苹果风格标识栏 */}
                    <div className="code-block-header flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200 dark:bg-gray-900 text-xs border-gray-700 dark:border-gray-800">
                      <div className="flex items-center space-x-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        {language && <span className="ml-3 text-gray-400 font-mono">{language}</span>}
                      </div>
                      <div className="flex items-center space-x-3">
                        {isPreviewable && (
                          <button 
                            onClick={() => togglePreview(code, language, codeId)}
                            className={`flex items-center space-x-1 transition-colors focus:outline-none cursor-pointer ${
                              isCurrentlyPreviewing 
                                ? 'text-blue-400 hover:text-blue-300' 
                                : 'hover:text-white'
                            }`}
                            aria-label={isCurrentlyPreviewing ? "关闭预览" : "预览代码"}
                          >
                            <FiEye className="w-4 h-4" />
                            <span>{isCurrentlyPreviewing ? "关闭预览" : "预览"}</span>
                          </button>
                        )}
                        <button 
                          onClick={() => copyToClipboard(code, language)}
                          className="flex items-center space-x-1 hover:text-white transition-colors focus:outline-none cursor-pointer"
                          aria-label="复制代码"
                        >
                          {isCopied ? (
                            <>
                              <FiCheck className="w-4 h-4 text-green-400" />
                              <span className="text-green-400">已复制</span>
                            </>
                          ) : (
                            <>
                              <FiCopy className="w-4 h-4" />
                              <span>复制</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <SyntaxHighlighter
                      // @ts-ignore
                      style={tomorrow}
                      language={language}
                      PreTag="div"
                      className="syntax-highlight-wrapper"
                      {...props}
                    >
                      {code}
                    </SyntaxHighlighter>
                    
                    {isCurrentlyPreviewing && (
                      <CodePreview code={code} language={language} id={codeId} />
                    )}
                  </div>
                );
              }
              
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // 添加标题组件的自定义渲染
            h1: ({ node, ...props }) => <h1 style={{ color: '#F25555' }} {...props} />,
            h2: ({ node, ...props }) => <h2 style={{ color: '#F25555' }} {...props} />,
            h3: ({ node, ...props }) => <h3 style={{ color: '#F25555' }} {...props} />,
            h4: ({ node, ...props }) => <h4 style={{ color: '#F25555' }} {...props} />,
            h5: ({ node, ...props }) => <h5 style={{ color: '#F25555' }} {...props} />,
            h6: ({ node, ...props }) => <h6 style={{ color: '#F25555' }} {...props} />,
            // 自定义有序列表的渲染，确保显示数字
            ol: ({ ordered, children, ...props }: any) => (
              <ol className="list-decimal pl-6" {...props}>
                {children}
              </ol>
            ),
            // 自定义列表项的渲染
            li: ({ children, ...props }: any) => (
              <li className="my-1" {...props}>
                {children}
              </li>
            )
          }}
        >
          {text}
        </ReactMarkdown>
      );
    }, [copiedCode, copyToClipboard, previewCode, togglePreview, messageId]); // 添加messageId依赖
    
    if (isLoading) {
      return <LoadingIndicator />;
    }
    
    const { hasThinking, thinking, actualContent } = processedContent;
    
    // 渲染图片预览区域
    const renderImages = () => {
      // 如果有持久化的图片路径，优先使用它们
      const imagesToRender = persistentImagePaths?.length ? persistentImagePaths : images;
      
      if (!imagesToRender || imagesToRender.length === 0) return null;
      
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {imagesToRender.map((src, index) => {
            // 检查是否为blob URL（切换聊天时blob URL已失效）
            const isBlobUrl = src && typeof src === 'string' && src.startsWith('blob:');
            // 如果是blob URL且不是刚刚创建的（在images中，但不在persistentImagePaths中），则跳过渲染
            if (isBlobUrl && persistentImagePaths?.length) {
              return null;
            }
            
            // 处理服务器路径
            let finalSrc = src;
            if (typeof src === 'string' && !isBlobUrl) {
              finalSrc = src.startsWith('http') ? src : (src.startsWith('/') ? src : `/${src}`);
            }
            
            return (
              <div key={index} className="relative">
                <img 
                  src={finalSrc}
                  alt={`上传的图片 ${index + 1}`}
                  className="max-w-[200px] max-h-[200px] rounded-lg"
                  onError={(e) => {
                    console.error('图片加载失败:', src);
                    // 设置为默认图片或添加错误样式
                    (e.target as HTMLImageElement).style.border = '1px solid red';
                    (e.target as HTMLImageElement).style.padding = '10px';
                    (e.target as HTMLImageElement).src = '/images/image-error.png';
                  }}
                />
              </div>
            );
          })}
        </div>
      );
    };
    
    // 检查消息是否需要保留原始格式
    const shouldPreserveFormat = useMemo(() => {
      // 查找与当前消息ID匹配的消息，检查其preserveFormat属性
      const message = state.messages.find(msg => msg.id === messageId);
      return message?.preserveFormat === true || message?.role === 'user';
    }, [messageId, state.messages]);
    
    if (!hasThinking) {
      // 没有思考内容，直接渲染（可能有打字机效果）
      return (
        <>
          {images && images.length > 0 && renderImages()}
          {shouldPreserveFormat ? 
            // 使用纯文本渲染，保留原始格式
            (isLatest && !hasCompletedTyping ? 
              renderPlainText(displayedText || (content.length > 0 ? content.substring(0, Math.min(5, content.length)) : '')) : 
              renderPlainText(content)) 
            : 
            // 使用Markdown渲染
            (isLatest && !hasCompletedTyping ? 
            renderMarkdownMemoized(displayedText || (content.length > 0 ? content.substring(0, Math.min(5, content.length)) : '')) : 
              renderMarkdownMemoized(content))
          }
        </>
      );
    }
    
    // 有思考内容，分开渲染
    return (
      <div>
        {/* 如果有图片，显示图片预览 */}
        {images && images.length > 0 && renderImages()}
        
        {/* 实际内容（可能有打字机效果） */}
        {shouldPreserveFormat ?
          // 使用纯文本渲染，保留原始格式
          (isLatest && !hasCompletedTyping ? 
            renderPlainText(displayedText || (actualContent.length > 0 ? actualContent.substring(0, Math.min(5, actualContent.length)) : '')) : 
            renderPlainText(actualContent))
          :
          // 使用Markdown渲染
          (isLatest && !hasCompletedTyping ? 
          renderMarkdownMemoized(displayedText || (actualContent.length > 0 ? actualContent.substring(0, Math.min(5, actualContent.length)) : '')) : 
            renderMarkdownMemoized(actualContent))
        }
        
        {/* 思考内容 */}
        <div className="mt-2 pt-2">
          <div className="border-t border-[#e11d48] dark:border-[#e11d48]" style={{ borderTopWidth: '1px' }}></div>
          <button 
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showThinking ? (
              <>
                <FiChevronUp className="mr-1" />
                <span>隐藏思考过程</span>
              </>
            ) : (
              <>
                <FiChevronDown className="mr-1" />
                <span>查看思考过程</span>
              </>
            )}
          </button>
          
          {showThinking && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 overflow-auto max-w-full max-h-[50vh]">
              {renderMarkdownMemoized(thinking)}
            </div>
          )}
        </div>
      </div>
    );
  });

  // 渲染消息，优先使用消息自己的模型图标，如果没有则使用当前选择的模型图标
  const renderMessageAvatar = (message: Message) => {
    // 优先使用消息自己的模型信息
    if (message.role === 'assistant') {
      // 如果消息有关联的模型ID，尝试从模型列表中找到完整信息
      if (message.modelId) {
        const messageModel = getModelById(message.modelId);
        if (messageModel?.icon) {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <img 
                src={`${messageModel.icon}?t=${new Date().getTime()}`}
                alt={messageModel.name || 'AI模型'} 
                className="w-full h-full object-contain"
              />
            </div>
          );
        }
      }
      
      // 如果消息有直接存储的图标地址
      if (message.modelIcon) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <img 
              src={`${message.modelIcon}?t=${new Date().getTime()}`}
              alt="AI模型" 
              className="w-full h-full object-contain"
            />
          </div>
        );
      }
      
      // 最后，使用当前选中的模型图标
      if (selectedModel?.icon) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <img 
              src={selectedModel.icon.includes('?') 
                ? `${selectedModel.icon}&t=${new Date().getTime()}` 
                : `${selectedModel.icon}?t=${new Date().getTime()}`}
              alt={selectedModel.name || 'AI模型'} 
              className="w-full h-full object-contain"
            />
          </div>
        );
      }
      
      // 默认图标
      return (
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src="/images/modelimg/gpt6.png"
            alt="AI模型" 
            className="w-full h-full object-contain"
          />
        </div>
      );
    }
    
    // 用户头像
    if (message.role === 'user') {
      if (user?.avatar) {
        return (
          <img 
            src={user.avatar} 
            alt={user.name || '用户头像'} 
            className="w-full h-full object-cover"
          />
        );
      } else {
        return (
          <div className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <FiUser className="w-5 h-5 text-white" />
          </div>
        );
      }
    }
    
    return null;
  };

  // 加载特定聊天的消息
  const loadChatMessages = useCallback(async (chatId: number) => {
    dispatch({ type: 'SET_LOADING_CHAT', payload: true });
    try {
      const response = await fetch(`/api/chat/history/messages?chatId=${chatId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // 更新当前聊天ID和标题
        dispatch({ type: 'SET_CHAT_ID', payload: chatId });
        dispatch({ type: 'SET_CHAT_TITLE', payload: data.data.title });
        
        // 添加调试日志
        console.log('API返回的消息数据:', JSON.stringify(data.data.messages, null, 2));
        
        // 格式化消息
        const formattedMessages = data.data.messages.map((msg: any) => {
          // 添加调试日志
          if (msg.persistentImagePaths && msg.persistentImagePaths.length > 0) {
            console.log(`消息 ${msg.id} 包含图片:`, msg.persistentImagePaths);
          }
          
          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            // 保留原始图片路径，同时设置images属性为同样的持久化路径
            // 这样能确保渲染逻辑能正确显示图片
            ...(msg.persistentImagePaths && { 
              persistentImagePaths: msg.persistentImagePaths,
              images: msg.persistentImagePaths // 将持久化的路径也设置到images属性
            }),
            // 为AI消息添加模型信息
            ...(msg.role === 'assistant' ? {
              modelId: selectedModel?.id,
              modelIcon: selectedModel?.icon
            } : {})
          };
        });
        
        // 更新消息列表
        dispatch({ type: 'SET_MESSAGES', payload: formattedMessages });
        
        // 滚动到底部
        setTimeout(() => {
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        }, 100);
      } else {
        console.error('加载聊天消息失败:', data.message);
      }
    } catch (error) {
      console.error('加载聊天消息出错:', error);
    } finally {
      dispatch({ type: 'SET_LOADING_CHAT', payload: false });
    }
  }, [selectedModel]);
  
  // 监听加载聊天事件
  useEffect(() => {
    const handleLoadChat = (event: Event) => {
      const customEvent = event as CustomEvent;
      const chatId = customEvent.detail?.chatId;
      
      if (chatId) {
        console.log('ChatArea 接收到加载聊天事件:', chatId);
        loadChatMessages(chatId);
      }
    };
    
    // 监听新建聊天事件
    const handleNewChat = () => {
      console.log('ChatArea 接收到新建聊天事件');
      // 清空当前聊天
      dispatch({ type: 'CLEAR_CHAT' });
    };
    
    // 添加事件监听
    window.addEventListener('loadChat', handleLoadChat);
    window.addEventListener('newChat', handleNewChat);
    
    // 清理函数
    return () => {
      window.removeEventListener('loadChat', handleLoadChat);
      window.removeEventListener('newChat', handleNewChat);
    };
  }, [loadChatMessages]);

  // 添加一个复制消息内容的函数
  const copyMessageToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).catch(err => {
      console.error('复制失败：', err);
    });
  };

  // 添加一个重新回答问题的函数
  const handleRefreshAnswer = (question: string) => {
    if (!question || isTyping) return;
    handleSendMessage(question);
  };

  // 添加toast状态
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({
    show: false,
    message: '',
    type: 'info'
  });

  // 存储Toast定时器引用
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 显示toast消息函数
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    // 如果有正在显示的toast，先清除其定时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    
    // 显示新的toast
    setToast({
      show: true,
      message,
      type
    });
    
    // 设置定时器，指定时间后自动隐藏toast
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, duration);
  };

  // 初始化TTS缓存
  const ttsCache = useMemo(() => createTTSCache(), []);

  // 修改后的textToSpeech函数，添加缓存支持
  const textToSpeech = async (text: string) => {
    if (!text) return;
    
    try {
      // 显示正在处理的提示
      showToast(t('chat.voice.preparing'), 'info');
      
      // 清理文本，移除代码块和特殊XML字符
      const cleanedText = text
        // 移除所有的代码块 (```code```)
        .replace(/```[\s\S]*?```/g, '代码块已省略')
        // 提取行内代码内容 (`code`) - 保留内容而不是替换
        .replace(/`([^`]+)`/g, '$1')
        // 移除Markdown格式标记但保留其中的文本
        .replace(/^(#{1,6})\s+(.+)$/gm, '$2') // 标题 (# 文本)
        .replace(/\*\*([^*]+)\*\*/g, '$1') // 粗体
        .replace(/\*([^*]+)\*/g, '$1')     // 斜体
        .replace(/__([^_]+)__/g, '$1')     // 粗体(下划线)
        .replace(/_([^_]+)_/g, '$1')       // 斜体(下划线)
        .replace(/~~([^~]+)~~/g, '$1')     // 删除线
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
        // 不要移除有序列表的数字编号，TTS会自然朗读它们
        // 替换可能导致XML解析错误的字符
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      
      console.log('清理后的文本用于朗读:', cleanedText);
      
      // 尝试从缓存获取音频
      const cachedAudio = await ttsCache.getAudio(cleanedText);
      
      if (cachedAudio) {
        console.log('使用缓存的音频');
        // 创建音频URL并播放
        const audioUrl = URL.createObjectURL(cachedAudio);
        const audio = new Audio(audioUrl);
        audio.play();
        
        // 显示播放成功提示
        showToast(t('chat.voice.playing'), 'success');
        
        // 播放完成后释放URL资源
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
        return;
      }
      
      // 缓存中没有，准备SSML格式的文本
      const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="zh-CN-XiaoxiaoNeural">
    ${cleanedText}
  </voice>
</speak>`;

      // 显示获取中的提示
      showToast(t('chat.voice.fetching') || '正在获取语音...', 'info');
      
      // 使用本地代理API，避免CORS问题
      const response = await fetch('/api/ra', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'FORMAT': 'webm-24khz-16bit-mono-opus',
          'Authorization': `Bearer 362856178`
        },
        body: ssml,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`TTS API请求失败: ${response.status}`, errorText);
        throw new Error(`TTS API请求失败: ${response.status} "${errorText}"`);
      }

      // 获取音频Blob
      const audioBlob = await response.blob();
      
      // 缓存音频数据
      await ttsCache.setAudio(cleanedText, audioBlob);
      
      // 创建一个可以播放的音频URL
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 创建音频元素并播放
      const audio = new Audio(audioUrl);
      audio.play();
      
      // 显示播放成功提示
      showToast(t('chat.voice.playing'), 'success');
      
      // 播放完成后释放URL资源
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('TTS失败:', error);
      showToast(`${t('chat.voice.failed')} ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  // 添加一个处理消息评价的函数
  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    // 更新消息的评价状态
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        // 如果已经选中了这个评价，就取消选中
        if (msg.feedback === feedbackType) {
          return { ...msg, feedback: null };
        } else {
          // 否则选中新的评价
          return { ...msg, feedback: feedbackType };
        }
      }
      return msg;
    });
    
    // 更新状态
    dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
    
    // 这里可以添加将评价发送到后端的逻辑
    // 例如：sendFeedbackToServer(messageId, feedbackType);
    
    // 显示评价成功的提示，使用国际化翻译
    const feedbackMessage = feedbackType === 'like' 
      ? t('feedback.likeThank') 
      : t('feedback.dislikeThank');
    showToast(feedbackMessage, 'success');
  };

  // 手动停止语音播放
  const stopSpeech = () => {
    const audio = document.querySelector('audio');
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  // 重置聊天
  const resetChat = () => {
    // 停止任何正在播放的音频
    stopSpeech();
    
    // 创建新的聊天
    dispatch({ type: 'SET_CHAT_ID', payload: null });
    dispatch({ type: 'SET_MESSAGES', payload: [] });
    
    // 更新状态
    setTimeout(() => {
      inputFieldRef.current?.focus();
    }, 100);
    
    // 使用CLEAR_CHAT代替SET_REFERENCE_MESSAGE
    dispatch({ type: 'CLEAR_CHAT' });
  };

  return (
    <>
      <div className="flex-1 flex flex-col h-full relative overflow-x-hidden" style={{ backgroundColor: 'rgb(var(--background-rgb))' }}>
        {isLoadingChat ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center text-[rgb(var(--text-secondary))]">
              <Loader />
              <p>{t('chat.loading')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-scroll px-2 sm:px-4 py-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="max-w-4xl w-full px-4">
              {/* 背景装饰元素 */}
              <div className="absolute top-[20%] right-[15%] w-40 h-40 rounded-full opacity-20 blur-3xl" 
                style={{ background: 'linear-gradient(135deg, rgb(var(--primary-color)), rgb(var(--primary-hover)))' }}>
              </div>
              <div className="absolute bottom-[25%] left-[15%] w-40 h-40 rounded-full opacity-20 blur-3xl" 
                style={{ background: 'linear-gradient(225deg, rgb(var(--primary-hover)), rgb(var(--primary-color)))' }}>
              </div>
              <div className="absolute top-[40%] left-[25%] w-24 h-24 rounded-full opacity-10 blur-2xl" 
                style={{ background: 'linear-gradient(45deg, rgb(var(--primary-color)), rgb(var(--primary-hover)))' }}>
              </div>
              <div className="absolute bottom-[35%] right-[20%] w-32 h-32 rounded-full opacity-15 blur-2xl" 
                style={{ background: 'linear-gradient(225deg, rgb(var(--primary-hover)), rgb(var(--primary-color)))' }}>
              </div>
              
              {/* 中央logo和标题 */}
              <div className="relative mb-10 z-10 flex flex-col items-center">
                <div className="mb-6 flex items-center justify-center relative">
                  <div className="absolute w-32 h-32 rounded-full bg-[rgba(var(--primary-color),0.08)] dark:bg-[rgba(var(--primary-color),0.16)]"></div>
                  <Image 
                    src="/images/staticwebsite.svg" 
                    alt="AI Assistant Logo" 
                    width={180} 
                    height={180} 
                    className="relative z-10"
                    priority
                  />
                </div>
                
                <h1 className="title-large text-center mb-2 english-text gradient-text font-bold text-4xl">
                  {t('app.title')}
                </h1>
                <p className="text-center text-[rgb(var(--text-secondary))] text-xl max-w-lg mx-auto mb-8">
                  智能编程助手，代码问题一键解决
                </p>
              </div>
              
              {/* 技术图标滚动区 */}
              <div className="mt-8 mb-10 relative z-10 overflow-hidden">
                <div className="tech-icons-container">
                  <div className="tech-icons-scroll">
                    {/* 第一组图标 - 向左滚动 */}
                    <div className="infinite-scroll-container">
                      <div className="infinite-scroll-track animate-scroll-left">
                        {/* 第一组图标集 */}
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" 
                            alt="HTML5" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">HTML5</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" 
                            alt="CSS3" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">CSS3</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original-wordmark.svg" 
                            alt="Tailwind" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Tailwind</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" 
                            alt="JavaScript" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">JavaScript</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" 
                            alt="TypeScript" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">TypeScript</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" 
                            alt="React" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">React</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg" 
                            alt="Vue.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Vue.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg" 
                            alt="Next.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo dark:invert"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Next.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" 
                            alt="Node.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Node.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg" 
                            alt="Angular" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Angular</span>
                        </div>
                        
                        {/* 重复集合以实现无缝衔接 */}
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" 
                            alt="HTML5" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">HTML5</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" 
                            alt="CSS3" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">CSS3</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original-wordmark.svg" 
                            alt="Tailwind" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Tailwind</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" 
                            alt="JavaScript" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">JavaScript</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" 
                            alt="TypeScript" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">TypeScript</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" 
                            alt="React" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">React</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg" 
                            alt="Vue.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Vue.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg" 
                            alt="Next.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo dark:invert"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Next.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" 
                            alt="Node.js" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Node.js</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg" 
                            alt="Angular" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Angular</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 第二组图标 - 向右滚动 */}
                    <div className="infinite-scroll-container mt-12">
                      <div className="infinite-scroll-track animate-scroll-right">
                        {/* 第二组图标集 */}
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redux/redux-original.svg" 
                            alt="Redux" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Redux</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg" 
                            alt="GraphQL" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">GraphQL</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" 
                            alt="MongoDB" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">MongoDB</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg" 
                            alt="Jest" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Jest</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg" 
                            alt="Sass" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Sass</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg" 
                            alt="VS Code" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">VS Code</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg" 
                            alt="Git" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Git</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" 
                            alt="GitHub" 
                            width={44} 
                            height={44} 
                            className="tech-logo dark:invert"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">GitHub</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" 
                            alt="Docker" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Docker</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" 
                            alt="Python" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Python</span>
                        </div>
                        
                        {/* 重复集合以实现无缝衔接 */}
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redux/redux-original.svg" 
                            alt="Redux" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Redux</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg" 
                            alt="GraphQL" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">GraphQL</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" 
                            alt="MongoDB" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">MongoDB</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg" 
                            alt="Jest" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Jest</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg" 
                            alt="Sass" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Sass</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg" 
                            alt="VS Code" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">VS Code</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg" 
                            alt="Git" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Git</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" 
                            alt="GitHub" 
                            width={44} 
                            height={44} 
                            className="tech-logo dark:invert"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">GitHub</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" 
                            alt="Docker" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Docker</span>
                        </div>
                        <div className="tech-icon-item">
                          <Image 
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" 
                            alt="Python" 
                            width={44} 
                            height={44} 
                            className="tech-logo"
                          />
                          <span className="text-xs mt-2 block text-center text-[rgb(var(--text-secondary))]">Python</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 开始使用提示 */}
              <div className="mt-10 text-center relative z-10">
                <p className="text-[rgb(var(--text-secondary))] mb-2">在下方输入框发送消息，开始与AI对话</p>
                <div className="flex items-center justify-center text-sm">
                  <div className="flex items-center bg-[rgba(var(--background-light),0.6)] dark:bg-[rgba(0,0,0,0.2)] px-3 py-1.5 rounded-lg">
                    <span className="text-[rgb(var(--text-secondary))]">输入问题</span>
                    <FiArrowRight className="mx-2 text-[rgb(var(--text-secondary))]" />
                    <span className="text-[rgb(var(--primary-color))]">获取AI回答</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
                <div className="max-w-5xl mx-auto">
                  <div className="flex flex-col space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 mb-6 transition-opacity ${
                  message.isLoading ? 'animate-fadeIn' : ''
                } ${
                  message.role === 'assistant' ? 'justify-start' : 'justify-end'
                } ${
                  message.role === 'user' ? 'pb-4' : ''
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm">
                      {renderMessageAvatar(message)}
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-[18px] px-4 py-2.5 transition-all duration-200 hover:shadow-md mt-4 ${
                    message.role === 'assistant'
                      ? 'bg-gray-100 dark:bg-[#101010] shadow-sm text-gray-800 dark:text-gray-100 backdrop-blur-[2px] ai-message'
                      : 'bg-[rgb(var(--primary-color),0.06)] dark:bg-[rgb(var(--primary-color),0.2)] text-[rgb(var(--primary-color),0.9)] dark:text-[rgb(var(--primary-color),0.95)] shadow-sm backdrop-blur-[2px] hover:bg-[rgb(var(--primary-color),0.08)] hover:dark:bg-[rgb(var(--primary-color),0.25)]'
                  }`}
                  style={{
                    boxShadow: message.role === 'assistant' 
                      ? '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.01)' 
                      : `0 1px 2px rgba(var(--primary-color-rgb),0.04), 0 1px 1px rgba(var(--primary-color-rgb),0.03)`,
                    borderTopLeftRadius: message.role === 'assistant' ? '4px' : undefined,
                    borderTopRightRadius: message.role === 'user' ? '4px' : undefined,
                    // 移除下面这个背景颜色设置，它覆盖了className中的灰色背景
                    /* ...(message.role === 'assistant' && {
                      backgroundColor: 'var(--ai-message-bg, #f1f5f9)',
                    }), */
                  }}
                >
                  <div className={`prose max-w-none prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 ${
                    message.role === 'assistant' 
                      ? 'dark:prose-invert prose-a:text-[rgb(var(--primary-color))] dark:prose-a:text-[rgb(var(--primary-hover))]' 
                      : 'prose-a:text-[rgb(var(--text-primary))] dark:prose-a:text-[rgb(var(--text-primary))]'
                  }`}>
                    <MessageContent 
                      content={message.content} 
                      isLoading={message.isLoading}
                      isLatest={message.isLatest}
                      messageId={message.id} 
                      copiedCode={copiedCode}
                      copyToClipboard={copyToClipboard}
                      previewCode={previewCode}
                      togglePreview={togglePreview}
                      images={message.images}
                      persistentImagePaths={message.persistentImagePaths} // 添加持久化图片路径
                    />
                  </div>
                  
                  {/* 添加按钮组，在气泡外侧 */}
                  <div className="absolute left-0 bottom-0 h-0 w-0 overflow-visible pointer-events-none">
                    <div className="absolute -bottom-8 left-0 pointer-events-auto flex space-x-2">
                      {/* 复制按钮 */}
                      <button
                        onClick={() => {
                          copyMessageToClipboard(message.content);
                          // 在按钮所在元素中添加临时类以显示复制成功状态
                          const button = document.getElementById(`copy-btn-${message.id}`);
                          if (button) {
                            // 保存原始内容
                            const originalHTML = button.innerHTML;
                            // 替换为成功图标
                            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                            // 2秒后恢复
                            setTimeout(() => {
                              button.innerHTML = originalHTML;
                            }, 1500);
                          }
                        }}
                        id={`copy-btn-${message.id}`}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer"
                        title="复制消息"
                      >
                        <FiCopy className="w-4 h-4" />
                      </button>
                      
                      {/* 只为AI消息添加语音按钮 */}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => textToSpeech(message.content)}
                          id={`voice-btn-${message.id}`}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer"
                          title="朗读消息"
                        >
                          <BsSoundwave className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* 只为AI消息添加刷新按钮 */}
                      {message.role === 'assistant' && index > 0 && messages[index-1].role === 'user' && (
                        <button
                          onClick={() => handleRefreshAnswer(messages[index-1].content)}
                          id={`refresh-btn-${message.id}`}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer"
                          title="重新回答"
                          disabled={isTyping}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${isTyping ? 'opacity-50' : ''}`}>
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                            <path d="M21 3v5h-5"></path>
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                            <path d="M8 16H3v5"></path>
                          </svg>
                        </button>
                      )}
                      
                      {/* 只为AI消息添加点赞和踩按钮 */}
                      {message.role === 'assistant' && (
                        <>
                          {/* 点赞按钮 */}
                          <button
                            onClick={() => handleFeedback(message.id, 'like')}
                            id={`like-btn-${message.id}`}
                            className={`w-7 h-7 flex items-center justify-center ${
                              message.feedback === 'like' 
                                ? 'text-red-500' 
                                : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                            } transition-colors cursor-pointer`}
                            title="有帮助"
                          >
                            <FiThumbsUp className="w-4 h-4" />
                          </button>
                          
                          {/* 踩按钮 */}
                          <button
                            onClick={() => handleFeedback(message.id, 'dislike')}
                            id={`dislike-btn-${message.id}`}
                            className={`w-7 h-7 flex items-center justify-center ${
                              message.feedback === 'dislike' 
                                ? 'text-red-500' 
                                : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                            } transition-colors cursor-pointer`}
                            title="没帮助"
                          >
                            <FiThumbsDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm">
                      {renderMessageAvatar(message)}
                    </div>
                  </div>
                )}
              </div>
            ))}
                    {/* 在消息列表末尾添加一个空的div作为滚动目标 */}
                    <div ref={messagesEndRef} className="h-0.5" />
                </div>
              </div>
            )}
          </div>
            <ChatInput onSend={handleSendMessage} disabled={isTyping || isLoadingChat} />
          </>
        )}
      </div>
      
      {/* 添加Toast通知 */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 toast-container show">
          <div className={`flex items-center px-4 py-2 rounded-lg shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-500' 
              : toast.type === 'error'
                ? 'bg-red-500' 
                : 'bg-blue-500'
          }`}>
            {toast.type === 'success' && <FiCheckCircle className="text-white text-xl" />}
            {toast.type === 'error' && <FiAlertTriangle className="text-white text-xl" />}
            {toast.type === 'info' && <FiInfo className="text-white text-xl" />}
            <span className="ml-2 text-white text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        /* 修改Markdown中水平分隔线(hr)的样式 */
        .prose hr {
          border-color: #e11d48 !important; /* 暖红色 */
          border-top-width: 1px !important; /* 减小粗细 */
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        
        /* 代码块相关样式 */
        .code-block-container {
          margin: 1rem 0;
          border-radius: 0.5rem;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .code-block-header {
          user-select: none;
        }
        
        /* 修改SyntaxHighlighter的样式以适应新的代码块容器 */
        .code-block-container pre {
          margin: 0 !important;
          padding-top: 0 !important;
          border-top-left-radius: 0 !important;
          border-top-right-radius: 0 !important;
        }
        
        /* 确保语法高亮器和头部紧密连接 */
        .syntax-highlight-wrapper {
          margin: 0 !important;
        }
        
        /* 移除react-syntax-highlighter的内部padding */
        .code-block-container .react-syntax-highlighter {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
        
        /* 确保代码块和标识栏紧密连接 */
        .code-block-container div[class*="react-syntax-highlighter"] {
          margin-top: 0 !important;
        }
        
        /* 代码复制按钮动画 */
        @keyframes fadeInCopy {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        /* 代码块容器内的水平滚动 */
        .code-block-container .react-syntax-highlighter {
          max-width: 100%;
          overflow-x: auto;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
          background-color: rgba(209, 213, 219, 0.2);
          border-radius: 3px;
        }
        
        .dark .scrollbar-thumb-gray-700::-webkit-scrollbar-thumb {
          background-color: rgba(55, 65, 81, 0.2);
        }
        
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        .animate-bounce {
          animation: bounce 1.2s infinite;
        }
        
        /* 确保思考内容区域不会导致页面出现水平滚动 */
        .prose pre {
          max-width: 100%;
          overflow-x: auto;
        }
        
        /* 处理思考内容中的代码块 */
        .overflow-auto.max-w-full .prose pre {
          max-width: 100%;
        }
        
        /* 设置html固定滚动条，防止滚动条出现/消失导致的布局偏移 */
        html {
          overflow-y: scroll;
          margin-right: 0 !important; /* 防止某些浏览器在显示滚动条时添加margin */
        }
        
        /* 确保内容容器不会溢出 */
        .max-w-5xl {
          width: 100%;
        }
        
        /* 确保消息气泡内的所有内容不会导致溢出 */
        .max-w-[90%] .prose,
        .max-w-[85%] .prose {
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }
        
        /* 添加自定义的加载旋转动画 */
        @keyframes gentleSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-icon-container {
          width: 20px;
          height: 20px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .loading-spinner-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          margin-top: -10px;
          margin-left: -10px;
          color: #9ca3af;
          animation: gentleSpin 1.5s linear infinite;
          transform-origin: center center;
        }
        
        /* 滚动技术图标样式 */
        .tech-icons-container {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        
        .tech-icons-scroll {
          padding: 10px 0;
        }
        
        .infinite-scroll-container {
          overflow: hidden;
          position: relative;
          width: 100%;
        }
        
        .infinite-scroll-track {
          display: flex;
          gap: 60px;
          padding: 0 30px;
        }
        
        .tech-icon-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 0 0 auto;
        }
        
        .tech-logo {
          transition: all 0.3s ease;
        }
        
        .dark .tech-logo:not(.dark\:invert) {
          filter: brightness(1.1);
        }
        
        @keyframes infiniteScrollLeft {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        
        @keyframes infiniteScrollRight {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }
        
        .animate-scroll-left {
          animation: infiniteScrollLeft 30s linear infinite;
          width: max-content;
          display: flex;
        }
        
        .animate-scroll-right {
          animation: infiniteScrollRight 30s linear infinite;
          width: max-content;
          display: flex;
        }
      `}</style>
    </>
  );
} 