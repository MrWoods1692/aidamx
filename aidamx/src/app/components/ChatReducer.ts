import { Message } from './ChatTypes';

// 定义状态类型
export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  currentChatId: number | null;
  currentChatTitle: string;
  isLoadingChat: boolean;
  selectedModel: any;
  modelEndpoint: string;
  models: any[];
  lastSelectedModelId: string;
}

// 定义操作类型
export type ChatAction =
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGES'; payload: Message[] }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'REPLACE_LOADING_MESSAGE'; payload: Message }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_CHAT_ID'; payload: number | null }
  | { type: 'SET_CHAT_TITLE'; payload: string }
  | { type: 'SET_LOADING_CHAT'; payload: boolean }
  | { type: 'SET_SELECTED_MODEL'; payload: any }
  | { type: 'SET_MODEL_ENDPOINT'; payload: string }
  | { type: 'SET_MODELS'; payload: any[] }
  | { type: 'SET_LAST_SELECTED_MODEL_ID'; payload: string }
  | { type: 'CLEAR_CHAT' };

// 初始状态
export const initialChatState: ChatState = {
  messages: [],
  isTyping: false,
  currentChatId: null,
  currentChatTitle: '',
  isLoadingChat: false,
  selectedModel: null,
  modelEndpoint: '',
  models: [],
  lastSelectedModelId: '',
};

// Reducer函数
export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.payload,
      };
    case 'ADD_MESSAGES':
      return {
        ...state,
        messages: [...state.messages, ...action.payload],
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        ),
      };
    case 'REPLACE_LOADING_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.isLoading ? {...action.payload, transition: true} : msg
        ),
      };
    case 'SET_TYPING':
      return {
        ...state,
        isTyping: action.payload,
      };
    case 'SET_CHAT_ID':
      return {
        ...state,
        currentChatId: action.payload,
      };
    case 'SET_CHAT_TITLE':
      return {
        ...state,
        currentChatTitle: action.payload,
      };
    case 'SET_LOADING_CHAT':
      return {
        ...state,
        isLoadingChat: action.payload,
      };
    case 'SET_SELECTED_MODEL':
      return {
        ...state,
        selectedModel: action.payload,
      };
    case 'SET_MODEL_ENDPOINT':
      return {
        ...state,
        modelEndpoint: action.payload,
      };
    case 'SET_MODELS':
      return {
        ...state,
        models: action.payload,
      };
    case 'SET_LAST_SELECTED_MODEL_ID':
      return {
        ...state,
        lastSelectedModelId: action.payload,
      };
    case 'CLEAR_CHAT':
      return {
        ...state,
        messages: [],
        currentChatId: null,
        currentChatTitle: '',
      };
    default:
      return state;
  }
}; 