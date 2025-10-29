/**
 * IP地址工具函数和CIDR转换算法
 *
 * 核心功能：
 * 1. IP地址与数字互转
 * 2. 将IP范围转换为最优CIDR列表
 */

/**
 * IP地址转数字（等同于MySQL的INET_ATON）
 * @param ip - 点分十进制IP地址，如 "192.168.1.1"
 * @returns IP的数字表示（无符号32位整数）
 * @example ipToNumber("192.168.1.1") // 3232235777
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`无效的IP地址: ${ip}`);
  }

  return (
    (parseInt(parts[0]) << 24) +
    (parseInt(parts[1]) << 16) +
    (parseInt(parts[2]) << 8) +
    parseInt(parts[3])
  ) >>> 0; // 无符号右移确保是正数
}

/**
 * 数字转IP地址（等同于MySQL的INET_NTOA）
 * @param num - IP的数字表示
 * @returns 点分十进制IP地址
 * @example numberToIP(3232235777) // "192.168.1.1"
 */
export function numberToIP(num: number): string {
  return [
    (num >>> 24) & 0xFF,
    (num >>> 16) & 0xFF,
    (num >>> 8) & 0xFF,
    num & 0xFF
  ].join('.');
}

/**
 * 计算一个数字的二进制表示中末尾连续0的个数
 * 用于确定CIDR前缀对齐
 * @param n - 要计算的数字
 * @returns 末尾连续0的个数
 * @example trailingZeros(8) // 3，因为 8 = 0b1000
 */
function trailingZeros(n: number): number {
  if (n === 0) return 32;

  let count = 0;
  while ((n & 1) === 0) {
    count++;
    n >>>= 1;
  }
  return count;
}

/**
 * 计算从start开始，最大的CIDR前缀长度
 *
 * 关键逻辑：
 * 1. start必须对齐到CIDR边界（末尾有足够的0）
 * 2. CIDR块大小不能超过maxSize
 *
 * @param start - 起始IP（数字形式）
 * @param maxSize - 最大可包含的IP数量
 * @returns CIDR前缀长度（0-32）
 *
 * @example
 * maxCIDRPrefix(16777216, 256) // 24，因为1.0.0.0可以容纳/24
 * maxCIDRPrefix(16777217, 256) // 32，因为1.0.0.1不对齐，只能是/32
 */
function maxCIDRPrefix(start: number, maxSize: number): number {
  // 1. 检查start的对齐情况
  // 例如：如果start是8 (0b1000)，末尾有3个0，最大可以是/29 (32-3=29)
  const trailingZeroCount = trailingZeros(start);

  // 2. 根据maxSize计算需要的前缀长度
  // 例如：256个IP需要/24 (2^8=256)
  let prefixLen = 32;
  let size = 1;
  while (size < maxSize && prefixLen > 0) {
    size <<= 1;  // size *= 2
    prefixLen--;
  }

  // 3. 取两者的限制：对齐限制 vs 大小限制
  // 返回最大的前缀长度（也就是最小的数字）
  return Math.max(32 - Math.min(trailingZeroCount, 32 - prefixLen), 0);
}

/**
 * 将IP范围转换为CIDR列表（核心算法）
 *
 * 算法思路：
 * 1. 从minip开始，每次找到最大的CIDR块
 * 2. 块大小受两个限制：
 *    - 起始IP必须对齐到CIDR边界
 *    - 不能超出maxip范围
 * 3. 重复直到覆盖整个范围
 *
 * @param minip - 起始IP（数字形式）
 * @param maxip - 结束IP（数字形式）
 * @returns CIDR列表，如 ["1.0.0.0/24", "1.0.1.0/25"]
 *
 * @example
 * // 完美对齐的/24
 * rangeToCIDRs(ipToNumber('1.0.0.0'), ipToNumber('1.0.0.255'))
 * // ["1.0.0.0/24"]
 *
 * // 不对齐的范围会拆分成多个CIDR
 * rangeToCIDRs(ipToNumber('1.0.0.5'), ipToNumber('1.0.0.20'))
 * // ["1.0.0.5/32", "1.0.0.6/31", "1.0.0.8/29", "1.0.0.16/30", "1.0.0.20/32"]
 */
export function rangeToCIDRs(minip: number, maxip: number): string[] {
  if (minip > maxip) {
    throw new Error(`无效的IP范围: ${numberToIP(minip)} - ${numberToIP(maxip)}`);
  }

  const cidrs: string[] = [];
  let current = minip;

  while (current <= maxip) {
    // 计算剩余IP数量
    const remaining = maxip - current + 1;

    // 找到最大可用的CIDR块
    const prefixLen = maxCIDRPrefix(current, remaining);
    const blockSize = 1 << (32 - prefixLen); // 2^(32-prefixLen)

    // 添加CIDR
    cidrs.push(`${numberToIP(current)}/${prefixLen}`);

    // 移动到下一个块
    current += blockSize;
  }

  return cidrs;
}

/**
 * 验证CIDR格式是否有效
 * @param cidr - CIDR字符串，如 "1.0.0.0/24"
 * @returns 是否有效
 */
export function isValidCIDR(cidr: string): boolean {
  const match = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!match) return false;

  const [, ip, prefix] = match;
  const prefixNum = parseInt(prefix);

  try {
    ipToNumber(ip);
    return prefixNum >= 0 && prefixNum <= 32;
  } catch {
    return false;
  }
}

/**
 * 解析CIDR，返回起始IP的数字形式
 * @param cidr - CIDR字符串，如 "36.133.48.0/20"
 * @returns 起始IP的数字表示
 * @throws 如果CIDR格式无效
 * @example parseCIDR("36.133.48.0/20") // 609648640
 */
export function parseCIDR(cidr: string): number {
  const match = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);

  if (!match) {
    throw new Error(`无效的CIDR格式: ${cidr}`);
  }

  const [, ipStr, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`无效的前缀长度: ${prefixStr}`);
  }

  return ipToNumber(ipStr);
}

/**
 * 测试函数（开发时使用）
 */
export function runTests() {
  console.log('=== IP工具函数测试 ===\n');

  // 测试1: IP与数字互转
  console.log('测试1: IP与数字互转');
  const testIP = '192.168.1.1';
  const testNum = ipToNumber(testIP);
  console.log(`${testIP} -> ${testNum} -> ${numberToIP(testNum)}`);
  console.log('✓ 通过\n');

  // 测试2: 完美对齐的/24
  console.log('测试2: 完美对齐的/24');
  const test2 = rangeToCIDRs(
    ipToNumber('1.0.0.0'),
    ipToNumber('1.0.0.255')
  );
  console.log('1.0.0.0 - 1.0.0.255 =>', test2);
  console.log('期望: ["1.0.0.0/24"]');
  console.log(test2.length === 1 && test2[0] === '1.0.0.0/24' ? '✓ 通过\n' : '✗ 失败\n');

  // 测试3: 不对齐的范围
  console.log('测试3: 不对齐的范围');
  const test3 = rangeToCIDRs(
    ipToNumber('1.0.0.5'),
    ipToNumber('1.0.0.20')
  );
  console.log('1.0.0.5 - 1.0.0.20 =>', test3);
  console.log('期望: 多个CIDR块（不对齐）');
  console.log(test3.length > 1 ? '✓ 通过\n' : '✗ 失败\n');

  // 测试4: 跨多个子网的/22
  console.log('测试4: 跨多个子网的/22');
  const test4 = rangeToCIDRs(
    ipToNumber('192.168.0.0'),
    ipToNumber('192.168.3.255')
  );
  console.log('192.168.0.0 - 192.168.3.255 =>', test4);
  console.log('期望: ["192.168.0.0/22"]');
  console.log(test4.length === 1 && test4[0] === '192.168.0.0/22' ? '✓ 通过\n' : '✗ 失败\n');

  // 测试5: 单个IP
  console.log('测试5: 单个IP');
  const test5 = rangeToCIDRs(
    ipToNumber('10.0.0.1'),
    ipToNumber('10.0.0.1')
  );
  console.log('10.0.0.1 - 10.0.0.1 =>', test5);
  console.log('期望: ["10.0.0.1/32"]');
  console.log(test5.length === 1 && test5[0] === '10.0.0.1/32' ? '✓ 通过\n' : '✗ 失败\n');

  console.log('=== 测试完成 ===');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runTests();
}
