import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

// GET: 获取所有可用模型（前台使用）
export async function GET() {
  try {
    const connection = await connectToDatabase();
    try {
      // 获取所有活跃服务商的模型
      const [modelsResult] = await connection.execute(`
        SELECT 
          pm.id as provider_model_id,
          pm.model_id,
          pm.display_name,
          pm.is_enabled,
          pm.sort_order,
          p.id as provider_id,
          p.name as provider_name,
          p.endpoint as provider_endpoint,
          p.api_key as provider_api_key,
          m.name as original_name,
          mi.icon_path
        FROM provider_models pm
        INNER JOIN providers p ON pm.provider_id = p.id
        LEFT JOIN models m ON pm.model_id = m.id
        LEFT JOIN model_icons mi ON pm.model_id = mi.model_id
        WHERE p.is_active = TRUE AND pm.is_enabled = TRUE
        ORDER BY p.sort_order ASC, pm.sort_order ASC, pm.id ASC
      `);

      const models = modelsResult as any[];

      // 获取所有模型的标签
      const [tagsResult] = await connection.execute(`
        SELECT model_id, text, color FROM model_tags
      `);
      const tags = tagsResult as any[];

      // 合并数据
      const modelsWithCustomData = models.map((model: any) => {
        const modelTags = tags
          .filter(tag => tag.model_id === model.model_id)
          .map(tag => ({ text: tag.text, color: tag.color }));

        return {
          id: model.model_id,
          name: model.display_name || model.original_name || model.model_id,
          originalName: model.original_name || model.model_id,
          icon: model.icon_path || "/images/modelimg/gpt6.png",
          providerId: model.provider_id,
          providerName: model.provider_name,
          providerEndpoint: model.provider_endpoint,
          providerApiKey: model.provider_api_key,
          tags: modelTags
        };
      });

      return NextResponse.json({
        success: true,
        data: modelsWithCustomData
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取模型列表失败:', error);
    return NextResponse.json({
      success: true,
      message: '获取模型列表失败: ' + error.message,
      data: []
    }, { status: 500 });
  }
}