'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  FiArrowLeft, FiServer, FiDownload, FiInfo, 
  FiAlertCircle, FiCheckCircle, FiLoader, FiSettings 
} from 'react-icons/fi';
import Link from 'next/link';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export default function OllamaModelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiUrl = searchParams.get('apiUrl') || 'http://localhost:11434';
  
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // 加载模型列表
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${apiUrl}/api/tags`);
        
        if (!response.ok) {
          throw new Error(`请求失败 (${response.status}): ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data && data.models) {
          setModels(data.models);
        } else {
          throw new Error('返回数据格式不正确');
        }
      } catch (err: any) {
        console.error('获取 Ollama 模型失败:', err);
        setError(err.message || '获取模型列表失败，请检查 Ollama 是否运行');
      } finally {
        setLoading(false);
      }
    };
    
    fetchModels();
  }, [apiUrl]);

  // 获取模型详情
  const getModelDetails = async (modelName: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`请求失败 (${response.status}): ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 找到这个模型并更新它的详情
      const updatedModels = models.map(model => {
        if (model.name === modelName) {
          return {
            ...model,
            details: {
              format: data.model.format || '未知',
              family: data.model.family || '未知',
              families: data.model.families || [],
              parameter_size: data.model.parameter_size || '未知',
              quantization_level: data.model.quantization_level || '未知',
            }
          };
        }
        return model;
      });
      
      setModels(updatedModels);
    } catch (err: any) {
      console.error(`获取模型 ${modelName} 详情失败:`, err);
    }
  };
  
  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* 头部导航 */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <FiArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Ollama 模型列表</h1>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <FiServer className="mr-1" />
            <span title={apiUrl}>{apiUrl}</span>
          </div>
        </div>
        
        {/* 状态信息 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4">
              <FiLoader size={40} className="animate-spin text-purple-600" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">正在从 Ollama 获取模型列表...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800 dark:text-red-300">连接 Ollama 失败</h3>
                <div className="mt-2 text-red-600 dark:text-red-400">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    提示: 确保 Ollama 正在运行，并且可以通过 {apiUrl} 访问。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 模型列表 */}
        {!loading && !error && (
          <>
            {models.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                <FiInfo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">没有找到模型</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  当前 Ollama 实例中没有安装任何模型。
                </p>
                <a 
                  href="https://ollama.com/library" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <FiDownload className="mr-1" /> 浏览 Ollama 模型库
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {models.map((model) => (
                  <div 
                    key={model.name}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{model.name}</h3>
                        <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          {model.details?.family || '模型'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedModel === model.name) {
                            setSelectedModel(null);
                          } else {
                            setSelectedModel(model.name);
                            if (!model.details) {
                              getModelDetails(model.name);
                            }
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        {selectedModel === model.name ? (
                          <FiCheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <FiInfo className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">大小</p>
                          <p className="font-medium text-gray-900 dark:text-white">{formatSize(model.size)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">最后修改</p>
                          <p className="font-medium text-gray-900 dark:text-white">{formatDate(model.modified_at)}</p>
                        </div>
                      </div>
                    </div>
                    
                    {selectedModel === model.name && model.details && (
                      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">模型详情</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">格式</p>
                            <p className="font-medium text-gray-900 dark:text-white">{model.details.format}</p>
                          </div>
                          {model.details.parameter_size && (
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">参数大小</p>
                              <p className="font-medium text-gray-900 dark:text-white">{model.details.parameter_size}</p>
                            </div>
                          )}
                          {model.details.quantization_level && (
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">量化级别</p>
                              <p className="font-medium text-gray-900 dark:text-white">{model.details.quantization_level}</p>
                            </div>
                          )}
                        </div>
                        
                        {model.details.families && model.details.families.length > 0 && (
                          <div className="mt-4">
                            <p className="text-gray-500 dark:text-gray-400 mb-1">模型家族</p>
                            <div className="flex flex-wrap gap-2">
                              {model.details.families.map((family, index) => (
                                <span 
                                  key={index}
                                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
                                >
                                  {family}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => {
                              const modelName = encodeURIComponent(model.name);
                              const url = `/api/models/set-ollama?model=${modelName}&apiUrl=${encodeURIComponent(apiUrl)}`;
                              
                              fetch(url, {
                                method: 'POST',
                              })
                                .then(response => response.json())
                                .then(data => {
                                  if (data.success) {
                                    alert(`已设置 ${model.name} 为当前模型`);
                                    router.push('/');
                                  } else {
                                    alert(`设置失败: ${data.message}`);
                                  }
                                })
                                .catch(err => {
                                  alert(`设置失败: ${err.message}`);
                                });
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            <FiSettings className="mr-1" /> 使用此模型
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 