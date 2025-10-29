/**
 * 调试下载问题
 */

import * as db from '../src/db';

const groupId = '4585d0c3-005c-45e2-b409-5005e2cd2466';

console.log('=== 调试下载问题 ===\n');

// 1. 获取分组信息
const group = db.getGroup(groupId);
if (!group) {
  console.log('❌ 分组不存在');
  process.exit(1);
}

console.log('1. 分组信息:');
console.log(`   名称: ${group.name}`);
console.log(`   ISP: "${group.isp}"`);
console.log(`   地区数量: ${group.regions.length}`);
console.log(`   部分地区: ${group.regions.slice(0, 3).map(r => `${r.province}-${r.city}`).join(', ')}`);
console.log('');

// 2. 测试单个地区的IP查询
const testRegion = group.regions[7]; // Hefei City
console.log(`2. 测试地区: ${testRegion.province} - ${testRegion.city}`);
console.log(`   查询条件: country='China', province='${testRegion.province}', city='${testRegion.city}', isp='${group.isp}'`);

const ipRecords = db.queryIPsByRegion('China', testRegion.province, testRegion.city, group.isp);
console.log(`   查询结果: ${ipRecords.length} 条IP记录`);
console.log('');

// 3. 如果没有记录，查看该地区有哪些ISP
if (ipRecords.length === 0) {
  console.log('3. 该地区可用的ISP:');
  const Database = require('better-sqlite3');
  const dbInstance = new Database('./georoute.db');

  const availableISPs = dbInstance.prepare(`
    SELECT DISTINCT isp, COUNT(*) as count
    FROM ip_records
    WHERE country = 'China' AND province = ? AND city = ?
    GROUP BY isp
    LIMIT 10
  `).all(testRegion.province, testRegion.city);

  for (const item of availableISPs) {
    console.log(`   - "${item.isp}": ${item.count} 条记录`);
  }
  console.log('');
  dbInstance.close();
}

// 4. 生成CIDR
console.log('4. 生成CIDR:');
try {
  const cidrs = db.generateCIDRsForGroup(groupId);
  console.log(`   生成的CIDR数量: ${cidrs.length}`);
  if (cidrs.length > 0) {
    console.log(`   前5个CIDR: ${cidrs.slice(0, 5).join(', ')}`);
  }
} catch (err: any) {
  console.log(`   ❌ 生成失败: ${err.message}`);
}

db.closeDB();
