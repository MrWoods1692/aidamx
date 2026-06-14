'use client';

import { useState, useEffect, useRef, MutableRefObject, useCallback } from 'react';
import { useI18n } from '../providers/I18nProvider';
import { FiPlus, FiMessageSquare, FiSettings, FiHome, FiSearch, FiX, FiPenTool, FiZap, FiSun, FiMoon, FiGlobe, FiUser, FiLogOut, FiLoader, FiChevronDown, FiChevronUp, FiTrash2, FiInfo, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { useTheme } from 'next-themes';
import ThemeColorPicker from './ThemeColorPicker';
import { applyThemeColor } from '../store/themeColorStore';
import { useThemeColorStore } from '../store/themeColorStore';
import { useRouter } from 'next/navigation';
import { useI18nStore, Locale } from '../i18n';
import { useUserStore } from './Navbar';
import Image from 'next/image';
import { FaChevronDown, FaChevronRight, FaEdit, FaRobot } from 'react-icons/fa';
import Loader from './Loader';
import ConfirmDialog from './ConfirmDialog';

// 创建一个全局状态控制侧边栏
import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  isSmallSidebarOpen: boolean;
  isMobileView: boolean;
  isInitialized: boolean;
  isClosingLarge: boolean;
  isClosingSmall: boolean;
  toggle: () => void;
  toggleSmallSidebar: () => void;
  setOpen: (open: boolean) => void;
  setSmallSidebarOpen: (open: boolean) => void;
  setMobileView: (isMobile: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setClosingLarge: (isClosing: boolean) => void;
  setClosingSmall: (isClosing: boolean) => void;
  closeWithAnimation: () => void;
  closeSmallWithAnimation: () => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isOpen: true, // 默认为true，避免闪烁
  isSmallSidebarOpen: true, // 默认为true，避免闪烁
  isMobileView: false,
  isInitialized: false,
  isClosingLarge: false,
  isClosingSmall: false,
  toggle: () => {
    const state = get();
    if (state.isOpen) {
      state.closeWithAnimation();
    } else {
      set({ isOpen: true });
    }
  },
  toggleSmallSidebar: () => {
    const state = get();
    if (state.isSmallSidebarOpen) {
      state.closeSmallWithAnimation();
    } else {
      set({ isSmallSidebarOpen: true });
    }
  },
  setOpen: (open: boolean) => set({ isOpen: open }),
  setSmallSidebarOpen: (open: boolean) => set({ isSmallSidebarOpen: open }),
  setMobileView: (isMobile: boolean) => set({ isMobileView: isMobile }),
  setInitialized: (initialized: boolean) => set({ isInitialized: initialized }),
  setClosingLarge: (isClosing: boolean) => set({ isClosingLarge: isClosing }),
  setClosingSmall: (isClosing: boolean) => set({ isClosingSmall: isClosing }),
  closeWithAnimation: () => {
    set({ isClosingLarge: true });
    setTimeout(() => {
      set({ isOpen: false, isClosingLarge: false });
    }, 300);
  },
  closeSmallWithAnimation: () => {
    set({ isClosingSmall: true });
    setTimeout(() => {
      set({ isSmallSidebarOpen: false, isClosingSmall: false });
    }, 300);
  }
}));

// 组件渲染前的初始化处理
// 这样可以避免服务端渲染和客户端水合时的差异导致闪烁
if (typeof window !== 'undefined') {
  // 预先检测移动设备
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    // 设置移动设备状态但不触发重渲染
    useSidebarStore.setState({
      isMobileView: true,
      isOpen: false,
      isSmallSidebarOpen: false
    });
  }
}

// 添加聊天历史记录类型
interface ChatHistory {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  first_message?: string;
  message_count: number;
}

export default function Sidebar() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [isConversationsCollapsed, setIsConversationsCollapsed] = useState<boolean>(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  
  // 添加用于编辑标题的状态
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>('');
  
  const { 
    isOpen, 
    isSmallSidebarOpen, 
    isMobileView, 
    isInitialized, 
    isClosingLarge, 
    isClosingSmall,
    setMobileView, 
    setInitialized,
    closeWithAnimation,
    closeSmallWithAnimation
  } = useSidebarStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const skinButtonRef = useRef<HTMLButtonElement>(null) as MutableRefObject<HTMLButtonElement>;
  const languageButtonRef = useRef<HTMLButtonElement>(null) as MutableRefObject<HTMLButtonElement>;
  const router = useRouter();
  const { languages, setLocale, locale } = useI18nStore();
  const { isLoggedIn, user, logout } = useUserStore();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [models, setModels] = useState<{id: string, name: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isCreateChatLoading, setIsCreateChatLoading] = useState(false);
  
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
    // 清除之前的计时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    
    // 设置消息内容
    setToast({
      show: true,
      message,
      type
    });
    
    // 设置自动关闭计时器
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, duration);
  };
  
  // 客户端渲染后的处理
  useEffect(() => {
    setMounted(true);
    
    // 初始应用当前保存的主题颜色
    if (typeof window !== 'undefined') {
      applyThemeColor();
      
      // 检测是否为移动设备
      const checkMobileView = () => {
        const isMobile = window.innerWidth < 768;
        setMobileView(isMobile);
        
        // 只在移动端调整侧边栏状态
        if (isMobile) {
          useSidebarStore.getState().setOpen(false);
          useSidebarStore.getState().setSmallSidebarOpen(false);
        }
        
        // 标记初始化完成
        setInitialized(true);
      };
      
      // 初始检测
      checkMobileView();
      
      // 监听窗口大小变化
      window.addEventListener('resize', checkMobileView);
      
      return () => {
        window.removeEventListener('resize', checkMobileView);
      };
    }
  }, [setMobileView, setInitialized]);
  
  // 检查用户登录状态
  useEffect(() => {
    const validateUserStatus = async () => {
      if (isLoggedIn) {
        try {
          const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.log('用户验证失败，正在登出...');
            logout();
            localStorage.removeItem('user-storage'); // 清除本地存储
          }
        } catch (error) {
          console.error('验证用户状态时出错:', error);
        }
      }
    };

    validateUserStatus();
  }, [isLoggedIn, logout]);
  
  // 获取移动端可见性类名
  const getMobileVisibilityClass = (isVisible: boolean) => {
    if (!mounted) return '';
    if (!isMobileView) return '';
    return isVisible ? 'mobile-visible' : '';
  };
  
  // 获取当前主题的背景色
  const getBackgroundColor = () => {
    if (!mounted) return 'rgba(209, 250, 229, 0.6)';
    
    // 获取当前主题颜色ID
    const themeStore = useThemeColorStore.getState();
    const currentColorId = themeStore.currentColorId;
    
    // 如果是绿色主题，返回白色背景
    if (currentColorId === 'green') {
      return resolvedTheme === 'dark' 
        ? 'rgba(30, 30, 30, 0.7)' 
        : 'rgba(255, 255, 255, 0.9)';
    }
    
    // 其他主题使用默认的淡绿色背景
    return resolvedTheme === 'dark' 
      ? 'rgba(6, 95, 70, 0.2)' 
      : 'rgba(209, 250, 229, 0.6)';
  };
  
  // 加载聊天历史记录
  const loadChatHistory = useCallback(async () => {
    if (!isLoggedIn) return;
    
    setIsLoadingChats(true);
    try {
      const response = await fetch('/api/chat/history');
      
      if (!response.ok) {
        // 如果响应是401未授权，说明用户未登录，静默失败
        if (response.status === 401) {
          console.log('用户未登录或会话已过期，跳过加载聊天历史');
          setChats([]);
          return;
        }
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setChats(data.data);
      } else {
        // 只在消息不是"未登录"时才显示错误
        if (data.message !== '未登录') {
          console.error('加载聊天历史失败:', data.message);
        } else {
          console.log('用户未登录，跳过加载聊天历史');
        }
      }
    } catch (error) {
      // 捕获但不显示错误
      console.log('加载聊天历史时发生错误，可能是网络问题');
    } finally {
      setIsLoadingChats(false);
    }
  }, [isLoggedIn]);
  
  // 当用户登录状态变化时加载聊天历史
  useEffect(() => {
    if (mounted && isLoggedIn) {
      loadChatHistory();
    }
  }, [mounted, isLoggedIn, loadChatHistory]);

  // 监听聊天标题更新事件
  useEffect(() => {
    // 创建自定义事件监听器
    const handleTitleUpdate = () => {
      // 只在用户已登录时加载聊天历史
      if (isLoggedIn) {
        console.log('Sidebar 接收到标题更新事件，重新加载聊天历史');
        loadChatHistory();
      } else {
        console.log('Sidebar 接收到标题更新事件，但用户未登录，跳过加载');
      }
    };
    
    // 添加事件监听
    window.addEventListener('chatTitleUpdated', handleTitleUpdate);
    
    // 清理函数
    return () => {
      window.removeEventListener('chatTitleUpdated', handleTitleUpdate);
    };
  }, [loadChatHistory, isLoggedIn]);

  // 处理聊天项点击
  const handleChatItemClick = (chatId: number) => {
    setActiveChatId(chatId);
    
    // 触发自定义事件，通知ChatArea加载指定的聊天
    const event = new CustomEvent('loadChat', { detail: { chatId } });
    window.dispatchEvent(event);
    
    // 在移动设备上，点击后关闭侧边栏
    if (isMobileView) {
      closeWithAnimation();
    }
  };
  
  const addNewChat = () => {
    // 创建自定义事件通知ChatArea组件创建新聊天
    const event = new CustomEvent('newChat');
    window.dispatchEvent(event);
    console.log('触发新建聊天事件');
    
    // 在移动设备上关闭侧边栏
    if (isMobileView) {
      closeWithAnimation();
    }
  };
  
  // 打开颜色选择器
  const handleOpenColorPicker = () => {
    setColorPickerOpen(true);
  };
  
  // 过滤聊天
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // 切换主题
  const toggleTheme = () => {
    // 添加no-transition类以禁用所有过渡效果
    document.documentElement.classList.add('no-transition');
    
    // 切换主题
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    
    // 立即应用主题颜色
    setTimeout(() => {
      applyThemeColor();
      
      // 短暂延迟后移除no-transition类，恢复过渡效果
      setTimeout(() => {
        document.documentElement.classList.remove('no-transition');
      }, 20);
    }, 0);
  };
  
  // 切换语言
  const changeLanguage = (newLocale: Locale) => {
    setLocale(newLocale);
    setLanguageMenuOpen(false);
    // 更新语言切换按钮文本
    setTimeout(() => {
      applyThemeColor();
    }, 0);
  };
  
  // 获取当前语言名称
  const getCurrentLanguageName = () => {
    const currentLang = languages.find(lang => lang.code === locale);
    return currentLang ? currentLang.name : '简体中文';
  };
  
  // 处理登录点击
  const handleLoginClick = () => {
    router.push('/login');
  };
  
  // 处理退出登录
  const handleLogout = async () => {
    try {
      // 调用登出API清除服务器端cookie
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // 清除客户端状态
        logout();
        localStorage.removeItem('user-storage'); // 确保完全清除用户数据
        router.push('/login');
      }
    } catch (error) {
      console.error('登出失败:', error);
      // 即使API调用失败，也清除本地状态
      logout();
      localStorage.removeItem('user-storage');
      router.push('/login');
    }
  };
  
  // 处理设置按钮点击
  const handleSettingsClick = () => {
    router.push('/profile');
  };
  
  // 检测点击遮罩关闭侧边栏
  const handleOverlayClick = () => {
    if (isMobileView) {
      // 使用动画关闭
      if (isOpen) closeWithAnimation();
      if (isSmallSidebarOpen) closeSmallWithAnimation();
    }
  };
  
  // 处理对话标题点击，切换折叠状态
  const toggleConversationsCollapse = () => {
    setIsConversationsCollapsed(!isConversationsCollapsed);
  };
  
  // 替换deleteChatHistory函数
  const deleteChatHistory = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发聊天项点击
    
    // 不再使用window.confirm，而是设置状态来显示对话框
    setChatToDelete(chatId);
    setIsConfirmDialogOpen(true);
  };
  
  // 添加实际的删除函数
  const handleConfirmDelete = async () => {
    if (chatToDelete === null) return;
    
    try {
      const response = await fetch(`/api/chat/history/delete?chatId=${chatToDelete}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态，移除已删除的聊天
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete));
        
        // 如果删除的是当前选中的聊天，清空当前聊天ID
        if (chatToDelete === activeChatId) {
          // 触发新建聊天事件，清空聊天区域
          const event = new Event('newChat');
          window.dispatchEvent(event);
        }
        
        // 显示toast消息
        showToast('聊天记录已删除', 'success');
      } else {
        console.error('删除聊天记录失败:', data.message);
        alert(`删除失败: ${data.message}`);
        
        // 显示错误toast
        showToast(`删除失败: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('删除聊天记录请求出错:', error);
      alert('删除聊天记录失败，请稍后重试');
      
      // 显示错误toast
      showToast('删除聊天记录失败，请稍后重试', 'error');
    } finally {
      // 关闭对话框并重置要删除的聊天ID
      setIsConfirmDialogOpen(false);
      setChatToDelete(null);
    }
  };
  
  // 添加处理标题编辑的函数
  const handleTitleEdit = (chatId: number, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发聊天项点击
    setEditingChatId(chatId);
    setEditedTitle(currentTitle);
  };

  // 添加保存标题的函数
  const saveEditedTitle = async (chatId: number) => {
    if (!editedTitle.trim()) {
      // 如果标题为空，取消编辑
      setEditingChatId(null);
      return;
    }
    
    try {
      const response = await fetch(`/api/chat/history/update-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          title: editedTitle
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        setChats(prevChats => prevChats.map(chat => 
          chat.id === chatId ? { ...chat, title: editedTitle } : chat
        ));
        showToast('标题已更新', 'success');
      } else {
        showToast(`更新失败: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('更新标题失败:', error);
      showToast('更新标题失败，请稍后重试', 'error');
    } finally {
      setEditingChatId(null);
    }
  };

  // 添加格式化日期的函数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      // 如果是今天，显示时间
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      // 如果不是今天，显示日期
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };
  
  return (
    <>
      {/* 移动端背景遮罩 - 只在侧边栏打开时显示 */}
      {mounted && isMobileView && (isOpen || isSmallSidebarOpen) && (
        <div 
          className="fixed inset-0 z-40 animate-fadeIn"
          onClick={handleOverlayClick}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            top: isMobileView ? 'var(--navbar-height)' : '0',
            height: isMobileView ? 'calc(100vh - var(--navbar-height))' : '100vh'
          }}
        />
      )}
      
      <div className="h-full flex flex-shrink-0">
        {/* 小侧边栏 - CSS控制显示/隐藏 */}
        <div 
          style={{ 
            backgroundColor: 'rgb(var(--sidebar-bg))',
            ...(isMobileView ? {
              position: 'fixed',
              left: 0,
              top: isMobileView ? 'var(--navbar-height)' : '0',
              zIndex: 50,
              height: isMobileView ? 'calc(100vh - var(--navbar-height))' : '100vh',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            } : {})
          }} 
          className={`w-16 h-full border-r border-[rgb(var(--border-color))] flex flex-col items-center py-4 relative flex-shrink-0 transition-transform duration-300 
            ${isMobileView ? (isClosingSmall ? 'animate-slideOutLeft' : (isSmallSidebarOpen ? 'animate-slideInLeft' : '')) : ''}
            ${getMobileVisibilityClass(isSmallSidebarOpen)}`}
        >
          <div className="flex flex-col items-center gap-6">
            {/* 主页图标 - 固定宽度确保按钮正方形 */}
            <div className="w-12 h-12 flex justify-center items-center">
              <button className="w-full h-full rounded-lg hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] flex flex-col items-center justify-center"
                onClick={addNewChat}
              >
                <FiMessageSquare className="text-xl mb-1" />
                <span className="text-xs text-center w-full whitespace-normal px-0.5">{t('sidebar.conversations')}</span>
              </button>
            </div>
          </div>
          
          {/* 添加外观和设置按钮在底部 - 固定宽度确保按钮正方形 */}
          <div className="absolute bottom-20 inset-x-0 flex justify-center">
            <div className="w-12 h-12 flex justify-center items-center">
              <button 
                ref={skinButtonRef}
                className="w-full h-full rounded-lg hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--text-secondary))] flex flex-col items-center justify-center cursor-pointer"
                onClick={handleOpenColorPicker}
              >
                <FiZap className="text-xl mb-1" />
                <span className="text-xs">{t('sidebar.skin')}</span>
              </button>
            </div>
          </div>
          
          <div className="absolute bottom-4 inset-x-0 flex justify-center">
            <div className="w-12 h-12 flex justify-center items-center">
              <button 
                onClick={handleSettingsClick}
                className="w-full h-full rounded-lg hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--text-secondary))] flex flex-col items-center justify-center cursor-pointer"
              >
                <FiUser className="text-xl mb-1" />
                <span className="text-xs">{t('sidebar.settings')}</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* 大侧边栏 - CSS控制显示/隐藏 */}
        <div 
          style={{ 
            backgroundColor: 'rgb(var(--sidebar-bg))',
            ...(isMobileView ? {
              position: 'fixed',
              left: 0,
              top: isMobileView ? 'var(--navbar-height)' : '0',
              zIndex: 50,
              height: isMobileView ? 'calc(100vh - var(--navbar-height))' : '100vh',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            } : {})
          }}
          className={`w-64 h-full border-r border-[rgb(var(--border-color))] flex flex-col transition-transform duration-300 flex-shrink-0 
            ${isMobileView ? (isClosingLarge ? 'animate-slideOutLeft' : (isOpen ? 'animate-slideInLeft' : '')) : ''}
            ${getMobileVisibilityClass(isOpen)}`}
        >
          {/* 搜索对话框 */}
          <div className="p-4 pb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="text-[rgb(var(--text-secondary))]" />
              </div>
              <input
                type="text"
                placeholder={t('sidebar.searchChat')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-[rgb(var(--border-color))] rounded-md bg-[rgb(var(--input-bg))] text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
              />
              {searchTerm && (
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[rgb(var(--text-secondary))]"
                  onClick={() => setSearchTerm('')}
                >
                  <FiX className="text-sm" />
                </button>
              )}
            </div>
          </div>
          
          {/* 新对话按钮 */}
          <div className="px-4 pb-4">
            <button 
              onClick={addNewChat}
              className="primary-button w-full"
            >
              <FiPlus />
              {t('chat.newChat')}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 pb-6">
            <div className="mb-4">
              <div 
                className="sidebar-item text-[rgb(var(--text-secondary))] mb-2 font-medium"
                style={{ 
                  backgroundColor: getBackgroundColor(),
                  cursor: 'pointer'
                }}
                onClick={toggleConversationsCollapse}
              >
                <FiMessageSquare />
                <span>{t('sidebar.conversations')}</span>
                <div className="ml-auto">
                  {isConversationsCollapsed ? 
                    <FiChevronDown className="text-[rgb(var(--text-secondary))]" /> : 
                    <FiChevronUp className="text-[rgb(var(--text-secondary))]" />
                  }
                </div>
              </div>
              
              {!isConversationsCollapsed && (
                <>
                  {isLoadingChats ? (
                    <div className="text-center py-4 text-[rgb(var(--text-secondary))]">
                      <div className="transform scale-50">
                        <Loader />
                      </div>
                      加载聊天记录...
                    </div>
                  ) : filteredChats.length === 0 ? (
                    <div className="text-center py-2 px-1 text-[rgb(var(--text-secondary))] text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                      {searchTerm ? t('sidebar.noMatchedChats') : t('sidebar.noChats')}
                    </div>
                  ) : (
                    filteredChats.map((chat) => {
                      // 获取当前主题是否为绿色
                      const isGreenTheme = useThemeColorStore.getState().currentColorId === 'green';
                      
                      return (
                        <div 
                          key={chat.id} 
                          className={`sidebar-item conversation-item pl-8 py-2 flex flex-col group relative ${isGreenTheme ? 'green-theme-hover' : ''} ${
                            activeChatId === chat.id ? 'bg-[rgba(var(--primary-color),0.15)] dark:bg-[rgba(var(--primary-color),0.25)]' : ''
                          }`}
                          style={{ 
                            backgroundColor: activeChatId === chat.id ? undefined : getBackgroundColor(),
                            cursor: 'pointer'
                          }}
                          onClick={() => handleChatItemClick(chat.id)}
                        >
                          {/* 标题行 */}
                          <div className="flex items-center w-full">
                            <FiMessageSquare className="flex-shrink-0" />
                            
                            {editingChatId === chat.id ? (
                              <div className="flex-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editedTitle}
                                  onChange={(e) => setEditedTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditedTitle(chat.id);
                                    if (e.key === 'Escape') setEditingChatId(null);
                                  }}
                                  className="w-full px-2 py-1 bg-[rgb(var(--input-bg))] border border-[rgb(var(--border-color))] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary-color))]"
                                  autoFocus
                                  onBlur={() => saveEditedTitle(chat.id)}
                                />
                              </div>
                            ) : (
                              <span className="truncate mr-8 ml-2">{chat.title}</span>
                            )}
                          </div>
                          
                          {/* 时间和操作按钮行 - 完全重新设计 */}
                          <div className="flex justify-between items-center w-full mt-1">
                            {/* 时间显示完全靠左 */}
                            <div className="pl-6 text-xs text-[rgb(var(--text-secondary))]">
                              {formatDate(chat.updated_at)}
                            </div>
                            
                            {/* 操作按钮完全靠右 */}
                            <div className="flex items-center mr-2 space-x-1">
                              {/* 删除按钮 */}
                              <button
                                className="w-6 h-6 flex items-center justify-center text-[rgb(var(--text-secondary))] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full"
                                onClick={(e) => deleteChatHistory(chat.id, e)}
                                aria-label="删除聊天记录"
                                title="删除聊天记录"
                              >
                                <FiTrash2 size={14} />
                              </button>
                              
                              {/* 编辑按钮 */}
                              <button
                                className="w-6 h-6 flex items-center justify-center text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--primary-color))] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out hover:bg-[rgba(var(--primary-color),0.1)] rounded-full"
                                onClick={(e) => handleTitleEdit(chat.id, chat.title, e)}
                                aria-label="编辑标题"
                                title="编辑标题"
                              >
                                <FaEdit size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* 添加底部功能区 - 使用px-4 pt-3 pb-4与聊天区域保持一致 */}
          <div className="border-t border-[rgb(var(--border-color))]">
            {/* 用户信息/登录区域 */}
            <div className="px-4 py-3">
              {mounted ? (
                !isLoggedIn ? (
                  <button 
                    onClick={handleLoginClick}
                    className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-[rgba(var(--primary-color),0.1)]"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[rgba(var(--primary-color),0.1)] flex items-center justify-center text-[rgb(var(--primary-color))]">
                      <FiUser className="text-xl" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="block text-[rgb(var(--text-primary))] font-medium">{t('app.login')}</span>
                      <span className="block text-xs text-[rgb(var(--text-secondary))]">{t('app.loginTip')}</span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-[rgba(var(--primary-color),0.1)]">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden">
                      {user?.avatar ? (
                        <Image 
                          src={user.avatar} 
                          alt={user.name || 'User'} 
                          width={40} 
                          height={40} 
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-[rgba(var(--primary-color),0.8)] flex items-center justify-center text-white">
                          {user?.name ? user.name.charAt(0).toUpperCase() : <FiUser className="text-xl" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="block text-[rgb(var(--text-primary))] font-medium truncate">{user?.name || 'User'}</span>
                      <button 
                        onClick={handleLogout}
                        className="text-xs text-[rgb(var(--primary-color))] hover:underline cursor-pointer"
                      >
                        {t('app.logout')}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                // 默认显示登录按钮，确保服务端渲染一致
                <div className="flex items-center gap-3 w-full p-2 rounded-md">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[rgba(var(--primary-color),0.1)] flex items-center justify-center text-[rgb(var(--primary-color))]">
                    <FiUser className="text-xl" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="block text-[rgb(var(--text-primary))] font-medium">{t('app.login')}</span>
                    <span className="block text-xs text-[rgb(var(--text-secondary))]">{t('app.loginTip')}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* 功能按钮区域 */}
            <div className="flex items-center px-4 pb-4">
              <div className="flex w-full gap-2">
                {/* 语言切换 */}
                <div className="relative flex-1">
                  <button 
                    ref={languageButtonRef}
                    className="flex flex-col items-center justify-center w-full h-14 rounded-md bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.2)]"
                    onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                    aria-label="切换语言"
                  >
                    <FiGlobe className="text-xl mb-1" />
                    <span className="text-xs">{t('app.switchLanguage')}</span>
                  </button>
                  
                  {mounted && languageMenuOpen && (
                    <div 
                      className="absolute left-0 bottom-full mb-1 rounded-md shadow-lg z-50 border border-[rgb(var(--border-color))] min-w-[8rem] w-full"
                      style={{ backgroundColor: 'rgb(var(--card-bg))' }}
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => changeLanguage(lang.code)}
                          className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap hover:bg-[rgba(var(--primary-color),0.1)] ${
                            locale === lang.code ? 'text-[rgb(var(--primary-color))]' : ''
                          }`}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* 主题切换 */}
                <button
                  onClick={toggleTheme}
                  className="flex-1 flex flex-col items-center justify-center h-14 rounded-md bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.2)]"
                  aria-label="切换主题"
                >
                  {mounted ? (
                    resolvedTheme === 'dark' ? (
                      <>
                        <FiSun className="text-xl mb-1" />
                        <span className="text-xs">{t('app.theme.light')}</span>
                      </>
                    ) : (
                      <>
                        <FiMoon className="text-xl mb-1" />
                        <span className="text-xs">{t('app.theme.dark')}</span>
                      </>
                    )
                  ) : (
                    <>
                      <FiSun className="text-xl mb-1" />
                      <span className="text-xs">{t('app.theme.light')}</span>
                    </>
                  )}
                </button>
                
                {/* 设置按钮 */}
                <button 
                  onClick={handleSettingsClick}
                  className="flex-1 flex flex-col items-center justify-center h-14 rounded-md bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] hover:bg-[rgba(var(--primary-color),0.2)]"
                  aria-label="个人中心"
                >
                  <FiUser className="text-xl mb-1" />
                  <span className="text-xs">{t('sidebar.profile')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 颜色选择器 */}
        <ThemeColorPicker 
          isOpen={colorPickerOpen} 
          onClose={() => setColorPickerOpen(false)}
          buttonRef={skinButtonRef}
        />
      </div>
      
      {/* 确认删除对话框 */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="删除聊天记录"
        message="确定要删除此聊天记录吗？删除后将无法恢复。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmDialogOpen(false);
          setChatToDelete(null);
        }}
        type="danger"
      />
      
      {/* Toast通知 */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 toast-container show">
          <div className={`px-4 py-3 rounded-lg shadow-xl flex items-center ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white'
          }`}>
            <span className="mr-3">
              {toast.type === 'success' && <FiCheckCircle className="text-white text-xl" />}
              {toast.type === 'error' && <FiAlertTriangle className="text-white text-xl" />}
              {toast.type === 'info' && <FiInfo className="text-white text-xl" />}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
} 