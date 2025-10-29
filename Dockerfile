# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

# 安装编译工具（better-sqlite3 需要原生模块编译）
RUN apk add --no-cache python3 make g++

WORKDIR /build

# 只复制依赖文件，利用 Docker 缓存层
COPY package*.json tsconfig.json ./

# 安装所有依赖（包括 devDependencies，需要 TypeScript 编译器）
RUN npm ci

# 复制源码
COPY src ./src

# 编译 TypeScript
RUN npm run build

# ==================== 运行阶段 ====================
FROM node:22-alpine

# 安装运行时依赖（better-sqlite3 需要 C++ 标准库）
RUN apk add --no-cache libstdc++

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 从构建阶段复制编译产物
COPY --from=builder --chown=nodejs:nodejs /build/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build/package.json ./

# 复制静态文件
COPY --chown=nodejs:nodejs public ./public

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 启动服务
CMD ["node", "dist/src/index.js"]
