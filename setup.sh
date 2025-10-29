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

# 自动检测部署模式
if [ -f "$DB_FILE" ]; then
    DEPLOYMENT_MODE="update"
    echo -e "${GREEN}检测到现有部署，进入更新模式${NC}"
else
    DEPLOYMENT_MODE="install"
    echo "首次安装模式"
fi

echo ""

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

        # 将当前用户添加到 docker 组
        echo ""
        echo "正在将当前用户添加到 docker 组..."
        sudo usermod -aG docker $USER

        echo ""
        echo "===================================="
        echo -e "${YELLOW}⚠️  需要重新登录以生效权限${NC}"
        echo "===================================="
        echo ""
        echo "Docker 用户组权限需要重新登录才能生效。"
        echo ""
        echo "请执行以下操作之一："
        echo "  1. 退出当前 SSH 会话，重新登录"
        echo "  2. 运行: su - $USER"
        echo "  3. 运行: newgrp docker (然后重新执行本脚本)"
        echo ""
        echo "然后重新运行: ./setup.sh"
        echo ""
        exit 0
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

# 更新模式下跳过数据库准备
if [ "$DEPLOYMENT_MODE" == "update" ]; then
    echo -e "${GREEN}✓ 更新模式，跳过数据库准备${NC}"
    echo "   数据库路径: $DB_FILE"
elif [ -f "$DB_FILE" ]; then
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
                # 原子性复制：先复制到临时文件
                if sudo cp georoute.db "$DB_FILE.tmp"; then
                    # 验证文件大小（至少 100MB）
                    FILE_SIZE=$(sudo stat -c%s "$DB_FILE.tmp" 2>/dev/null || sudo stat -f%z "$DB_FILE.tmp" 2>/dev/null)
                    if [ "$FILE_SIZE" -lt 100000000 ]; then
                        echo -e "${RED}✗ 数据库文件太小，可能复制失败${NC}"
                        sudo rm -f "$DB_FILE.tmp"
                        exit 1
                    fi
                    # 原子性移动到最终位置
                    if sudo mv "$DB_FILE.tmp" "$DB_FILE"; then
                        echo -e "${GREEN}✓ 数据库文件复制成功${NC}"
                    else
                        echo -e "${RED}✗ 移动文件失败${NC}"
                        sudo rm -f "$DB_FILE.tmp"
                        exit 1
                    fi
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
                # 原子性复制：先复制到临时文件
                if sudo cp "$custom_db_path" "$DB_FILE.tmp"; then
                    # 验证文件大小（至少 100MB）
                    FILE_SIZE=$(sudo stat -c%s "$DB_FILE.tmp" 2>/dev/null || sudo stat -f%z "$DB_FILE.tmp" 2>/dev/null)
                    if [ "$FILE_SIZE" -lt 100000000 ]; then
                        echo -e "${RED}✗ 数据库文件太小，可能复制失败${NC}"
                        sudo rm -f "$DB_FILE.tmp"
                        exit 1
                    fi
                    # 原子性移动到最终位置
                    if sudo mv "$DB_FILE.tmp" "$DB_FILE"; then
                        echo -e "${GREEN}✓ 数据库文件复制成功${NC}"
                    else
                        echo -e "${RED}✗ 移动文件失败${NC}"
                        sudo rm -f "$DB_FILE.tmp"
                        exit 1
                    fi
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

# 强制检查默认密码
if [ -f ".env" ]; then
    CURRENT_PASSWORD=$(grep "^ADMIN_PASSWORD=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ "$CURRENT_PASSWORD" == "admin123" ] || [ -z "$CURRENT_PASSWORD" ]; then
        echo ""
        echo "=========================================="
        echo -e "${RED}❌ 安全错误：不允许使用默认密码！${NC}"
        echo "=========================================="
        echo ""
        echo "检测到 .env 文件中使用了默认密码或密码为空。"
        echo "出于安全考虑，必须修改密码后才能继续部署。"
        echo ""
        echo "请编辑 .env 文件，修改 ADMIN_PASSWORD 的值："
        echo "  ${EDITOR:-nano} .env"
        echo ""
        echo "建议使用强密码："
        echo "  - 至少 12 位字符"
        echo "  - 包含大小写字母、数字和特殊字符"
        echo ""
        echo "修改完成后，重新运行本脚本。"
        echo ""
        exit 1
    fi
    echo -e "${GREEN}✓ 密码安全检查通过${NC}"
fi

echo ""

# =============================================================================
# 步骤 4: 构建并启动服务
# =============================================================================

echo "🚀 步骤 4/4: 构建并启动服务"
echo "-----------------------------------"

# 检测并停止已运行的容器
if docker ps -a --format '{{.Names}}' | grep -q '^georoutegen$'; then
    echo -e "${YELLOW}检测到已存在的容器，正在停止并移除...${NC}"
    if $DOCKER_COMPOSE_CMD down; then
        echo -e "${GREEN}✓ 旧容器已停止${NC}"
    else
        echo -e "${RED}✗ 停止容器失败${NC}"
        exit 1
    fi
    echo ""
fi

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
