/**
 * 埃文IP数据库导入脚本
 *
 * 功能：
 * 1. 解析TSV文件（1522万行，3.1GB）
 * 2. 批量导入SQLite数据库
 * 3. 创建索引优化查询性能
 *
 * 数据格式（来自官方文档）：
 * - 分隔符：制表符 \t
 * - 引号：双引号包裹所有值
 * - 换行符：\r\n
 * - 第一行：字段名
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// 数据库文件路径
const DB_PATH = path.join(__dirname, '..', 'georoute.db');

// TSV文件路径
const TSV_PATH = path.join(
  __dirname,
  '..',
  'IP_city_single_WGS84_en_mysql',
  'IP_city_single_WGS84_en.txt'
);

/**
 * 解析TSV行（处理双引号）
 */
function parseTSVLine(line: string): string[] {
  return line.split('\t').map(field =>
    field.replace(/^"|"$/g, '')  // 去除首尾双引号
  );
}

/**
 * 格式化数字（带千位分隔符）
 */
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * 主导入函数
 */
async function importIPDB() {
  console.log('=======================================');
  console.log('  埃文IP数据库导入工具');
  console.log('=======================================\n');

  // 检查TSV文件是否存在
  if (!fs.existsSync(TSV_PATH)) {
    console.error(`❌ 错误：找不到数据文件`);
    console.error(`   期望路径：${TSV_PATH}`);
    console.error(`\n请确保 IP_city_single_WGS84_en_mysql/ 目录存在且包含数据文件。`);
    process.exit(1);
  }

  console.log(`📁 数据文件：${path.basename(TSV_PATH)}`);
  const fileStats = fs.statSync(TSV_PATH);
  console.log(`📏 文件大小：${(fileStats.size / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

  // 创建/打开数据库
  console.log('🗄️  初始化数据库...');
  const db = new Database(DB_PATH);

  // 删除旧表（如果存在）
  console.log('🧹 清理旧数据...');
  db.exec('DROP TABLE IF EXISTS ip_records');
  db.exec('DROP TABLE IF EXISTS route_groups');
  db.exec('DROP TABLE IF EXISTS group_regions');

  // 创建IP记录表
  console.log('📋 创建数据表...');
  db.exec(`
    CREATE TABLE ip_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      minip INTEGER NOT NULL,
      maxip INTEGER NOT NULL,
      continent TEXT,
      areacode TEXT,
      adcode TEXT,
      country TEXT,
      province TEXT,
      city TEXT,
      lngwgs TEXT,
      latwgs TEXT,
      radius TEXT,
      accuracy TEXT,
      owner TEXT,
      isp TEXT,
      asnumber TEXT,
      source TEXT,
      zipcode TEXT,
      timezone TEXT
    )
  `);

  // 创建分组表
  db.exec(`
    CREATE TABLE route_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建地区分配表（互斥约束）
  db.exec(`
    CREATE TABLE group_regions (
      group_id TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      PRIMARY KEY (province, city),
      FOREIGN KEY (group_id) REFERENCES route_groups(id) ON DELETE CASCADE
    )
  `);

  console.log('✓ 数据表创建成功\n');

  // 准备插入语句
  const insert = db.prepare(`
    INSERT INTO ip_records (
      minip, maxip, continent, areacode, adcode, country,
      province, city, lngwgs, latwgs, radius, accuracy,
      owner, isp, asnumber, source, zipcode, timezone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 批量插入（事务加速）
  const insertMany = db.transaction((records: any[]) => {
    for (const r of records) {
      insert.run(r);
    }
  });

  // 按行解析TSV
  console.log('📥 开始导入数据...\n');
  const rl = readline.createInterface({
    input: fs.createReadStream(TSV_PATH),
    crlfDelay: Infinity
  });

  let batch: any[] = [];
  let count = 0;
  let lastReportTime = Date.now();
  const startTime = Date.now();

  for await (const line of rl) {
    if (count === 0) {
      // 跳过表头
      count++;
      continue;
    }

    const fields = parseTSVLine(line);

    // 构建记录（跳过id字段）
    batch.push([
      parseInt(fields[1]) || 0,  // minip
      parseInt(fields[2]) || 0,  // maxip
      fields[3] || '',            // continent
      fields[4] || '',            // areacode
      fields[5] || '',            // adcode
      fields[6] || '',            // country
      fields[7] || '',            // province
      fields[8] || '',            // city
      fields[9] || '',            // lngwgs
      fields[10] || '',           // latwgs
      fields[11] || '',           // radius
      fields[12] || '',           // accuracy
      fields[13] || '',           // owner
      fields[14] || '',           // isp
      fields[15] || '',           // asnumber
      fields[16] || '',           // source
      fields[17] || '',           // zipcode
      fields[18] || ''            // timezone
    ]);

    // 每10000条批量插入一次
    if (batch.length >= 10000) {
      insertMany(batch);
      batch = [];

      // 每5秒报告一次进度
      const now = Date.now();
      if (now - lastReportTime >= 5000) {
        const elapsed = (now - startTime) / 1000;
        const speed = Math.round(count / elapsed);
        console.log(
          `   已导入 ${formatNumber(count)} 行  ` +
          `(速度: ${formatNumber(speed)} 行/秒)`
        );
        lastReportTime = now;
      }
    }

    count++;
  }

  // 插入剩余数据
  if (batch.length > 0) {
    insertMany(batch);
  }

  const importTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ 数据导入完成！`);
  console.log(`   总计: ${formatNumber(count - 1)} 条记录`);
  console.log(`   耗时: ${importTime} 秒\n`);

  // 创建索引
  console.log('🔍 创建索引（这可能需要1-2分钟）...\n');

  const indexStartTime = Date.now();

  // 索引1：按地区查询
  console.log('   [1/2] 创建地区索引...');
  db.exec(`
    CREATE INDEX idx_region
    ON ip_records(country, province, city, isp)
  `);
  console.log('   ✓ 地区索引创建完成');

  // 索引2：按IP范围查询
  console.log('   [2/2] 创建IP范围索引...');
  db.exec(`
    CREATE INDEX idx_minip_maxip
    ON ip_records(minip, maxip)
  `);
  console.log('   ✓ IP范围索引创建完成');

  const indexTime = ((Date.now() - indexStartTime) / 1000).toFixed(1);
  console.log(`\n✓ 索引创建完成！耗时: ${indexTime} 秒\n`);

  // 数据库统计
  console.log('📊 数据库统计：');
  const stats = db.prepare('SELECT COUNT(*) as total FROM ip_records').get() as { total: number };
  const dbSize = fs.statSync(DB_PATH).size;
  console.log(`   记录总数：${formatNumber(stats.total)}`);
  console.log(`   数据库大小：${(dbSize / 1024 / 1024).toFixed(2)} MB`);

  // 测试查询
  console.log('\n🧪 测试查询...');
  const testQuery = db.prepare(`
    SELECT country, province, city, isp, COUNT(*) as count
    FROM ip_records
    WHERE country = 'China' AND isp = 'China Telecom'
    GROUP BY province
    ORDER BY count DESC
    LIMIT 5
  `).all();

  console.log('\n   中国电信IP最多的5个省份：');
  for (const row of testQuery as any[]) {
    console.log(`     ${row.province}: ${formatNumber(row.count)} 条`);
  }

  db.close();

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n=======================================');
  console.log(`✅ 导入成功！总耗时: ${totalTime} 分钟`);
  console.log('=======================================\n');
  console.log('现在可以运行 `npm run dev` 启动服务器。');
}

// 执行导入
importIPDB().catch((err) => {
  console.error('\n❌ 导入失败：', err);
  process.exit(1);
});
