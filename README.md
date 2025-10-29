# GeoRouteGen - BGP路由生成器

[![Docker Build](https://github.com/OmniHelm/GeoRouteGen/actions/workflows/docker-build.yml/badge.svg)](https://github.com/OmniHelm/GeoRouteGen/actions/workflows/docker-build.yml)
[![GitHub release](https://img.shields.io/github/v/release/OmniHelm/GeoRouteGen)](https://github.com/OmniHelm/GeoRouteGen/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue)](https://github.com/OmniHelm/GeoRouteGen/pkgs/container/georoutegen)

基于地理位置的BGP路由CIDR生成工具。

## 快速开始（Docker）

```bash
# 拉取镜像
docker pull ghcr.io/omnihelm/georoutegen:latest

# 使用 docker-compose 部署
git clone https://github.com/OmniHelm/GeoRouteGen.git
cd GeoRouteGen
cp .env.example .env
nano .env  # 修改 ADMIN_PASSWORD
./setup.sh  # 一键部署
```

访问 http://localhost:3000

## 功能特性

- 从埃文科技IP数据库导入1522万条IP记录
- 创建多个路由分组（CN2、163PP等）
- 按省市级别选择地区，并指定ISP运营商
- 自动将IP范围转换为标准CIDR格式
- 支持地区互斥选择（同一地区只能属于一个分组）
- 生成可直接导入路由器的txt文件

## 技术栈

```
后端：Node.js + Express + TypeScript + SQLite3
前端：原生HTML + CSS + JavaScript
依赖：5个（better-sqlite3, express, 3个类型定义）
```


## 项目结构

```
GeoRouteGen/
├── src/
│   ├── utils/ip.ts              # CIDR转换算法
│   ├── db.ts                    # SQLite查询
│   └── index.ts                 # Express服务器
├── scripts/
│   └── import-ipdb.ts           # 数据导入脚本
├── public/
│   ├── index.html               # 单页面
│   ├── style.css                # 原生CSS
│   └── app.js                   # 原生JS
├── IP_city_single_WGS84_en_mysql/
│   └── IP_city_single_WGS84_en.txt
├── package.json                 # 只有一个！
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

**安装速度：5秒以内**

### 2. 导入IP数据库（仅首次，需要2-5分钟）

```bash
npm run import-db
```

**预期输出：**
```
=======================================
  埃文IP数据库导入工具
=======================================

📁 数据文件：IP_city_single_WGS84_en.txt
📏 文件大小：3.10 GB

🗄️  初始化数据库...
📋 创建数据表...
✓ 数据表创建成功

📥 开始导入数据...
   已导入 5,000,000 行  (速度: 48,000 行/秒)
   已导入 10,000,000 行 (速度: 50,000 行/秒)
   ...

✓ 数据导入完成！
   总计: 15,229,627 条记录
   耗时: 180.5 秒

🔍 创建索引（这可能需要1-2分钟）...
   ✓ 地区索引创建完成
   ✓ IP范围索引创建完成

=======================================
✅ 导入成功！总耗时: 3.2 分钟
=======================================
```

### 3. 启动服务器

```bash
npm run dev
```

**启动时间：<1秒**

### 4. 访问界面

打开浏览器访问：**http://localhost:3000**

---

## 使用流程

### 1. 创建分组

点击「新建分组」→ 输入名称（如"CN2"）→ 选择ISP（China Telecom）→ 选择地区

### 2. 管理分组

- **编辑**：修改分组的名称、ISP或地区
- **删除**：移除分组（地区会自动释放）
- **下载**：下载单个分组的CIDR文件

### 3. 生成路由

点击「生成所有路由文件」→ 自动下载所有分组的txt文件

### 4. 文件格式

生成的文件格式（可直接用于BGP配置）：
```
1.0.0.0/24
1.0.1.0/25
1.0.1.128/26
1.0.2.0/23
...
```

---

## 技术细节

### CIDR转换算法

**问题：** IP数据库存储的是IP范围（minip - maxip），但BGP需要CIDR格式。

**解决方案：**
```typescript
// 输入：1.0.0.5 - 1.0.0.20
// 输出：
// 1.0.0.5/32
// 1.0.0.6/31
// 1.0.0.8/29
// 1.0.0.16/30
// 1.0.0.20/32
```

算法自动找到最大的CIDR块，确保每个块都对齐到CIDR边界。

**测试：**
```bash
npm run test-ip
```

### 互斥选择

**问题：** 同一地区不能同时属于多个分组。

**解决方案：** 数据库PRIMARY KEY约束。

```sql
CREATE TABLE group_regions (
  group_id TEXT,
  province TEXT,
  city TEXT,
  PRIMARY KEY (province, city),  -- 确保互斥
  FOREIGN KEY (group_id) REFERENCES route_groups(id) ON DELETE CASCADE
);
```

数据库级别保证，不是应用层逻辑。

### 性能优化

**索引：**
```sql
-- 按地区+ISP查询（核心查询）
CREATE INDEX idx_region ON ip_records(country, province, city, isp);

-- 按IP范围查询（备用）
CREATE INDEX idx_minip_maxip ON ip_records(minip, maxip);
```

**查询速度：** <10ms

**批量插入：** 使用事务，10000条一批。

**内存占用：** ~50MB运行时内存。

---

## 数据统计

导入后的数据库：
- **总记录数**：1522万条
- **中国记录**：约40万条
- **中国电信**：约7万条
- **数据库大小**：~800MB

---

## Docker 部署（推荐）

### 方式 A：使用安装脚本（推荐）

最简单的部署方式，一键完成所有配置：

```bash
chmod +x setup.sh
./setup.sh
```

脚本会自动完成：
1. 创建数据目录 `/var/lib/georoutegen`
2. 复制数据库文件（或提示你手动准备）
3. 创建环境变量配置文件 `.env`
4. 构建 Docker 镜像
5. 启动服务

### 方式 B：手动部署

如果你想更精细地控制部署过程：

#### 1. 准备数据库文件

```bash
# 创建数据目录
sudo mkdir -p /var/lib/georoutegen

# 复制数据库文件
sudo cp georoute.db /var/lib/georoutegen/

# 或者，如果你还没有数据库，先导入：
npm run import-db
sudo cp georoute.db /var/lib/georoutegen/
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（务必修改管理员密码！）
nano .env
```

`.env` 文件内容：
```bash
PORT=3000
ADMIN_PASSWORD=your_secure_password_here  # 修改这里！
DB_PATH=/app/data/georoute.db
NODE_ENV=production
```

#### 3. 构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务（后台运行）
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 访问服务

打开浏览器访问：**http://localhost:3000**

- 公开页面：路由结果查看（无需登录）
- 管理员入口：需要输入密码（`.env` 中配置的 `ADMIN_PASSWORD`）

### 常用管理命令

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新代码后重新构建
docker-compose up -d --build

# 进入容器调试
docker-compose exec georoutegen sh
```

### 数据备份

数据库文件位置：`/var/lib/georoutegen/georoute.db`

```bash
# 备份
sudo cp /var/lib/georoutegen/georoute.db ~/georoute-backup-$(date +%Y%m%d).db

# 恢复
sudo cp ~/georoute-backup-20250129.db /var/lib/georoutegen/georoute.db
docker-compose restart
```

### 配置说明

#### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin123` |
| `DB_PATH` | 数据库路径 | `/app/data/georoute.db` |
| `NODE_ENV` | Node 环境 | `production` |

#### 资源限制

默认配置（可在 `docker-compose.yml` 中调整）：

- CPU 限制：2 核
- 内存限制：1GB
- CPU 预留：0.5 核
- 内存预留：512MB

#### 安全性

- ✅ 非 root 用户运行（nodejs:1001）
- ✅ 环境变量管理敏感信息
- ✅ 健康检查自动重启
- ✅ 资源限制防止滥用

### 故障排除

**问题：容器启动失败**
```bash
# 检查日志
docker-compose logs

# 常见原因：
# 1. 数据库文件不存在 → 检查 /var/lib/georoutegen/georoute.db
# 2. 端口被占用 → 修改 .env 中的 PORT
```

**问题：无法访问管理页面**
```bash
# 1. 检查密码是否正确（.env 中的 ADMIN_PASSWORD）
# 2. 清除浏览器缓存和 localStorage
# 3. 检查容器状态：docker-compose ps
```

**问题：健康检查失败**
```bash
# 检查健康状态
docker-compose ps

# 查看详细健康检查日志
docker inspect georoutegen | grep -A 10 Health
```

---

## 手动部署（不使用 Docker）

如果你不想使用 Docker，也可以手动部署：

### 1. 编译 TypeScript

```bash
npm run build
```

生成 `dist/` 目录。

### 2. 启动

```bash
npm start
```

### 3. 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name georoutegen

# 开机自启
pm2 startup
pm2 save
```

---

## 常见问题

### Q: 能否支持IPv6？

A: 当前版本只支持IPv4。IPv6需要修改CIDR算法（从32位扩展到128位）。

### Q: 如何更新IP库？

A: 删除 `georoute.db`，用新的TSV文件重新运行 `npm run import-db`。




