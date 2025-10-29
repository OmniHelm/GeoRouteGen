/**
 * 数据库查询封装
 *
 * 提供：
 * 1. IP记录查询
 * 2. 地区/ISP列表查询
 * 3. 路由分组管理
 * 4. CIDR文件生成
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { rangeToCIDRs, numberToIP } from './utils/ip';
import { randomUUID } from 'crypto';

// 数据库路径（支持环境变量 DB_PATH，向后兼容）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'georoute.db');

let db: Database.Database | null = null;

/**
 * 获取数据库连接（单例模式）
 */
function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // 启用外键约束
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// ==================== 类型定义 ====================

export interface IPRecord {
  minip: number;
  maxip: number;
  country: string;
  province: string;
  city: string;
  isp: string;
}

export interface Region {
  province: string;
  city: string;
  assignedTo: string | null;  // 分配给哪个分组（null表示未分配）
}

export interface RouteGroup {
  id: string;
  name: string;
  isp: string;
  origin: string;
  created_at: string;
}

export interface GroupWithRegions extends RouteGroup {
  regions: Array<{ province: string; city: string }>;
}

// ==================== IP记录查询 ====================

/**
 * 根据地区+ISP筛选IP段
 * 如果isp为空字符串，则查询所有ISP的记录
 */
export function queryIPsByRegion(
  country: string,
  province: string,
  city: string,
  isp: string
): IPRecord[] {
  if (isp === '') {
    // ISP为空，查询所有ISP
    const stmt = getDB().prepare(`
      SELECT minip, maxip, country, province, city, isp
      FROM ip_records
      WHERE country = ? AND province = ? AND city = ?
    `);
    return stmt.all(country, province, city) as IPRecord[];
  } else {
    // 指定ISP
    const stmt = getDB().prepare(`
      SELECT minip, maxip, country, province, city, isp
      FROM ip_records
      WHERE country = ? AND province = ? AND city = ? AND isp = ?
    `);
    return stmt.all(country, province, city, isp) as IPRecord[];
  }
}

/**
 * 获取可用的地区列表（中国）
 * @param origin 起点位置（如果提供，只查询该起点下的分配状态）
 */
export function getAvailableRegions(origin?: string): Region[] {
  const regions = getDB().prepare(`
    SELECT DISTINCT province, city
    FROM ip_records
    WHERE country = 'China' AND province != ''
    ORDER BY province, city
  `).all() as Array<{ province: string; city: string }>;

  // 查询每个地区的分配状态（按起点过滤）
  const assignments = new Map<string, string>();

  if (origin) {
    // 查询指定起点的分配状态
    const assigned = getDB().prepare(`
      SELECT province, city, group_id
      FROM group_regions
      WHERE origin = ?
    `).all(origin) as Array<{ province: string; city: string; group_id: string }>;

    for (const item of assigned) {
      assignments.set(`${item.province}|${item.city}`, item.group_id);
    }
  } else {
    // 查询所有起点的分配状态（用于兼容性）
    const assigned = getDB().prepare(`
      SELECT province, city, group_id
      FROM group_regions
    `).all() as Array<{ province: string; city: string; group_id: string }>;

    for (const item of assigned) {
      assignments.set(`${item.province}|${item.city}`, item.group_id);
    }
  }

  // 合并结果
  return regions.map(r => ({
    province: r.province,
    city: r.city,
    assignedTo: assignments.get(`${r.province}|${r.city}`) || null
  }));
}

/**
 * 获取可用的ISP列表（中国）
 * 过滤掉无意义的ISP（如"-"、空字符串等）
 */
export function getAvailableISPs(): string[] {
  const result = getDB().prepare(`
    SELECT DISTINCT isp, COUNT(*) as count
    FROM ip_records
    WHERE country = 'China' AND isp != '' AND isp != '-'
    GROUP BY isp
    HAVING count > 100
    ORDER BY count DESC
  `).all() as Array<{ isp: string; count: number }>;

  return result.map(r => r.isp);
}

// ==================== 路由分组管理 ====================

/**
 * 获取所有分组
 */
export function getAllGroups(): GroupWithRegions[] {
  const groups = getDB().prepare(`
    SELECT id, name, isp, origin, created_at
    FROM route_groups
    ORDER BY created_at DESC
  `).all() as RouteGroup[];

  // 查询每个分组的地区
  const getRegions = getDB().prepare(`
    SELECT province, city
    FROM group_regions
    WHERE group_id = ?
    ORDER BY province, city
  `);

  return groups.map(group => ({
    ...group,
    regions: getRegions.all(group.id) as Array<{ province: string; city: string }>
  }));
}

/**
 * 获取单个分组
 */
export function getGroup(id: string): GroupWithRegions | null {
  const group = getDB().prepare(`
    SELECT id, name, isp, origin, created_at
    FROM route_groups
    WHERE id = ?
  `).get(id) as RouteGroup | undefined;

  if (!group) return null;

  const regions = getDB().prepare(`
    SELECT province, city
    FROM group_regions
    WHERE group_id = ?
    ORDER BY province, city
  `).all(id) as Array<{ province: string; city: string }>;

  return { ...group, regions };
}

/**
 * 创建分组
 */
export function createGroup(
  name: string,
  isp: string,
  origin: string,
  regions: Array<{ province: string; city: string }>
): GroupWithRegions {
  const id = randomUUID();

  const transaction = getDB().transaction(() => {
    // 插入分组
    getDB().prepare(`
      INSERT INTO route_groups (id, name, isp, origin)
      VALUES (?, ?, ?, ?)
    `).run(id, name, isp, origin);

    // 插入地区（如果有冲突会报错，确保互斥）
    const insertRegion = getDB().prepare(`
      INSERT INTO group_regions (group_id, origin, province, city)
      VALUES (?, ?, ?, ?)
    `);

    for (const region of regions) {
      insertRegion.run(id, origin, region.province, region.city);
    }
  });

  try {
    transaction();
    return getGroup(id)!;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      throw new Error('选中的地区已被其他分组占用（在该起点下）');
    }
    throw err;
  }
}

/**
 * 更新分组
 * 注意：不能修改 origin（起点位置），只能修改名称、ISP、地区
 */
export function updateGroup(
  id: string,
  name: string,
  isp: string,
  regions: Array<{ province: string; city: string }>
): GroupWithRegions {
  // 先获取原始分组（包含 origin）
  const oldGroup = getGroup(id);
  if (!oldGroup) {
    throw new Error('分组不存在');
  }

  const transaction = getDB().transaction(() => {
    // 更新分组信息（不修改 origin）
    getDB().prepare(`
      UPDATE route_groups
      SET name = ?, isp = ?
      WHERE id = ?
    `).run(name, isp, id);

    // 删除旧地区
    getDB().prepare(`
      DELETE FROM group_regions WHERE group_id = ?
    `).run(id);

    // 插入新地区（使用原始的 origin）
    const insertRegion = getDB().prepare(`
      INSERT INTO group_regions (group_id, origin, province, city)
      VALUES (?, ?, ?, ?)
    `);

    for (const region of regions) {
      insertRegion.run(id, oldGroup.origin, region.province, region.city);
    }
  });

  try {
    transaction();
    return getGroup(id)!;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      throw new Error('选中的地区已被其他分组占用（在该起点下）');
    }
    throw err;
  }
}

/**
 * 删除分组
 */
export function deleteGroup(id: string): void {
  getDB().prepare(`
    DELETE FROM route_groups WHERE id = ?
  `).run(id);
  // group_regions会自动级联删除（ON DELETE CASCADE）
}

// ==================== CIDR文件生成 ====================

/**
 * 生成单个分组的CIDR列表
 */
export function generateCIDRsForGroup(groupId: string): string[] {
  const group = getGroup(groupId);
  if (!group) {
    throw new Error(`分组不存在: ${groupId}`);
  }

  const allCIDRs: string[] = [];

  for (const { province, city } of group.regions) {
    const ipRecords = queryIPsByRegion('China', province, city, group.isp);

    for (const record of ipRecords) {
      const cidrs = rangeToCIDRs(record.minip, record.maxip);
      allCIDRs.push(...cidrs);
    }
  }

  // 去重
  return Array.from(new Set(allCIDRs));
}

/**
 * 生成所有分组的CIDR文件内容
 * @returns Map<文件名, 文件内容>
 */
export function generateAllCIDRFiles(): Map<string, string> {
  const groups = getAllGroups();
  const files = new Map<string, string>();

  for (const group of groups) {
    const cidrs = generateCIDRsForGroup(group.id);
    const content = cidrs.join('\n');
    files.set(`${group.name}.txt`, content);
  }

  return files;
}

/**
 * 获取数据库统计信息
 */
export function getDBStats() {
  const totalRecords = getDB().prepare(`
    SELECT COUNT(*) as count FROM ip_records
  `).get() as { count: number };

  const chinaRecords = getDB().prepare(`
    SELECT COUNT(*) as count FROM ip_records WHERE country = 'China'
  `).get() as { count: number };

  const groupCount = getDB().prepare(`
    SELECT COUNT(*) as count FROM route_groups
  `).get() as { count: number };

  return {
    totalRecords: totalRecords.count,
    chinaRecords: chinaRecords.count,
    groupCount: groupCount.count
  };
}
