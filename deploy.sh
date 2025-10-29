#!/bin/bash

# =============================================================================
# GeoRouteGen - 一键部署脚本（使用预构建镜像）
#
# 用途：从 GitHub Container Registry 拉取镜像并快速部署
# 适用场景：生产环境快速部署，无需从源码构建
# =============================================================================

set -e

echo ""
echo "===================================="
echo "  GeoRouteGen - 一键部署向导"
echo "===================================="
echo ""
echo "本脚本将帮您："
echo "  1. 检查系统依赖"
echo "  2. 拉取 Docker 镜像"
echo "  3. 配置环境变量"
echo "  4. 启动服务"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
DOCKER_IMAGE="ghcr.io/omnihelm/georoutegen:latest"
DATA_DIR="/var/lib/georoutegen"
DB_FILE="$DATA_DIR/georoute.db"
INSTALL_DIR="$HOME/.georoutegen"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"

# =============================================================================
# 步骤 1: 检查系统依赖
# =============================================================================

echo "📋 步骤 1/5: 检查系统依赖"
echo "-----------------------------------"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker 未安装${NC}"
    echo ""
    echo "请先安装 Docker:"
    echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
    echo "  或访问: https://docs.docker.com/get-docker/"
    exit 1
else
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    echo -e "${GREEN}✓ Docker 已安装 (版本: $DOCKER_VERSION)${NC}"
fi

# 检查 docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠ docker-compose 未安装，尝试使用 docker compose${NC}"
    COMPOSE_CMD="docker compose"
else
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f4 | cut -d ',' -f1)
    else
        COMPOSE_CMD="docker compose"
        COMPOSE_VERSION=$(docker compose version --short)
    fi
    echo -e "${GREEN}✓ docker-compose 已安装 (版本: $COMPOSE_VERSION)${NC}"
fi

# 检查 Docker 是否运行
if ! docker ps &> /dev/null; then
    echo -e "${RED}✗ Docker 服务未运行${NC}"
    echo "请启动 Docker 服务: sudo systemctl start docker"
    exit 1
else
    echo -e "${GREEN}✓ Docker 服务运行中${NC}"
fi

echo ""

# =============================================================================
# 步骤 2: 拉取 Docker 镜像
# =============================================================================

echo "🐳 步骤 2/5: 拉取 Docker 镜像"
echo "-----------------------------------"
echo "镜像地址: $DOCKER_IMAGE"
echo ""

if docker pull $DOCKER_IMAGE; then
    echo -e "${GREEN}✓ 镜像拉取成功${NC}"
else
    echo -e "${RED}✗ 镜像拉取失败${NC}"
    echo ""
    echo "可能的原因:"
    echo "  1. 网络连接问题"
    echo "  2. 镜像不存在或尚未发布"
    echo ""
    echo "请访问查看镜像是否可用:"
    echo "  https://github.com/OmniHelm/GeoRouteGen/pkgs/container/georoutegen"
    exit 1
fi

echo ""

# =============================================================================
# 步骤 3: 准备数据库文件
# =============================================================================

echo "💾 步骤 3/5: 准备数据库文件"
echo "-----------------------------------"

# 创建数据目录
if [ ! -d "$DATA_DIR" ]; then
    echo "正在创建数据目录: $DATA_DIR"
    if sudo mkdir -p "$DATA_DIR"; then
        echo -e "${GREEN}✓ 数据目录创建成功${NC}"
    else
        echo -e "${RED}✗ 创建数据目录失败（可能需要 sudo 权限）${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ 数据目录已存在${NC}"
fi

# 检查数据库文件
if [ -f "$DB_FILE" ]; then
    echo -e "${GREEN}✓ 数据库文件已存在，跳过准备步骤${NC}"
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    echo "   文件大小: $DB_SIZE"
else
    echo -e "${YELLOW}⚠ 数据库文件不存在${NC}"
    echo ""
    echo "GeoRouteGen 需要 IP 地理位置数据库才能运行。"
    echo ""
    echo "您有以下选择："
    echo "  1) 我已有 georoute.db 文件，从其他位置复制"
    echo "  2) 跳过（稍后手动准备）"
    echo ""
    read -p "请选择 (1/2): " db_choice

    case $db_choice in
        1)
            read -p "请输入 georoute.db 文件的完整路径: " db_path
            if [ -f "$db_path" ]; then
                echo "正在复制数据库文件..."
                if sudo cp "$db_path" "$DB_FILE"; then
                    echo -e "${GREEN}✓ 数据库文件复制成功${NC}"
                else
                    echo -e "${RED}✗ 复制失败${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}✗ 文件不存在: $db_path${NC}"
                exit 1
            fi
            ;;
        2)
            echo -e "${YELLOW}⚠ 跳过数据库准备${NC}"
            echo ""
            echo "重要提示："
            echo "  在启动服务前，请将 georoute.db 文件复制到："
            echo "  $DB_FILE"
            echo ""
            echo "  否则服务将无法启动。"
            echo ""
            read -p "按回车继续..."
            ;;
        *)
            echo -e "${RED}✗ 无效选择${NC}"
            exit 1
            ;;
    esac
fi

echo ""

# =============================================================================
# 步骤 4: 配置环境变量
# =============================================================================

echo "⚙️  步骤 4/5: 配置环境变量"
echo "-----------------------------------"

# 创建安装目录
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    echo -e "${GREEN}✓ 配置目录创建: $INSTALL_DIR${NC}"
fi

# 读取管理员密码
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠ 配置文件已存在${NC}"
    echo ""
    read -p "是否覆盖现有配置？(y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "保留现有配置"
    else
        rm -f "$ENV_FILE"
    fi
fi

if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo -e "${BLUE}请设置管理员密码（用于访问管理面板）：${NC}"
    read -p "管理员密码: " admin_password

    if [ -z "$admin_password" ]; then
        echo -e "${YELLOW}⚠ 密码为空，使用默认密码: admin123${NC}"
        admin_password="admin123"
    fi

    # 读取端口
    echo ""
    read -p "服务端口 (默认 3000): " port
    port=${port:-3000}

    # 创建 .env 文件
    cat > "$ENV_FILE" <<EOF
# GeoRouteGen 配置文件
# 生成时间: $(date)

# 服务端口
PORT=$port

# 管理员密码（请务必修改！）
ADMIN_PASSWORD=$admin_password

# 数据库路径
DB_PATH=/app/data/georoute.db

# Node 环境
NODE_ENV=production
EOF

    echo -e "${GREEN}✓ 配置文件创建成功${NC}"
    echo "   配置文件位置: $ENV_FILE"
else
    echo -e "${GREEN}✓ 使用现有配置文件${NC}"
fi

echo ""

# =============================================================================
# 步骤 5: 创建 docker-compose 配置
# =============================================================================

echo "📝 步骤 5/5: 创建 docker-compose 配置"
echo "-----------------------------------"

# 读取端口（从 .env 文件或默认值）
if [ -f "$ENV_FILE" ]; then
    PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d '=' -f2)
    PORT=${PORT:-3000}
else
    PORT=3000
fi

# 创建 docker-compose.yml
cat > "$COMPOSE_FILE" <<EOF
version: '3.8'

services:
  georoutegen:
    image: $DOCKER_IMAGE
    container_name: georoutegen
    restart: unless-stopped

    ports:
      - "\${PORT:-3000}:3000"

    environment:
      - PORT=3000
      - ADMIN_PASSWORD=\${ADMIN_PASSWORD:-admin123}
      - DB_PATH=/app/data/georoute.db
      - NODE_ENV=production

    volumes:
      - $DATA_DIR:/app/data

    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
EOF

echo -e "${GREEN}✓ docker-compose 配置创建成功${NC}"
echo "   配置文件位置: $COMPOSE_FILE"

echo ""

# =============================================================================
# 启动服务
# =============================================================================

echo "🚀 启动服务"
echo "-----------------------------------"

cd "$INSTALL_DIR"

if $COMPOSE_CMD up -d; then
    echo -e "${GREEN}✓ 服务启动成功${NC}"
else
    echo -e "${RED}✗ 服务启动失败${NC}"
    echo ""
    echo "请检查日志："
    echo "  cd $INSTALL_DIR && $COMPOSE_CMD logs"
    exit 1
fi

echo ""

# 等待服务启动
echo "等待服务就绪..."
sleep 3

# 检查健康状态
if docker ps | grep georoutegen | grep -q "healthy\|starting"; then
    echo -e "${GREEN}✓ 容器运行中${NC}"
else
    echo -e "${YELLOW}⚠ 容器状态异常，请检查日志${NC}"
fi

echo ""

# =============================================================================
# 完成
# =============================================================================

echo ""
echo "===================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "===================================="
echo ""
echo "📊 服务信息："
echo "   - 访问地址: http://localhost:$PORT"
echo "   - 公开页面: http://localhost:$PORT (路由结果查看)"
echo "   - 管理入口: http://localhost:$PORT (点击右上角管理员入口)"
echo "   - 管理密码: $admin_password"
echo ""
echo "📁 文件位置："
echo "   - 配置目录: $INSTALL_DIR"
echo "   - 数据目录: $DATA_DIR"
echo "   - 配置文件: $ENV_FILE"
echo ""
echo "📝 常用命令："
echo "   - 查看日志: cd $INSTALL_DIR && $COMPOSE_CMD logs -f"
echo "   - 查看状态: cd $INSTALL_DIR && $COMPOSE_CMD ps"
echo "   - 重启服务: cd $INSTALL_DIR && $COMPOSE_CMD restart"
echo "   - 停止服务: cd $INSTALL_DIR && $COMPOSE_CMD down"
echo "   - 更新镜像: docker pull $DOCKER_IMAGE && cd $INSTALL_DIR && $COMPOSE_CMD up -d"
echo ""
echo "⚠️  安全提示："
echo "   1. 请确保已修改管理员密码（当前: $admin_password）"
echo "   2. 如需修改密码，编辑: $ENV_FILE"
echo "   3. 修改后重启服务: cd $INSTALL_DIR && $COMPOSE_CMD restart"
echo ""
echo "🔗 项目地址："
echo "   https://github.com/OmniHelm/GeoRouteGen"
echo ""
