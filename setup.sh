#!/bin/bash

# =============================================================================
# GeoRouteGen - Docker 首次部署脚本
# =============================================================================

set -e  # 遇到错误立即退出

echo ""
echo "===================================="
echo "  GeoRouteGen - Docker 部署向导"
echo "===================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 数据目录路径
DATA_DIR="/var/lib/georoutegen"
DB_FILE="$DATA_DIR/georoute.db"

# =============================================================================
# 步骤 0: 检查并安装 Docker
# =============================================================================

echo "🐳 步骤 0/4: 检查 Docker 环境"
echo "-----------------------------------"

# 检查 Docker 是否已安装
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker 已安装${NC}"
    docker --version
else
    echo -e "${YELLOW}⚠ Docker 未安装，开始自动安装...${NC}"
    echo ""

    # 检测操作系统类型
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo -e "${RED}✗ 无法检测操作系统类型${NC}"
        echo "请手动安装 Docker: https://docs.docker.com/engine/install/"
        exit 1
    fi

    echo "检测到系统: $OS"
    echo ""

    case $OS in
        ubuntu|debian)
            echo "使用 apt 安装 Docker..."

            # 更新包索引
            sudo apt-get update

            # 安装依赖
            sudo apt-get install -y \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            # 添加 Docker 官方 GPG key
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

            # 设置仓库
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
              $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            # 安装 Docker
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;

        centos|rhel|fedora)
            echo "使用 yum/dnf 安装 Docker..."

            # 安装依赖
            sudo yum install -y yum-utils

            # 添加 Docker 仓库
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

            # 安装 Docker
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

            # 启动 Docker
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;

        *)
            echo -e "${RED}✗ 不支持的操作系统: $OS${NC}"
            echo ""
            echo "请手动安装 Docker，参考官方文档:"
            echo "  https://docs.docker.com/engine/install/"
            echo ""
            echo "安装完成后，重新运行本脚本。"
            exit 1
            ;;
    esac

    # 验证安装
    if command -v docker &> /dev/null; then
        echo ""
        echo -e "${GREEN}✓ Docker 安装成功${NC}"
        docker --version

        # 将当前用户添加到 docker 组（可选，避免每次使用 sudo）
        echo ""
        echo -e "${YELLOW}提示: 将当前用户添加到 docker 组...${NC}"
        sudo usermod -aG docker $USER
        echo "  完成后需要重新登录才能生效"
        echo "  或者使用 'newgrp docker' 立即生效"
    else
        echo -e "${RED}✗ Docker 安装失败${NC}"
        exit 1
    fi
fi

# 检查 docker-compose 是否可用
echo ""
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓ docker compose 可用 (内置插件)${NC}"
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ docker-compose 可用 (独立命令)${NC}"
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}✗ docker compose 不可用${NC}"
    echo "请安装 docker-compose 或 docker compose 插件"
    exit 1
fi

echo ""

# =============================================================================
# 步骤 1: 检查并创建数据目录
# =============================================================================

echo "📁 步骤 1/4: 检查数据目录"
echo "-----------------------------------"

if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}数据目录不存在，正在创建...${NC}"
    if sudo mkdir -p "$DATA_DIR"; then
        echo -e "${GREEN}✓ 数据目录创建成功: $DATA_DIR${NC}"
    else
        echo -e "${RED}✗ 创建数据目录失败，请检查权限${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ 数据目录已存在: $DATA_DIR${NC}"
fi

echo ""

# =============================================================================
# 步骤 2: 准备数据库文件
# =============================================================================

echo "💾 步骤 2/4: 准备数据库文件"
echo "-----------------------------------"

if [ -f "$DB_FILE" ]; then
    echo -e "${GREEN}✓ 数据库文件已存在，跳过复制${NC}"
    echo "   路径: $DB_FILE"
else
    echo -e "${YELLOW}⚠ 数据库文件不存在${NC}"
    echo ""
    echo "请选择数据库准备方式："
    echo "  1) 从项目根目录复制 georoute.db"
    echo "  2) 从其他位置复制数据库"
    echo "  3) 跳过（稍后手动复制）"
    echo ""
    read -p "请选择 (1/2/3): " db_choice

    case $db_choice in
        1)
            if [ -f "georoute.db" ]; then
                echo "正在复制数据库文件..."
                if sudo cp georoute.db "$DB_FILE"; then
                    echo -e "${GREEN}✓ 数据库文件复制成功${NC}"
                else
                    echo -e "${RED}✗ 复制失败${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}✗ 项目根目录未找到 georoute.db${NC}"
                echo "   请先运行: npm run import-db"
                exit 1
            fi
            ;;
        2)
            read -p "请输入数据库文件路径: " custom_db_path
            if [ -f "$custom_db_path" ]; then
                echo "正在复制数据库文件..."
                if sudo cp "$custom_db_path" "$DB_FILE"; then
                    echo -e "${GREEN}✓ 数据库文件复制成功${NC}"
                else
                    echo -e "${RED}✗ 复制失败${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}✗ 文件不存在: $custom_db_path${NC}"
                exit 1
            fi
            ;;
        3)
            echo -e "${YELLOW}⚠ 跳过数据库复制${NC}"
            echo "   请在启动前手动将数据库文件复制到:"
            echo "   $DB_FILE"
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
# 步骤 3: 配置环境变量
# =============================================================================

echo "⚙️  步骤 3/4: 配置环境变量"
echo "-----------------------------------"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "正在创建 .env 文件..."
        cp .env.example .env
        echo -e "${GREEN}✓ .env 文件创建成功${NC}"
        echo -e "${YELLOW}⚠ 重要: 请修改 .env 文件中的 ADMIN_PASSWORD${NC}"
        echo ""
        read -p "是否现在编辑 .env 文件? (y/N): " edit_env
        if [[ $edit_env == "y" || $edit_env == "Y" ]]; then
            ${EDITOR:-nano} .env
        else
            echo "   稍后请手动编辑: .env"
        fi
    else
        echo -e "${RED}✗ 未找到 .env.example 文件${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env 文件已存在${NC}"
fi

echo ""

# =============================================================================
# 步骤 4: 构建并启动服务
# =============================================================================

echo "🚀 步骤 4/4: 构建并启动服务"
echo "-----------------------------------"

echo "正在构建 Docker 镜像..."
if $DOCKER_COMPOSE_CMD build; then
    echo -e "${GREEN}✓ 镜像构建成功${NC}"
else
    echo -e "${RED}✗ 镜像构建失败${NC}"
    exit 1
fi

echo ""
echo "正在启动服务..."
if $DOCKER_COMPOSE_CMD up -d; then
    echo -e "${GREEN}✓ 服务启动成功${NC}"
else
    echo -e "${RED}✗ 服务启动失败${NC}"
    exit 1
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
echo "   - 访问地址: http://localhost:3000"
echo "   - 数据目录: $DATA_DIR"
echo "   - 配置文件: .env"
echo ""
echo "📝 常用命令："
echo "   - 查看日志: $DOCKER_COMPOSE_CMD logs -f"
echo "   - 查看状态: $DOCKER_COMPOSE_CMD ps"
echo "   - 重启服务: $DOCKER_COMPOSE_CMD restart"
echo "   - 停止服务: $DOCKER_COMPOSE_CMD down"
echo ""
echo "⚠️  安全提示："
echo "   请确保已修改 .env 文件中的 ADMIN_PASSWORD！"
echo ""
