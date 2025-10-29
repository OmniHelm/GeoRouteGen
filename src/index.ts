/**
 * GeoRouteGen - Simple Express Server
 *
 * Linus: "One file, one server, no bullshit."
 */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as db from './db';

const app = express();
const PORT = process.env.PORT || 3000;

// 管理员密码（可通过环境变量 ADMIN_PASSWORD 设置，默认为 admin123）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 请求日志
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  console.log(`${req.method} ${req.path}`);
  next();
});

// ==================== API Routes ====================

app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getDBStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/isps', (req, res) => {
  try {
    const isps = db.getAvailableISPs();
    res.json(isps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/regions', (req, res) => {
  try {
    const origin = req.query.origin as string | undefined;
    const regions = db.getAvailableRegions(origin);
    res.json(regions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups', (req, res) => {
  try {
    const groups = db.getAllGroups();
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups/:id', (req, res) => {
  try {
    const group = db.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ error: '分组不存在' });
    }
    res.json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', (req, res) => {
  try {
    const { name, isp, origin, regions } = req.body;

    // 验证必填参数
    if (!name || isp === undefined || !origin || !Array.isArray(regions)) {
      return res.status(400).json({ error: '参数无效' });
    }

    // 验证 origin 值
    const validOrigins = ['HKG', 'JPN', 'SIN'];
    if (!validOrigins.includes(origin)) {
      return res.status(400).json({ error: '起点位置无效，必须是 HKG、JPN 或 SIN' });
    }

    const group = db.createGroup(name, isp || '', origin, regions);
    res.status(201).json(group);
  } catch (err: any) {
    if (err.message.includes('占用')) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/groups/:id', (req, res) => {
  try {
    const { name, isp, regions } = req.body;
    // ISP可以为空字符串（表示所有ISP）
    if (!name || isp === undefined || !Array.isArray(regions)) {
      return res.status(400).json({ error: '参数无效' });
    }
    const group = db.updateGroup(req.params.id, name, isp || '', regions);
    res.json(group);
  } catch (err: any) {
    if (err.message.includes('占用')) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/groups/:id', (req, res) => {
  try {
    db.deleteGroup(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/download/:groupId', (req, res) => {
  try {
    const group = db.getGroup(req.params.groupId);
    if (!group) {
      return res.status(404).json({ error: '分组不存在' });
    }
    const cidrs = db.generateCIDRsForGroup(req.params.groupId);
    const content = cidrs.join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${group.name}.txt"`);
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', (req, res) => {
  try {
    const files = db.generateAllCIDRFiles();
    const result: Record<string, string> = {};
    for (const [filename, content] of files.entries()) {
      result[filename] = content;
    }
    res.json({ files: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 获取指定起点的路由结果
 * 返回三大运营商（电信、联通、移动）的路由信息
 */
app.get('/api/route-result/:origin', (req, res) => {
  try {
    const { origin } = req.params;

    // 验证 origin
    const validOrigins = ['HKG', 'JPN', 'SIN'];
    if (!validOrigins.includes(origin)) {
      return res.status(400).json({ error: '起点位置无效，必须是 HKG、JPN 或 SIN' });
    }

    // 查询该起点的所有分组
    const allGroups = db.getAllGroups();
    const groupsForOrigin = allGroups.filter(g => g.origin === origin);

    // 构建省份 -> 分组名称的映射
    // 注意：我们只显示省级分组（city为空）
    interface RouteInfo {
      province: string;
      routeName: string;
      isp: string;
    }

    const routeInfos: RouteInfo[] = [];

    for (const group of groupsForOrigin) {
      // 处理所有地区（省级 + 市级）
      for (const region of group.regions) {
        // 如果是市级数据，显示为"省份 - 城市"；否则只显示省份
        const displayName = region.city
          ? `${region.province} - ${region.city}`
          : region.province;

        routeInfos.push({
          province: displayName,
          routeName: group.name,
          isp: group.isp
        });
      }
    }

    // 按 ISP 分类
    const result = {
      telecom: [] as Array<{ province: string; route_name: string }>,
      unicom: [] as Array<{ province: string; route_name: string }>,
      mobile: [] as Array<{ province: string; route_name: string }>
    };

    for (const info of routeInfos) {
      const isp = info.isp.toLowerCase();
      const item = { province: info.province, route_name: info.routeName };

      if (isp.includes('telecom')) {
        result.telecom.push(item);
      } else if (isp.includes('unicom')) {
        result.unicom.push(item);
      } else if (isp.includes('mobile')) {
        result.mobile.push(item);
      }
      // 其他ISP忽略
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 管理员密码验证
 * 最简单的方式：比对固定密码，返回随机 token
 */
app.post('/api/verify-password', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: '密码不能为空' });
    }

    if (password === ADMIN_PASSWORD) {
      // 生成简单的 token（32 字节随机字符串）
      const token = crypto.randomBytes(32).toString('hex');
      res.json({ token, message: '验证成功' });
    } else {
      res.status(401).json({ error: '密码错误' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Health Check ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== Startup ====================

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'georoute.db');
if (!fs.existsSync(dbPath)) {
  console.error('\n❌ 错误：数据库文件不存在');
  console.error(`   路径: ${dbPath}`);
  console.error('   请先运行: npm run import-db\n');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log('\n====================================');
  console.log('  GeoRouteGen');
  console.log('====================================');
  console.log(`\n🚀 服务器: http://localhost:${PORT}`);

  try {
    const stats = db.getDBStats();
    console.log(`\n📊 数据库:`);
    console.log(`   IP记录: ${stats.totalRecords.toLocaleString()}`);
    console.log(`   分组数: ${stats.groupCount}`);
  } catch (err) {
    console.log(`\n⚠️  无法获取统计信息`);
  }

  console.log('\n====================================\n');
});

process.on('SIGINT', () => {
  console.log('\n正在关闭...');
  db.closeDB();
  process.exit(0);
});
