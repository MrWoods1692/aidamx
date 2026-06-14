import { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
  avatar: string;
  createdAt: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (data.isValid) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, loading };
} 