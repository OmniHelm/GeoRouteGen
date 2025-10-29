/**
 * 数据库迁移脚本：增加起点（origin）字段
 *
 * 功能：
 * 1. 清空现有分组数据（用户已确认）
 * 2. 修改 route_groups 表，增加 origin 字段
 * 3. 重建 group_regions 表，修改主键约束为按起点互斥
 * 4. 创建索引优化查询性能
 *
 * ⚠️ 警告：此迁移会删除所有现有分组数据！
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// 数据库路径
const DB_PATH = path.join(__dirname, '..', 'georoute.db');

function migrateDatabase() {
  console.log('=======================================');
  console.log('  数据库迁移：增加起点字段');
  console.log('=======================================\n');

  // 检查数据库文件是否存在
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ 错误：数据库文件不存在');
    console.error(`   期望路径：${DB_PATH}`);
    console.error('\n请先运行 `npm run import-db` 导入IP数据库。');
    process.exit(1);
  }

  // 备份提示
  console.log('⚠️  警告：此操作会删除所有现有分组数据！');
  console.log('   建议先备份数据库文件：georoute.db\n');

  // 打开数据库
  console.log('🗄️  打开数据库...');
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = OFF');  // 临时关闭外键约束

  try {
    // 开始事务
    console.log('🔄 开始迁移...\n');
    db.exec('BEGIN TRANSACTION');

    // 步骤 1：清空现有分组数据
    console.log('   [1/5] 清空现有分组数据...');
    db.exec('DELETE FROM group_regions');
    db.exec('DELETE FROM route_groups');
    console.log('   ✓ 分组数据已清空');

    // 步骤 2：重建 route_groups 表（增加 origin 字段）
    console.log('   [2/5] 重建 route_groups 表...');

    // 创建新表
    db.exec(`
      CREATE TABLE route_groups_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isp TEXT NOT NULL,
        origin TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 删除旧表
    db.exec('DROP TABLE route_groups');

    // 重命名新表
    db.exec('ALTER TABLE route_groups_new RENAME TO route_groups');

    console.log('   ✓ route_groups 表已重建');

    // 步骤 3：重建 group_regions 表（增加 origin 字段，修改主键）
    console.log('   [3/5] 重建 group_regions 表...');

    // 创建新表
    db.exec(`
      CREATE TABLE group_regions_new (
        group_id TEXT NOT NULL,
        origin TEXT NOT NULL,
        province TEXT NOT NULL,
        city TEXT NOT NULL,
        PRIMARY KEY (origin, province, city),
        FOREIGN KEY (group_id) REFERENCES route_groups(id) ON DELETE CASCADE
      )
    `);

    // 删除旧表
    db.exec('DROP TABLE group_regions');

    // 重命名新表
    db.exec('ALTER TABLE group_regions_new RENAME TO group_regions');

    console.log('   ✓ group_regions 表已重建');

    // 步骤 4：创建索引
    console.log('   [4/5] 创建索引...');

    db.exec(`
      CREATE INDEX idx_group_regions_group_id
      ON group_regions(group_id)
    `);

    db.exec(`
      CREATE INDEX idx_group_regions_origin
      ON group_regions(origin)
    `);

    console.log('   ✓ 索引已创建');

    // 步骤 5：验证表结构
    console.log('   [5/5] 验证表结构...');

    const routeGroupsSchema = db.prepare(`
      PRAGMA table_info(route_groups)
    `).all();

    const groupRegionsSchema = db.prepare(`
      PRAGMA table_info(group_regions)
    `).all();

    // 检查 origin 字段是否存在
    const hasOriginInGroups = routeGroupsSchema.some((col: any) => col.name === 'origin');
    const hasOriginInRegions = groupRegionsSchema.some((col: any) => col.name === 'origin');

    if (!hasOriginInGroups || !hasOriginInRegions) {
      throw new Error('表结构验证失败：origin 字段不存在');
    }

    console.log('   ✓ 表结构验证通过');

    // 提交事务
    db.exec('COMMIT');

    // 重新启用外键约束
    db.pragma('foreign_keys = ON');

    console.log('\n✅ 迁移成功！\n');

    // 显示新表结构
    console.log('📋 新表结构：\n');

    console.log('route_groups:');
    routeGroupsSchema.forEach((col: any) => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });

    console.log('\ngroup_regions:');
    groupRegionsSchema.forEach((col: any) => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' (PK)' : ''}`);
    });

    console.log('\n=======================================');
    console.log('✅ 数据库迁移完成！');
    console.log('=======================================\n');

    console.log('现在可以使用新的起点配置功能了。');
    console.log('可选的起点值：HKG、JPN、SIN\n');

  } catch (error) {
    // 回滚事务
    console.error('\n❌ 迁移失败，正在回滚...');
    db.exec('ROLLBACK');
    db.pragma('foreign_keys = ON');

    console.error('\n错误信息：', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// 执行迁移
migrateDatabase();
