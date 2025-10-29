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
if docker-compose build; then
    echo -e "${GREEN}✓ 镜像构建成功${NC}"
else
    echo -e "${RED}✗ 镜像构建失败${NC}"
    exit 1
fi

echo ""
echo "正在启动服务..."
if docker-compose up -d; then
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
echo "   - 查看日志: docker-compose logs -f"
echo "   - 查看状态: docker-compose ps"
echo "   - 重启服务: docker-compose restart"
echo "   - 停止服务: docker-compose down"
echo ""
echo "⚠️  安全提示："
echo "   请确保已修改 .env 文件中的 ADMIN_PASSWORD！"
echo ""
