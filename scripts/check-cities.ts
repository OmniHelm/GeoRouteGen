/**
 * 检查城市名称模式
 */

import Database from 'better-sqlite3';

const db = new Database('./georoute.db');

const cities = db.prepare(`
  SELECT DISTINCT city
  FROM ip_records
  WHERE country = 'China' AND province = 'Anhui'
  ORDER BY city
  LIMIT 50
`).all() as Array<{ city: string }>;

console.log('安徽省的城市列表：\n');
for (const { city } of cities) {
  console.log(`  "${city}"`);
}

db.close();
