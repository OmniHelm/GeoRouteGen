/**
 * GeoRouteGen - Route Result Page (Enhanced)
 * BGP 路由拓扑分析页面 - 专业版
 */

// ==================== State ====================

let currentOrigin = 'HKG';
let routeData = { telecom: [], unicom: [], mobile: [] };
let searchQuery = '';
let sortState = {}; // { ispKey: { column: 'province', direction: 'asc' } }

// ==================== API Client ====================

async function api(url) {
  const response = await fetch(`/api${url}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ==================== Tab Switching ====================

/**
 * 切换起点 Tab
 */
function switchOrigin(origin) {
  if (currentOrigin === origin) return;

  currentOrigin = origin;

  // 更新 Tab 活动状态
  document.querySelectorAll('.origin-tab').forEach(tab => {
    if (tab.dataset.origin === origin) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // 更新当前起点文本（显示代码 + 中文名）
  const originNames = { HKG: '香港', JPN: '日本', SIN: '新加坡' };
  document.getElementById('currentOriginText').textContent = `${origin} ${originNames[origin] || ''}`;

  // 清空搜索
  clearSearch();

  // 加载新数据
  loadRouteResult();
}

// ==================== Data Loading & Rendering ====================

/**
 * 加载路由结果
 */
async function loadRouteResult() {
  try {
    const data = await api(`/route-result/${currentOrigin}`);

    // 存储原始数据
    routeData = data;

    // 渲染三个表格
    renderTable('telecom', data.telecom);
    renderTable('unicom', data.unicom);
    renderTable('mobile', data.mobile);

    // 更新统计数据
    updateStats(data);

  } catch (error) {
    console.error('加载路由结果失败:', error);
    showError(`加载失败: ${error.message}`);
  }
}

/**
 * 更新统计数据
 */
function updateStats(data) {
  const totalRoutes = data.telecom.length + data.unicom.length + data.mobile.length;

  // 统计唯一省份数
  const provinces = new Set();
  [...data.telecom, ...data.unicom, ...data.mobile].forEach(item => {
    // 提取省份名（去除城市部分）
    const province = item.province.split(' - ')[0];
    provinces.add(province);
  });

  // 更新统计卡片
  document.getElementById('totalRoutes').textContent = totalRoutes;
  document.getElementById('totalProvinces').textContent = provinces.size;
}

/**
 * 翻译地区名称（支持省级和市级）
 * @param {string} locationStr - 地区字符串，格式: "Province" 或 "Province - City"
 * @returns {string} - 翻译后的中文字符串
 */
function translateLocation(locationStr) {
  if (locationStr.includes(' - ')) {
    // 市级数据: "Guangdong - Shenzhen City"
    const [province, city] = locationStr.split(' - ');
    return `${translateProvince(province)} - ${translateCity(city)}`;
  } else {
    // 省级数据: "Guangdong"
    return translateProvince(locationStr);
  }
}

/**
 * 渲染单个表格
 * @param {string} ispKey - ISP 键名 (telecom/unicom/mobile)
 * @param {Array} rows - 数据行
 */
function renderTable(ispKey, rows) {
  const table = document.getElementById(`${ispKey}-table`);
  const tbody = table.querySelector('tbody');
  const emptyHint = table.parentElement.querySelector(`.empty-hint[data-table="${ispKey}"]`);

  // 过滤数据（根据搜索查询）
  let filteredRows = filterRows(rows);

  // 排序数据
  filteredRows = sortRows(ispKey, filteredRows);

  // 更新计数
  document.getElementById(`${ispKey}-count`).textContent = filteredRows.length;

  if (filteredRows.length === 0) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    emptyHint.classList.remove('hidden');
    return;
  }

  table.style.display = 'table';
  emptyHint.classList.add('hidden');

  // 渲染表格行
  tbody.innerHTML = filteredRows.map(row => `
    <tr>
      <td>${escapeHtml(translateLocation(row.province))}</td>
      <td><span class="route-name">${escapeHtml(row.route_name)}</span></td>
    </tr>
  `).join('');
}

/**
 * 过滤行（根据搜索查询）
 */
function filterRows(rows) {
  if (!searchQuery) return rows;

  const query = searchQuery.toLowerCase();
  return rows.filter(row => {
    const province = translateLocation(row.province).toLowerCase();
    const routeName = row.route_name.toLowerCase();
    return province.includes(query) || routeName.includes(query);
  });
}

/**
 * 排序行
 */
function sortRows(ispKey, rows) {
  const state = sortState[ispKey];
  if (!state) return rows;

  const { column, direction } = state;
  const sorted = [...rows];

  sorted.sort((a, b) => {
    let valueA, valueB;

    if (column === 'province') {
      valueA = translateLocation(a.province);
      valueB = translateLocation(b.province);
    } else if (column === 'route') {
      valueA = a.route_name;
      valueB = b.route_name;
    }

    const comparison = valueA.localeCompare(valueB, 'zh-CN');
    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ==================== Search Functionality ====================

/**
 * 处理搜索输入
 */
function handleSearch(event) {
  searchQuery = event.target.value.trim();

  // 显示/隐藏清除按钮
  const clearBtn = document.getElementById('clearSearch');
  if (searchQuery) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }

  // 重新渲染所有表格
  renderTable('telecom', routeData.telecom);
  renderTable('unicom', routeData.unicom);
  renderTable('mobile', routeData.mobile);
}

/**
 * 清除搜索
 */
function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('clearSearch').classList.add('hidden');

  // 重新渲染
  renderTable('telecom', routeData.telecom);
  renderTable('unicom', routeData.unicom);
  renderTable('mobile', routeData.mobile);
}

// ==================== Sorting Functionality ====================

/**
 * 处理表头点击排序
 */
function handleSort(event) {
  const th = event.target.closest('th');
  if (!th || !th.classList.contains('sortable')) return;

  const table = th.closest('table');
  const tableId = table.id;
  const ispKey = tableId.replace('-table', '');
  const column = th.dataset.column;

  // 更新排序状态
  if (!sortState[ispKey] || sortState[ispKey].column !== column) {
    sortState[ispKey] = { column, direction: 'asc' };
  } else {
    // 切换排序方向
    sortState[ispKey].direction = sortState[ispKey].direction === 'asc' ? 'desc' : 'asc';
  }

  // 更新表头样式
  table.querySelectorAll('th').forEach(header => {
    header.classList.remove('sorted-asc', 'sorted-desc');
  });

  const direction = sortState[ispKey].direction;
  th.classList.add(`sorted-${direction}`);

  // 重新渲染表格
  const data = routeData[ispKey];
  renderTable(ispKey, data);
}

// ==================== Utility Functions ====================

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 显示错误消息
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    color: #991b1b;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 9999;
    font-weight: 600;
    border: 1px solid #fca5a5;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.style.opacity = '0';
    errorDiv.style.transform = 'translateY(-20px)';
    errorDiv.style.transition = 'all 0.3s';
    setTimeout(() => errorDiv.remove(), 300);
  }, 5000);
}

// ==================== Event Listeners ====================

document.addEventListener('DOMContentLoaded', () => {
  // 初始化当前起点显示（显示代码 + 中文名）
  const originNames = { HKG: '香港', JPN: '日本', SIN: '新加坡' };
  document.getElementById('currentOriginText').textContent = `${currentOrigin} ${originNames[currentOrigin] || ''}`;

  // 搜索输入
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // 使用防抖优化搜索性能
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => handleSearch(e), 300);
    });
  }

  // 清除搜索按钮
  const clearBtn = document.getElementById('clearSearch');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearSearch);
  }

  // 表格排序（事件委托）
  document.querySelectorAll('.route-result-card table').forEach(table => {
    table.addEventListener('click', handleSort);
  });

  // 加载初始数据
  loadRouteResult();
});
