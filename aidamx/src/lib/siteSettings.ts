import mysql from 'mysql2/promise';

// 获取网站设置接口
export interface SiteSettings {
  title: string;
  logo: string;
}

// 创建数据库连接
async function connectToDatabase() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw new Error('数据库连接失败');
  }
}

// 获取网站设置
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const connection = await connectToDatabase();
    
    try {
      // 查询网站设置
      const [settingsResult] = await connection.execute(`
        SELECT 
          site_title, 
          site_logo
        FROM 
          site_settings
        LIMIT 1
      `);
      
      const settingsArray = settingsResult as any[];
      
      if (settingsArray && settingsArray.length > 0) {
        const settings = settingsArray[0];
        
        return {
          title: settings.site_title,
          logo: settings.site_logo
        };
      }
      
      // 返回默认设置
      return {
        title: 'Code Assistant',
        logo: '/favicon.ico'
      };
    } finally {
      // 确保关闭数据库连接
      await connection.end();
    }
  } catch (error) {
    console.error('获取网站设置失败:', error);
    
    // 发生错误时返回默认设置
    return {
      title: 'Code Assistant',
      logo: '/favicon.ico'
    };
  }
} 