/**
 * GeoRouteGen - Route Result Page (Enhanced)
 * BGP 路由拓扑分析页面 - 专业版
 */

// ==================== Constants ====================

/**
 * 中国34个省级行政区列表
 * 23个省 + 5个自治区 + 4个直辖市 + 2个特别行政区
 */
const CHINA_PROVINCES = [
  // 直辖市
  { en: 'Beijing', cn: '北京市' },
  { en: 'Shanghai', cn: '上海市' },
  { en: 'Tianjin', cn: '天津市' },
  { en: 'Chongqing', cn: '重庆市' },

  // 省份
  { en: 'Hebei', cn: '河北省' },
  { en: 'Shanxi', cn: '山西省' },
  { en: 'Liaoning', cn: '辽宁省' },
  { en: 'Jilin', cn: '吉林省' },
  { en: 'Heilongjiang', cn: '黑龙江省' },
  { en: 'Jiangsu', cn: '江苏省' },
  { en: 'Zhejiang', cn: '浙江省' },
  { en: 'Anhui', cn: '安徽省' },
  { en: 'Fujian', cn: '福建省' },
  { en: 'Jiangxi', cn: '江西省' },
  { en: 'Shandong', cn: '山东省' },
  { en: 'Henan', cn: '河南省' },
  { en: 'Hubei', cn: '湖北省' },
  { en: 'Hunan', cn: '湖南省' },
  { en: 'Guangdong', cn: '广东省' },
  { en: 'Hainan', cn: '海南省' },
  { en: 'Sichuan', cn: '四川省' },
  { en: 'Guizhou', cn: '贵州省' },
  { en: 'Yunnan', cn: '云南省' },
  { en: 'Shaanxi', cn: '陕西省' },
  { en: 'Gansu', cn: '甘肃省' },
  { en: 'Qinghai', cn: '青海省' },
  { en: 'Taiwan', cn: '台湾省' },

  // 自治区
  { en: 'Inner Mongolia', cn: '内蒙古自治区' },
  { en: 'Guangxi', cn: '广西壮族自治区' },
  { en: 'Tibet', cn: '西藏自治区' },
  { en: 'Ningxia', cn: '宁夏回族自治区' },
  { en: 'Xinjiang', cn: '新疆维吾尔自治区' },

  // 特别行政区
  { en: 'Hong Kong', cn: '香港特别行政区' },
  { en: 'Macau', cn: '澳门特别行政区' }
];

// ==================== State ====================

let currentOrigin = 'HKG';
let routeData = { telecom: [], unicom: [], mobile: [] };
let searchQuery = '';
let expandedProvinces = {}; // { ispKey: Set<provinceEn> } - 记录展开状态

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

  // 清空展开状态
  expandedProvinces = {};

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
    console.log('Loading route result for origin:', currentOrigin);
    const data = await api(`/route-result/${currentOrigin}`);
    console.log('Received data:', {
      telecom: data.telecom.length,
      unicom: data.unicom.length,
      mobile: data.mobile.length
    });

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
 * 按省份分组路由数据
 * @param {Array} routes - 路由数据数组 [{ province, city, route_name }]
 * @returns {Object} - { provinceEn: { provinceLevelRoutes: [], cityLevelRoutes: [] } }
 */
function groupRoutesByProvince(routes) {
  const grouped = {};

  for (const route of routes) {
    const province = route.province;

    if (!grouped[province]) {
      grouped[province] = {
        provinceLevelRoutes: [],  // 省级线路（city为null）
        cityLevelRoutes: []        // 城市级线路（city不为null）
      };
    }

    if (route.city) {
      // 城市级线路
      grouped[province].cityLevelRoutes.push({
        city: route.city,
        route_name: route.route_name
      });
    } else {
      // 省级线路
      grouped[province].provinceLevelRoutes.push({
        route_name: route.route_name
      });
    }
  }

  return grouped;
}

/**
 * 获取省份的线路统计
 * @param {string} provinceEn - 省份英文名
 * @param {Object} grouped - 分组后的路由数据
 * @returns {number} - 线路总数
 */
function getProvinceRouteCount(provinceEn, grouped) {
  const data = grouped[provinceEn];
  if (!data) return 0;
  return data.provinceLevelRoutes.length + data.cityLevelRoutes.length;
}

/**
 * 更新统计数据
 */
function updateStats(data) {
  const totalRoutes = data.telecom.length + data.unicom.length + data.mobile.length;

  // 统计唯一省份数（从province字段直接获取）
  const provinces = new Set();
  [...data.telecom, ...data.unicom, ...data.mobile].forEach(item => {
    provinces.add(item.province);
  });

  // 更新统计卡片
  document.getElementById('totalRoutes').textContent = totalRoutes;
  document.getElementById('totalProvinces').textContent = provinces.size;
}

/**
 * 获取省份的中文名
 * @param {string} provinceEn - 省份英文名
 * @returns {string} - 省份中文名
 */
function getProvinceCN(provinceEn) {
  const province = CHINA_PROVINCES.find(p => p.en === provinceEn);
  return province ? province.cn : provinceEn;
}

/**
 * 渲染省份列表
 * @param {string} ispKey - ISP 键名 (telecom/unicom/mobile)
 * @param {Array} routes - 路由数据数组
 */
function renderTable(ispKey, routes) {
  // 直接通过卡片找到.card-body容器
  const card = document.querySelector(`.route-result-card.${ispKey}`);
  const container = card.querySelector('.card-body');

  // 查找或创建province-list容器
  let listContainer = container.querySelector('.province-list');

  if (!listContainer) {
    // 首次创建：移除旧的table和empty-hint，创建新的列表容器
    listContainer = document.createElement('div');
    listContainer.className = 'province-list';

    const oldTable = container.querySelector('table');
    const oldHint = container.querySelector('.empty-hint');
    if (oldTable) oldTable.remove();
    if (oldHint) oldHint.remove();

    container.appendChild(listContainer);
  }

  // 按省份分组
  const grouped = groupRoutesByProvince(routes);

  // 过滤搜索（如果有搜索词）
  const filteredProvinces = filterProvinces(grouped);

  // 更新计数
  let totalCount = 0;
  if (filteredProvinces.length > 0) {
    // 有搜索过滤：只计算匹配的省份
    for (const provinceEn of filteredProvinces) {
      totalCount += getProvinceRouteCount(provinceEn, grouped);
    }
  } else {
    // 无搜索过滤：计算所有路由
    totalCount = routes.length;
  }
  document.getElementById(`${ispKey}-count`).textContent = totalCount;

  // 渲染省份列表
  let html = '';

  // 遍历34个省份（按顺序）
  for (const province of CHINA_PROVINCES) {
    const provinceEn = province.en;
    const provinceCN = province.cn;

    // 如果有搜索过滤，跳过不匹配的省份
    if (filteredProvinces.length > 0 && !filteredProvinces.includes(provinceEn)) {
      continue;
    }

    const routeData = grouped[provinceEn];
    const routeCount = getProvinceRouteCount(provinceEn, grouped);

    if (routeCount === 0) {
      // 没有线路的省份（灰色显示）
      html += `
        <div class="province-row empty" data-province="${escapeHtml(provinceEn)}">
          <div class="province-header disabled">
            <span class="province-name">${escapeHtml(provinceCN)}</span>
            <span class="route-count empty">暂无线路</span>
          </div>
        </div>
      `;
    } else {
      // 有线路的省份（可展开）
      const isExpanded = expandedProvinces[ispKey]?.has(provinceEn) || false;
      const expandIcon = isExpanded ? '▼' : '▶';
      const expandedClass = isExpanded ? 'expanded' : '';

      html += `
        <div class="province-row ${expandedClass}" data-province="${escapeHtml(provinceEn)}" data-isp="${ispKey}">
          <div class="province-header clickable">
            <span class="expand-icon">${expandIcon}</span>
            <span class="province-name">${escapeHtml(provinceCN)}</span>
            <span class="route-count">${routeCount}条线路</span>
          </div>
          <div class="city-details" style="display: ${isExpanded ? 'block' : 'none'}">
            ${renderProvinceDetails(routeData)}
          </div>
        </div>
      `;
    }
  }

  // 显示空状态提示
  if (html === '') {
    html = '<div class="empty-hint">暂无数据</div>';
  }

  listContainer.innerHTML = html;

  // 绑定展开/折叠事件
  bindExpandEvents(listContainer, ispKey);
}

/**
 * 渲染省份详情（省级线路 + 城市线路）
 * @param {Object} data - { provinceLevelRoutes, cityLevelRoutes }
 * @returns {string} - HTML字符串
 */
function renderProvinceDetails(data) {
  let html = '';

  // 1. 省级线路（显示在顶部）
  if (data.provinceLevelRoutes.length > 0) {
    data.provinceLevelRoutes.forEach(route => {
      html += `
        <div class="route-item province-level">
          <span class="route-location">全省</span>
          <span class="route-name">${escapeHtml(route.route_name)}</span>
        </div>
      `;
    });
  }

  // 2. 城市级线路（每个城市的每条线路独立一行）
  if (data.cityLevelRoutes.length > 0) {
    data.cityLevelRoutes.forEach(item => {
      const cityCN = translateCity(item.city);
      html += `
        <div class="route-item city-level">
          <span class="route-location">${escapeHtml(cityCN)}</span>
          <span class="route-name">${escapeHtml(item.route_name)}</span>
        </div>
      `;
    });
  }

  return html || '<div class="empty-hint">暂无线路</div>';
}

/**
 * 过滤省份（根据搜索查询）
 * @param {Object} grouped - 按省份分组的数据
 * @returns {Array} - 匹配的省份英文名数组（空数组表示显示所有）
 */
function filterProvinces(grouped) {
  if (!searchQuery) return [];  // 空数组表示显示所有

  const query = searchQuery.toLowerCase();
  const matchedProvinces = [];

  for (const [provinceEn, data] of Object.entries(grouped)) {
    const provinceCN = getProvinceCN(provinceEn).toLowerCase();

    // 检查省份名是否匹配
    if (provinceCN.includes(query) || provinceEn.toLowerCase().includes(query)) {
      matchedProvinces.push(provinceEn);
      continue;
    }

    // 检查城市名或线路名是否匹配
    const hasMatch = [
      ...data.provinceLevelRoutes,
      ...data.cityLevelRoutes
    ].some(route => {
      const routeName = route.route_name?.toLowerCase() || '';
      const cityName = route.city ? translateCity(route.city).toLowerCase() : '';
      return routeName.includes(query) || cityName.includes(query);
    });

    if (hasMatch) {
      matchedProvinces.push(provinceEn);
    }
  }

  return matchedProvinces;
}

/**
 * 绑定省份展开/折叠事件
 * @param {HTMLElement} container - 列表容器
 * @param {string} ispKey - ISP键名
 */
function bindExpandEvents(container, ispKey) {
  const headers = container.querySelectorAll('.province-header.clickable');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const provinceRow = header.closest('.province-row');
      const provinceEn = provinceRow.dataset.province;
      const cityDetails = provinceRow.querySelector('.city-details');
      const expandIcon = header.querySelector('.expand-icon');

      // 切换展开状态
      const isExpanded = provinceRow.classList.toggle('expanded');
      cityDetails.style.display = isExpanded ? 'block' : 'none';
      expandIcon.textContent = isExpanded ? '▼' : '▶';

      // 更新状态记录
      if (!expandedProvinces[ispKey]) {
        expandedProvinces[ispKey] = new Set();
      }

      if (isExpanded) {
        expandedProvinces[ispKey].add(provinceEn);
      } else {
        expandedProvinces[ispKey].delete(provinceEn);
      }
    });
  });
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

  // 加载初始数据
  loadRouteResult();
});
