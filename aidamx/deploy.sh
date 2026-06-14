#!/bin/bash

#================================================================
# aidamx项目部署脚本 - 适用于宝塔面板环境
# 使用说明: 
# 1. 将此脚本放在项目根目录
# 2. 给予执行权限: chmod +x deploy.sh
# 3. 运行脚本: ./deploy.sh
#================================================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # 无颜色

# 日志函数
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
PROJECT_NAME="aidamx"
PROJECT_DIR=$(pwd)
NODE_VERSION="18"  # 或者使用项目要求的Node.js版本
PM2_NAME="aidamx"
PORT="6677"        # 项目配置的端口

# 确认是否在正确的目录
if [ ! -f "package.json" ]; then
  log_error "当前目录不是有效的项目目录，未找到package.json文件"
  exit 1
fi

# 检查项目名称是否匹配
PROJECT_NAME_IN_PACKAGE=$(grep -o '"name": *"[^"]*' package.json | grep -o '[^"]*$')
if [ "$PROJECT_NAME_IN_PACKAGE" != "$PROJECT_NAME" ]; then
  log_warn "package.json中的项目名与配置不匹配，将使用package.json中的名称"
  PROJECT_NAME=$PROJECT_NAME_IN_PACKAGE
fi

# 检查Node.js环境
log_info "检查Node.js环境..."
if ! command -v node &> /dev/null; then
  log_error "未安装Node.js，请在宝塔面板中安装Node.js"
  exit 1
fi

NODE_CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_CURRENT_VERSION" -lt "$NODE_VERSION" ]; then
  log_warn "当前Node.js版本较低，建议使用v${NODE_VERSION}或更高版本"
fi

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
  log_info "正在安装PM2..."
  npm install -g pm2
  if [ $? -ne 0 ]; then
    log_error "PM2安装失败，请手动安装"
    exit 1
  fi
fi

# 检查环境变量
log_info "检查环境变量配置..."
if ! grep -q "ADMIN_JWT_SECRET" .env; then
  log_warn "ADMIN_JWT_SECRET环境变量可能未设置，这将导致管理员认证失败"
  log_warn "请确保在.env文件中正确设置此变量"
fi

if ! grep -q "ADMIN_CODE" .env; then
  log_warn "ADMIN_CODE环境变量可能未设置，这将导致管理员无法登录"
  log_warn "请确保在.env文件中正确设置此变量"
fi

# 拉取最新代码（如果是Git仓库）
if [ -d ".git" ]; then
  log_info "拉取最新代码..."
  git pull
  if [ $? -ne 0 ]; then
    log_error "Git拉取失败，请检查您的Git配置"
    exit 1
  fi
else
  log_warn "当前不是Git仓库，跳过代码拉取步骤"
fi

# 安装/更新依赖
log_info "安装/更新项目依赖..."
npm install
if [ $? -ne 0 ]; then
  log_error "依赖安装失败，请检查您的npm配置和网络连接"
  exit 1
fi

# 构建项目
log_info "构建项目..."
npm run build
if [ $? -ne 0 ]; then
  log_error "项目构建失败，请检查构建日志"
  exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
  log_warn "未找到.env文件，将创建示例.env文件"
  cat > .env << EOL
# 数据库配置
DB_HOST=rm-bp1818280030xj03rao.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=lingmengai
DB_PASSWORD=VessQpPGpcz6a8xE
DB_NAME=lingmengai

# JWT配置
JWT_SECRET=Ku8pL5QwV2dX7fB9sJ3hR1mY6cN4gT0zE9bA3oF5iG7nZ2xP8sK1jL4qM3vO6
ADMIN_JWT_SECRET=A9fP2dQ7mT5wV3jR8xZ6sL4nB1gN0hY5cK2eX8bF3iU4vM7oG9pE6aS3qJ1
ADMIN_CODE=SdR7qW9tY2xP5mK8fB3vN6lG4jZ1oA0cH5eI2bX3sU7pL9dM4

# 邮箱配置
EMAIL_USER=362856178@qq.com
EMAIL_AUTH_CODE=rawuxzvdynwcbhec

# 设置Next.js应用端口
PORT=6677

# 其他环境变量
NEXT_PUBLIC_API_URL=http://localhost:6677/api
EOL
  log_warn "请编辑.env文件并设置正确的环境变量"
else
  log_info "发现.env文件，将使用现有配置"
fi

# 数据库初始化提示
ADMIN_CODE_VALUE=$(grep "ADMIN_CODE" .env | cut -d'=' -f2)
SERVER_IP=$(curl -s ifconfig.me)
log_info "====================================="
log_info "数据库操作指南:"
log_info "如需初始化数据库，请访问: http://${SERVER_IP}:${PORT}/api/admin/database/init?code=${ADMIN_CODE_VALUE}"
log_info "如需重置数据库，请访问: http://${SERVER_IP}:${PORT}/api/admin/database/reset?code=${ADMIN_CODE_VALUE}"
log_info "如需查看数据库状态，请访问: http://${SERVER_IP}:${PORT}/api/admin/database/status?code=${ADMIN_CODE_VALUE}"
log_info "====================================="

# 使用PM2启动或重启应用
log_info "使用PM2部署应用..."
if pm2 list | grep -q "$PM2_NAME"; then
  log_info "重启已存在的PM2进程..."
  pm2 restart $PM2_NAME
else
  log_info "创建新的PM2进程..."
  # 使用--env production确保加载.env文件
  pm2 start npm --name "$PM2_NAME" -- start -- --env production
fi

if [ $? -ne 0 ]; then
  log_error "PM2部署失败，请检查PM2日志"
  exit 1
fi

# 保存PM2配置，确保服务器重启后自动启动
log_info "保存PM2配置..."
pm2 save

# Nginx配置提示
log_info "====================================="
log_info "Nginx配置建议:"
log_info "如果使用Nginx反向代理，请确保正确配置Cookie传递:"
log_info "location / {"
log_info "  proxy_pass http://localhost:${PORT};"
log_info "  proxy_http_version 1.1;"
log_info "  proxy_set_header Upgrade \$http_upgrade;"
log_info "  proxy_set_header Connection 'upgrade';"
log_info "  proxy_set_header Host \$host;"
log_info "  proxy_set_header X-Real-IP \$remote_addr;"
log_info "  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
log_info "  proxy_set_header X-Forwarded-Proto \$scheme;"
log_info "  proxy_set_header Cookie \$http_cookie;"
log_info "}"
log_info "====================================="

# 显示部署成功信息
log_info "====================================="
log_info "🚀 $PROJECT_NAME 部署成功！"
log_info "🌐 应用运行在端口: $PORT"
log_info "📊 可通过 pm2 monit 查看应用状态"
log_info "📝 可通过 pm2 logs $PM2_NAME 查看日志"
log_info "🔧 如遇认证问题，请检查:"
log_info "   1. Cookie设置是否正确"
log_info "   2. JWT密钥配置是否正确"
log_info "   3. 管理员账户是否存在"
log_info "====================================="

exit 0 