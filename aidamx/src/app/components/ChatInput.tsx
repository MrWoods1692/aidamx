'use client';

import { useState, FormEvent, KeyboardEvent, useRef, useEffect, ChangeEvent } from 'react';
import { FiSend, FiImage, FiMic, FiCpu, FiRefreshCw, FiX } from 'react-icons/fi';
import { useI18n } from '../providers/I18nProvider';
import { useUserStore } from './Navbar';
import { useRouter } from 'next/navigation';

interface ChatInputProps {
  onSend: (message: string, images?: File[]) => void;
  disabled?: boolean;
}

// 模型数据接口
interface Model {
  id: string;
  name?: string;
  icon?: string;
  tags?: Array<{text: string, color: string}>;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  
  // 模型相关状态
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  
  const { isLoggedIn } = useUserStore();
  const router = useRouter();
  
  // 当disabled状态从true变为false时（模型回复完成），自动聚焦输入框
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);
  
  // 尝试从本地存储加载模型数据
  useEffect(() => {
    // 立即设置加载状态，防止闪烁
    setIsLoadingModels(true);
    
    // 尝试先从本地存储加载数据，确保有内容显示
    try {
      const cachedModels = localStorage.getItem('cached_models');
      const cachedSelectedModel = localStorage.getItem('cached_selected_model');
      
      // 先初始化空模型列表，避免未定义错误
      if (!models) {
        setModels([]);
      }
      
      let hasLoadedModels = false;
      
      if (cachedModels) {
        try {
          const parsedModels = JSON.parse(cachedModels);
          if (Array.isArray(parsedModels) && parsedModels.length > 0) {
            setModels(parsedModels);
            hasLoadedModels = true;
            console.log('从缓存加载模型列表:', parsedModels.length, '个模型');
          }
        } catch (parseError) {
          console.error('解析缓存模型数据失败:', parseError);
        }
      }
      
      if (cachedSelectedModel) {
        setSelectedModel(cachedSelectedModel);
        console.log('从缓存加载选中模型:', cachedSelectedModel);
      }
      
      // 如果没有加载到缓存模型，则保持加载状态
      if (!hasLoadedModels) {
        setIsLoadingModels(true);
      } else {
        // 有缓存数据时，先关闭加载状态，避免显示加载指示器
        setIsLoadingModels(false);
      }
    } catch (error) {
      console.error('从本地存储加载模型数据失败:', error);
    }
    
    // 无论缓存是否成功，都请求最新数据
    // 但要使用setTimeout延迟一下，确保UI先渲染缓存数据
    setTimeout(() => {
      loadModelData();
    }, 100);
    
    // 设置自动刷新（每60秒刷新一次）
    const refreshInterval = setInterval(() => {
      console.log('自动刷新模型数据...');
      loadModelData();
    }, 60000);
    
    // 清理函数，组件卸载时清除定时器
    return () => clearInterval(refreshInterval);
  }, []);
  
  // 加载模型数据
  const loadModelData = async () => {
    setIsLoadingModels(true);
    try {
      // 从API获取模型列表
      const modelsResponse = await fetch('/api/models/list');
      const modelsData = await modelsResponse.json();
      
      // 新增：检查是否有Ollama模型
      const ollamaResponse = await fetch('/api/models/ollama-settings');
      const ollamaData = await ollamaResponse.json();
      
      let modelsList = [];
      
      if (modelsData.success && modelsData.data && modelsData.data.length > 0) {
        // 确保模型数据没有重复项
        const uniqueModels = [];
        const modelIds = new Set();
        
        for (const model of modelsData.data) {
          if (!modelIds.has(model.id)) {
            modelIds.add(model.id);
            uniqueModels.push(model);
          }
        }
        
        modelsList = uniqueModels;
      } else {
        // 如果API返回空数据，检查是否有缓存数据可用
        console.warn('API返回的模型列表为空，尝试使用缓存数据');
        const cachedModels = localStorage.getItem('cached_models');
        if (cachedModels) {
          try {
            const parsedModels = JSON.parse(cachedModels);
            if (Array.isArray(parsedModels) && parsedModels.length > 0) {
              modelsList = parsedModels;
            }
          } catch (error) {
            console.error('解析缓存模型数据失败:', error);
          }
        }
      }
      
      // 添加Ollama模型到列表中（如果有）
      if (ollamaData.success && ollamaData.data) {
        const { model, apiUrl } = ollamaData.data;
        
        if (model) {
          // 创建Ollama模型对象
          const ollamaModel = {
            id: `ollama:${model}`,
            name: `Ollama: ${model}`,
            icon: "/images/modelimg/ollama.png", // 使用替代图标，因为没有Ollama专用图标
            tags: [{
              text: "Ollama",
              color: "#2563eb"
            }]
          };
          
          // 创建一个新的模型列表，进行更严格的去重
          const uniqueModelsList = [];
          const modelNameSet = new Set();
          
          // 首先添加Ollama模型
          uniqueModelsList.push(ollamaModel);
          modelNameSet.add(model.toLowerCase());
          
          // 然后添加其他模型，但跳过与Ollama模型名称相似的
          for (const m of modelsList) {
            // 提取基本名称（不考虑前缀）
            const baseName = (m.name || m.id).replace(/^ollama:\s*/i, "").toLowerCase();
            
            // 如果这个名称还没有添加过，则添加此模型
            if (!modelNameSet.has(baseName)) {
              uniqueModelsList.push(m);
              modelNameSet.add(baseName);
            }
          }
          
          // 使用去重后的列表
          modelsList = uniqueModelsList;
        }
      }
      
      // 设置新的模型列表
      if (modelsList.length > 0) {
        setModels(modelsList);
        // 缓存模型数据到本地存储
        localStorage.setItem('cached_models', JSON.stringify(modelsList));
        console.log('已缓存', modelsList.length, '个模型到本地存储');
      }
      
      // 获取当前选中的模型
      const settingsResponse = await fetch('/api/models/settings');
      const settingsData = await settingsResponse.json();
      
      if (settingsData.success && settingsData.data) {
        const newSelectedModel = settingsData.data.model || '';
        setSelectedModel(newSelectedModel);
        
        // 缓存选中的模型到本地存储
        localStorage.setItem('cached_selected_model', newSelectedModel);
      }
    } catch (error) {
      console.error('加载模型数据失败:', error);
      
      // 发生错误时，尝试从缓存加载数据（如果当前没有数据）
      if (models.length === 0) {
        try {
          const cachedModels = localStorage.getItem('cached_models');
          if (cachedModels) {
            const parsedModels = JSON.parse(cachedModels);
            if (Array.isArray(parsedModels) && parsedModels.length > 0) {
              setModels(parsedModels);
              console.log('网络错误，使用缓存数据', parsedModels.length, '个模型');
            }
          }
        } catch (cacheError) {
          console.error('从缓存加载失败:', cacheError);
        }
      }
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  // 自动调整文本区域高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 保存原始高度
      const originalHeight = textarea.style.height;
      
      // 设置固定高度，不再随内容变化
      textarea.style.height = '80px';
      textarea.style.minHeight = '80px';
      textarea.style.maxHeight = '80px';
      textarea.style.overflowY = 'auto';
      
      return () => {
        textarea.style.height = originalHeight;
      };
    }
  }, []);
  
  // 添加自定义滚动条样式
  useEffect(() => {
    // 确保不重复添加样式
    if (!document.getElementById('model-selector-style')) {
      const style = document.createElement('style');
      style.id = 'model-selector-style';
      style.innerHTML = `
        .model-selector-scrollbar::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        .model-selector-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          margin: 3px;
        }
        .model-selector-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-color), 0.3);
          border-radius: 10px;
        }
        .model-selector-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary-color), 0.5);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .model-selector-container {
          animation: fadeIn 0.2s cubic-bezier(0.2, 0, 0, 1);
          transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .model-item {
          transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
        }
        .model-item:hover {
          transform: translateY(-1px);
        }
        .model-item.selected {
          transform: scale(1.02);
        }
        
        /* 深色模式下的样式调整 - 增加 !important 提高优先级 */
        html.dark .model-selector-container,
        body.dark .model-selector-container,
        .dark .model-selector-container {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(var(--primary-color), 0.15) !important;
          background-color: rgba(33, 33, 33, 0.95) !important;
          backdrop-filter: blur(10px) !important;
        }
        html.dark .model-selector-scrollbar,
        body.dark .model-selector-scrollbar,
        .dark .model-selector-scrollbar {
          background-color: rgba(33, 33, 33, 0.8) !important;
        }
        html.dark .model-item,
        body.dark .model-item,
        .dark .model-item {
          border-color: rgba(var(--border-color), 0.1) !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        html.dark .model-item:hover,
        body.dark .model-item:hover,
        .dark .model-item:hover {
          border-color: rgba(var(--primary-color), 0.4) !important;
          background-color: rgba(var(--primary-color), 0.08) !important;
        }
        html.dark .model-item.selected,
        body.dark .model-item.selected,
        .dark .model-item.selected {
          background-color: rgba(var(--primary-color), 0.15) !important;
        }
        
        /* 模型选择器头部的深色模式样式 */
        html.dark .model-selector-header,
        body.dark .model-selector-header,
        .dark .model-selector-header {
          background: linear-gradient(to right, rgba(33, 33, 33, 0.95), rgba(17, 17, 17, 0.9)) !important;
          border-color: rgba(75, 75, 75, 0.5) !important;
        }
        
        /* 强制设置深色模式下的标题文本颜色 */
        html.dark .model-selector-header h3,
        body.dark .model-selector-header h3,
        .dark .model-selector-header h3 {
          color: white !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        html.dark .model-selector-header p,
        body.dark .model-selector-header p,
        .dark .model-selector-header p {
          color: rgba(255, 255, 255, 0.8) !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      // 组件卸载时移除样式
      const styleEl = document.getElementById('model-selector-style');
      if (styleEl) styleEl.remove();
    };
  }, []);
  
  // 处理点击外部关闭模型选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 获取模型选择按钮元素
      const modelButton = document.querySelector('[aria-label="' + t('chat.selectModel') + '"]');
      
      // 检查点击的是否为模型选择按钮或其内部元素
      const isModelButton = modelButton && (modelButton === event.target || modelButton.contains(event.target as Node));
      
      // 如果点击的不是选择器内部且不是模型按钮，则关闭选择器
      if (modelSelectorRef.current && 
          !modelSelectorRef.current.contains(event.target as Node) && 
          !isModelButton) {
        setShowModelSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [t]);
  
  // 切换模型
  const handleSelectModel = async (modelId: string) => {
    try {
      setSelectedModel(modelId);
      
      // 缓存当前选中的模型
      localStorage.setItem('cached_selected_model', modelId);
      
      // 判断是否是Ollama模型
      if (modelId.startsWith('ollama:')) {
        // Ollama模型不需要发送到API，已经在设置时保存了
        console.log("选择了Ollama模型:", modelId);
        
        // 关闭模型选择器
        setShowModelSelector(false);
        return;
      }
      
      // 发送选择的模型到服务器
      const response = await fetch('/api/models/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId }),
      });
      
      // 找到完整的模型对象
      const modelObject = models.find(m => m.id === modelId);
      
      // 触发自定义事件，通知其他组件模型已变更
      if (modelObject) {
        const event = new CustomEvent('modelSelected', { 
          detail: modelObject
        });
        window.dispatchEvent(event);
        console.log('触发模型选择事件:', modelObject);
      }
      
      // 保存用户的模型选择
      try {
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/models/settings?t=${timestamp}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ selectedModel: modelId }),
        });
        
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          console.error('保存模型选择失败:', result.message);
        } else {
          console.log('模型选择已保存:', modelId);
        }
      } catch (error) {
        console.error('保存模型选择失败:', error);
      }
    } catch (error) {
      console.error('切换模型失败:', error);
    }
  };
  
  // 获取当前选中模型的名称
  const getSelectedModelName = () => {
    const model = models.find(m => m.id === selectedModel);
    return model?.name || model?.id || '默认模型';
  };

  // 处理图片上传
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newImages: File[] = [];
    const newPreviewUrls: string[] = [];
    
    // 处理选择的图片文件
    Array.from(files).forEach(file => {
      // 检查是否为图片文件
      if (!file.type.startsWith('image/')) return;
      
      // 添加到选择的图片数组
      newImages.push(file);
      
      // 创建预览URL
      const previewUrl = URL.createObjectURL(file);
      newPreviewUrls.push(previewUrl);
    });
    
    // 更新状态
    setSelectedImages(prev => [...prev, ...newImages]);
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
    
    // 重置文件输入，以便可以再次选择相同的文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 移除已选择的图片
  const removeImage = (index: number) => {
    // 释放URL对象
    URL.revokeObjectURL(imagePreviewUrls[index]);
    
    // 更新状态，移除指定索引的图片
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 添加一个处理发送前的检查函数
  const handleSendWithLoginCheck = (message: string, images?: File[]) => {
    if (!isLoggedIn) {
      // 用户未登录，跳转到登录页面
      router.push('/login');
      return;
    }
    
    // 用户已登录，正常发送消息
    onSend(message, images);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((message || selectedImages.length > 0) && !disabled) {
      // 直接发送原始消息内容，不做修剪或格式化处理
      handleSendWithLoginCheck(message, selectedImages.length > 0 ? selectedImages : undefined);
      setMessage('');
      // 清空已选图片
      setSelectedImages([]);
      // 释放所有预览URL
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setImagePreviewUrls([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if ((message || selectedImages.length > 0) && !disabled) {
        // 直接发送原始消息内容，不做任何修剪或格式化处理
        handleSendWithLoginCheck(message, selectedImages.length > 0 ? selectedImages : undefined);
        setMessage('');
        // 清空已选图片
        setSelectedImages([]);
        // 释放所有预览URL
        imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
        setImagePreviewUrls([]);
      }
    }
  };
  
  // 检测深色模式
  useEffect(() => {
    const checkDarkMode = () => {
      // 检查是否存在深色模式类，但不强制应用
      const isDarkMode = document.documentElement.classList.contains('dark') || 
                         document.body.classList.contains('dark');
      
      if (isDarkMode && showModelSelector) {
        // 仅当显示模型选择器且处于深色模式时应用样式
        // 注意：不再强制添加dark类到body
        
        // 应用深色模式样式到模型选择器
        const modelSelector = document.querySelector('.model-selector-container');
        if (modelSelector) {
          // 重新应用深色模式样式，但保留原有样式
          const originalStyle = modelSelector.getAttribute('style') || '';
          modelSelector.setAttribute('style', `
            ${originalStyle}
            background-color: rgba(33, 33, 33, 0.95) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(var(--primary-color), 0.15) !important;
          `);
        }
        
        // 更新内容区域
        const scrollArea = document.querySelector('.model-selector-scrollbar');
        if (scrollArea) {
          const originalStyle = scrollArea.getAttribute('style') || '';
          scrollArea.setAttribute('style', `
            ${originalStyle}
            background-color: rgba(33, 33, 33, 0.8) !important;
          `);
        }
        
        // 更新头部区域
        const headerArea = document.querySelector('.model-selector-header');
        if (headerArea) {
          const originalStyle = headerArea.getAttribute('style') || '';
          headerArea.setAttribute('style', `
            ${originalStyle}
            background: linear-gradient(to right, rgba(33, 33, 33, 0.95), rgba(17, 17, 17, 0.9)) !important;
            border-color: rgba(75, 75, 75, 0.5) !important;
          `);
          
          // 强制设置标题文本颜色
          const headerTitle = headerArea.querySelector('h3');
          if (headerTitle) {
            headerTitle.setAttribute('style', 'color: white !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);');
          }
          
          // 设置副标题文本颜色
          const headerDesc = headerArea.querySelector('p');
          if (headerDesc) {
            headerDesc.setAttribute('style', 'color: rgba(255, 255, 255, 0.8) !important;');
          }
        }
      }
    };
    
    // 仅当显示模型选择器时检查
    if (showModelSelector) {
      checkDarkMode();
    }
    
    // 不再监听颜色方案变化，避免干扰主题切换
    
  }, [showModelSelector]);

  return (
    <div className="relative mt-6" style={{ backgroundColor: 'transparent' }}>
      {/* 上方卡片 - 使用单个整体元素 */}
      <div className="absolute inset-x-6 top-0 z-20" style={{ transform: 'translateY(-100%)' }}>
        <div className="flex flex-col">
          {/* 按钮区域 */}
          <div className="flex items-center justify-between h-10 bg-[rgb(var(--card-bg))] rounded-t-xl border-l border-t border-r border-[rgba(var(--border-color),0.2)] px-2 shadow-[0_-1px_2px_rgba(0,0,0,0.03)]">
            {/* 左侧功能按钮区域 */}
            <div className="flex space-x-2">
              <button 
                type="button" 
                className="flex items-center justify-center w-8 h-8 rounded-full text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.1)] transition-colors"
                aria-label="选择模型"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModelSelector(!showModelSelector);
                }}
              >
                {models.find(m => m.id === selectedModel)?.icon ? (
                  <img 
                    src={models.find(m => m.id === selectedModel)?.icon} 
                    alt="Select Model" 
                    className="w-7 h-7 object-contain" 
                  />
                ) : (
                  <img src="/images/modelimg/gpt6.png" alt="Select Model" className="w-7 h-7 object-contain" />
                )}
              </button>
              
              {/* 隐藏的文件输入 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                multiple
                className="hidden"
                id="image-upload"
              />
              
              <button 
                type="button" 
                className="flex items-center justify-center w-8 h-8 rounded-full text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.1)] transition-colors"
                aria-label="上传图片"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiImage className="text-lg" />
              </button>
              
              <button 
                type="button" 
                className="flex items-center justify-center w-8 h-8 rounded-full text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.1)] transition-colors"
                aria-label="语音输入"
              >
                <FiMic className="text-lg" />
              </button>
            </div>
            
            {/* 空白部分 */}
            <div></div>
          </div>
          
          {/* 图片预览区域 - 放在按钮区域下方 */}
          {selectedImages.length > 0 && (
            <div className="bg-[rgb(var(--card-bg))] px-2 py-2 border-l border-r border-[rgba(var(--border-color),0.2)]">
              <div className="flex flex-wrap gap-2">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={url} 
                      alt={`Preview ${index}`} 
                      className="w-14 h-14 object-cover rounded-md border border-[rgba(var(--border-color),0.3)]" 
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入框区域 */}
      <form onSubmit={handleSubmit} className="px-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="chat-input w-full p-4 rounded-2xl bg-[rgb(var(--card-bg))] shadow-sm border border-[rgba(var(--border-color),0.2)]"
            placeholder={t('chat.placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={3}
            disabled={disabled}
            style={{ 
              height: '80px',
              minHeight: '80px', 
              maxHeight: '80px',
              resize: 'none', 
              overflowY: 'auto',
              outline: 'none',
              boxShadow: isFocused ? '0 1px 2px rgba(0,0,0,0.04)' : '',
              borderColor: 'rgba(var(--border-color),0.2)'
            }}
          />
          
          <button
            type="submit"
            className="absolute right-3 bottom-3 flex items-center justify-center w-8 h-8 rounded-full bg-[rgb(var(--primary-color))] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={(message.trim() === '' && selectedImages.length === 0) || disabled}
          >
            <FiSend className="text-lg" />
          </button>
        </div>
      </form>
      
      {/* 模型选择器弹窗 */}
      {showModelSelector && (
        <div 
          ref={modelSelectorRef}
          className="model-selector-container absolute bottom-full left-4 mb-12 w-[calc(100vw-2rem)] max-w-lg max-h-[70vh] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/60 dark:border-gray-700/60 z-50 overflow-hidden"
          style={{
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(var(--primary-color), 0.2)'
          }}
        >
          <div className="model-selector-header p-3 border-b border-gray-200/50 dark:border-gray-700/80 flex justify-between items-center bg-gradient-to-r from-white/95 to-white/85 dark:from-gray-800/95 dark:to-gray-900/95 backdrop-blur-md">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-white">{t('chat.modelSelector.title')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-100 mt-1 flex items-center">
                {t('chat.modelSelector.current')}: 
                <span className="ml-1 text-[rgb(var(--primary-color))] font-medium">{getSelectedModelName()}</span>
                {isLoadingModels && (
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 flex items-center">
                    <span className="w-3 h-3 border-1 border-[rgba(var(--primary-color),0.3)] border-t-[rgb(var(--primary-color))] rounded-full animate-spin mr-1"></span>
                    更新中...
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="overflow-y-auto model-selector-scrollbar max-h-[calc(70vh-60px)] px-2 bg-white/80 dark:bg-gray-800/80">
            {models.length > 0 ? (
              <div className="p-2">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className={`model-item flex items-center p-2.5 my-1 rounded-lg cursor-pointer transition-all border border-transparent hover:border-[rgba(var(--primary-color),0.3)] ${
                      selectedModel === model.id 
                        ? 'selected bg-[rgba(var(--primary-color),0.12)] text-[rgb(var(--primary-color))]' 
                        : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200'
                    }`}
                    onClick={() => handleSelectModel(model.id)}
                  >
                    <div className="w-6 h-6 mr-3 flex items-center justify-center">
                      {model.icon ? (
                        <img 
                          src={model.icon} 
                          alt={model.name || model.id} 
                          className="w-5 h-5 object-contain" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <img 
                            src="/images/modelimg/gpt6.png"
                            alt="AI模型" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-medium truncate">{model.name || model.id}</div>
                      {model.name && !model.id.startsWith('ollama:') && 
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{model.id}</div>
                      }
                      
                      {/* 显示标签 */}
                      {model.tags && model.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {model.tags.map((tag, index) => (
                            <span 
                              key={index}
                              className="px-2 py-0.75 text-xs rounded-full font-medium"
                              style={{ 
                                backgroundColor: `${tag.color}15`, 
                                color: tag.color,
                                borderWidth: '1px',
                                borderColor: `${tag.color}30`,
                                boxShadow: `0 1px 2px ${tag.color}10`
                              }}
                            >
                              {tag.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedModel === model.id && (
                      <div className="w-2 h-2 rounded-full bg-[rgb(var(--primary-color))] ml-1 animate-pulse"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : isLoadingModels ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center">
                <div className="w-6 h-6 border-2 border-[rgba(var(--primary-color),0.3)] border-t-[rgb(var(--primary-color))] rounded-full animate-spin mb-2"></div>
                正在加载模型...
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('chat.modelSelector.empty')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 