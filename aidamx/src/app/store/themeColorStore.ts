// 在文件顶部添加类型扩展
declare global {
  interface Window {
    themeApplied?: boolean;
    initialThemeId?: string;
  }
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 控制是否显示调试日志
const DEBUG_MODE = false;

// 安全的日志函数
const safeLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

export interface ThemeColor {
  id: string;
  name: string;
  primary: string;
  hover: string;
  bgLight: string;
  bgDark: string;
}

interface ThemeColorState {
  colors: ThemeColor[];
  currentColorId: string;
  setCurrentColorId: (id: string) => void;
}

// 预定义的主题颜色
const defaultColors: ThemeColor[] = [
  {
    id: 'white',
    name: '白色',
    primary: '100, 108, 255', // 使用紫色作为强调色
    hover: '116, 123, 255',
    bgLight: '255, 255, 255', // 纯白色背景
    bgDark: '30, 30, 30'      // 深灰色
  },
  {
    id: 'purple',
    name: '紫色',
    primary: '100, 108, 255', // 默认紫色
    hover: '116, 123, 255',
    bgLight: '245, 245, 255', // 淡紫色
    bgDark: '30, 27, 75'      // 深紫色
  },
  {
    id: 'orange',
    name: '橘色',
    primary: '249, 115, 22', // 淡橘色
    hover: '253, 186, 116',
    bgLight: '255, 250, 245',
    bgDark: '40, 26, 13'
  },
  {
    id: 'green',
    name: '绿色',
    primary: '34, 197, 94', // 淡绿色
    hover: '134, 239, 172',
    bgLight: '240, 253, 244',
    bgDark: '11, 40, 24'
  },
  {
    id: 'blue',
    name: '蓝色',
    primary: '59, 130, 246', // 淡蓝色
    hover: '147, 197, 253',
    bgLight: '239, 246, 255',
    bgDark: '12, 32, 63'
  },
  {
    id: 'pink',
    name: '粉色',
    primary: '236, 72, 153', // 粉色
    hover: '249, 168, 212',
    bgLight: '253, 242, 248',
    bgDark: '55, 11, 36'
  },
];

export const useThemeColorStore = create<ThemeColorState>()(
  persist(
    (set) => ({
      colors: defaultColors, // 确保包含所有默认颜色数组
      currentColorId: 'white', // 默认白色主题
      setCurrentColorId: (id: string) => set({ currentColorId: id }),
    }),
    {
      name: 'theme-color-storage',
      // 不使用merge函数，依赖内联脚本进行初始化
    }
  )
);

// 获取当前主题颜色
export const getCurrentThemeColor = (): ThemeColor => {
  try {
    const { colors, currentColorId } = useThemeColorStore.getState();
    
    // 验证colors数组
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      console.warn('主题颜色数组为空，使用默认色');
      return defaultColors[0]; // 直接返回默认颜色数组的第一项（紫色）
    }
    
    // 尝试根据ID查找颜色
    const foundColor = colors.find(color => color.id === currentColorId);
    if (foundColor) {
      return foundColor;
    }
    
    // 如果找不到匹配当前ID的颜色，尝试使用colors[0]
    if (colors[0]) {
      console.warn(`未找到ID为${currentColorId}的颜色，使用第一个可用颜色`);
      return colors[0];
    }
    
    // 如果一切都失败，返回默认紫色主题
    console.warn('无法找到有效颜色，使用默认紫色主题');
    return defaultColors[0];
  } catch (e) {
    console.error('获取当前主题颜色失败:', e);
    // 出错时也返回默认紫色主题
    return defaultColors[0];
  }
};

// 应用当前主题颜色到CSS变量
export const applyThemeColor = () => {
  try {
    // 获取当前保存的主题色
    const color = getCurrentThemeColor();
    
    if (!color || typeof color !== 'object') {
      console.error('应用主题颜色失败: 无效的颜色对象');
      return;
    }
    
    // 设置CSS变量
    document.documentElement.style.setProperty('--primary-color', color.primary);
    document.documentElement.style.setProperty('--primary-hover', color.hover);
    
    // 根据当前暗/亮模式设置背景色
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    if (isDarkMode) {
      // 直接使用主题的暗色背景
      document.documentElement.style.setProperty('--sidebar-bg', color.bgDark);
      document.documentElement.style.setProperty('--card-bg', color.bgDark);
      // 设置文本颜色
      document.documentElement.style.setProperty('--text-primary', '255, 255, 255');
      document.documentElement.style.setProperty('--text-secondary', '200, 200, 200');
      // 设置输入框背景
      document.documentElement.style.setProperty('--input-bg', '42, 42, 42');
    } else {
      // 直接使用主题的亮色背景
      document.documentElement.style.setProperty('--sidebar-bg', color.bgLight);
      document.documentElement.style.setProperty('--card-bg', color.bgLight);
      // 设置文本颜色
      document.documentElement.style.setProperty('--text-primary', '33, 33, 33');
      document.documentElement.style.setProperty('--text-secondary', '75, 85, 99');
      // 设置输入框背景
      document.documentElement.style.setProperty('--input-bg', '255, 255, 255');
    }

    // 标记主题已应用
    window.themeApplied = true;
    window.initialThemeId = color.id;

    // 触发一个自定义事件，通知应用颜色已更改
    const event = new CustomEvent('colorsapplied', { 
      detail: { 
        colorId: color.id, 
        isDarkMode 
      } 
    });
    window.dispatchEvent(event);
  } catch (error) {
    console.error('应用主题颜色过程中发生错误:', error);
  }
};

// 辅助函数：调整RGB颜色亮度
function adjustColor(rgbString: string, amount: number): string {
  // 解析RGB字符串成数字
  const parts = rgbString.split(',').map(part => {
    const num = parseInt(part.trim(), 10);
    // 调整亮度，但保持在0-255范围内
    return Math.min(255, Math.max(0, num + amount));
  });
  
  // 返回新的RGB字符串
  return parts.join(', ');
}

// 创建亮色模式下的卡片背景色 - 非常淡的主题色调
function createLightCardBg(color: ThemeColor): string {
  // 白色主题或紫色主题时直接返回预设值
  if (color.id === 'white') {
    return '255, 255, 255'; // 纯白色
  } else if (color.id === 'purple') {
    return '246, 246, 255'; // 与CSS预设的卡片背景色一致
  }
  
  try {
    // 从primary RGB解析出颜色
    const rgbParts = color.primary.split(',').map(p => parseInt(p.trim(), 10));
    // 创建一个非常淡的版本
    const lightParts = rgbParts.map(val => {
      // 将颜色值向255（白色）过渡90%（比原来的95%更明显）
      return Math.round(val * 0.1 + 255 * 0.9);
    });
    return lightParts.join(', ');
  } catch (e) {
    console.error("创建亮色背景失败:", e);
    return '255, 255, 255'; // 失败时返回白色
  }
}

// 创建亮色模式下的侧边栏背景色 - 淡的主题色调，但比卡片背景更明显
function createLightSidebarBg(color: ThemeColor): string {
  // 白色主题或紫色主题时直接返回预设值
  if (color.id === 'white') {
    return '255, 255, 255'; // 纯白色
  } else if (color.id === 'purple') {
    return '245, 245, 255'; // 与CSS预设的侧边栏背景色一致
  }
  
  try {
    // 从primary RGB解析出颜色
    const rgbParts = color.primary.split(',').map(p => parseInt(p.trim(), 10));
    // 创建一个淡的版本，但比卡片背景色更明显
    const lightParts = rgbParts.map(val => {
      // 将颜色值向255（白色）过渡85%
      return Math.round(val * 0.15 + 255 * 0.85);
    });
    return lightParts.join(', ');
  } catch (e) {
    console.error("创建侧边栏背景失败:", e);
    return '248, 250, 252'; // 失败时返回浅灰色
  }
}

// 用于初始化或重置颜色的辅助函数
export const resetThemeColors = () => {
  // 重置为默认颜色数组和白色主题
  useThemeColorStore.setState({
    colors: defaultColors,
    currentColorId: 'white'
  });
  // 应用颜色
  applyThemeColor();
}; 