/**
 * GeoRouteGen - Vanilla JavaScript
 * No frameworks, no build process, no bullshit.
 *
 * 翻译函数已提取到 common.js
 */

// ==================== State ====================

let groups = [];
let regions = [];
let isps = [];
let stats = null;

let editingGroup = null;
let selectedRegions = [];
let selectedRegionsSet = new Set(); // O(1) 查找优化
let expandedProvinces = new Set();
let currentGeoRegion = '全部'; // 当前选择的地理分区
let selectedGroupIds = new Set(); // 批量删除选中的分组ID

// 生成地区的唯一键
function getRegionKey(province, city) {
  return `${province}:${city}`;
}

// ==================== API Client ====================

async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ==================== Data Loading ====================

async function loadData() {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const empty = document.getElementById('empty');
  const groupList = document.getElementById('groupList');
  const generateBtn = document.getElementById('generateAllBtn');

  loading.style.display = 'block';
  error.style.display = 'none';
  empty.style.display = 'none';
  groupList.innerHTML = '';

  try {
    [groups, regions, isps, stats] = await Promise.all([
      api('/groups'),
      api('/regions'),
      api('/isps'),
      api('/stats'),
    ]);

    loading.style.display = 'none';

    // Update stats
    document.getElementById('stats').innerHTML = `
      <p>IP记录: ${stats.totalRecords.toLocaleString()}</p>
      <p>线路分组数: ${stats.groupCount}</p>
    `;

    // Show/hide generate button
    generateBtn.style.display = groups.length > 0 ? 'inline-block' : 'none';

    if (groups.length === 0) {
      empty.style.display = 'block';
    } else {
      renderGroups();
    }
  } catch (err) {
    loading.style.display = 'none';
    error.style.display = 'block';
    document.getElementById('errorMessage').textContent = err.message;
  }
}

/**
 * 根据起点加载地区列表
 * @param {string} origin - 起点位置 (HKG/JPN/SIN)
 */
async function loadRegions(origin) {
  if (!origin) {
    regions = [];
    return;
  }
  try {
    regions = await api(`/regions?origin=${origin}`);
  } catch (err) {
    console.error('加载地区失败:', err);
    regions = [];
  }
}

/**
 * 起点选择变化时的回调
 */
async function onOriginChange() {
  const origin = document.getElementById('groupOrigin').value;

  // 清空已选择的地区（因为起点改变了，之前的选择可能冲突）
  selectedRegions = [];

  // 重新加载该起点的地区列表
  await loadRegions(origin);

  // 重新渲染地区选择器
  renderRegionList();
}

// ==================== Rendering ====================

function renderGroups() {
  const container = document.getElementById('groupList');
  container.innerHTML = groups.map(group => `
    <div class="group-card ${selectedGroupIds.has(group.id) ? 'selected' : ''}">
      <div class="group-header">
        <div class="group-checkbox">
          <input type="checkbox"
                 ${selectedGroupIds.has(group.id) ? 'checked' : ''}
                 onchange="toggleGroupSelection('${group.id}')"
                 onclick="event.stopPropagation()">
        </div>
        <div class="group-info">
          <h3>
            <span class="origin-badge">${escapeHtml(group.origin || 'HKG')}</span>
            ${escapeHtml(group.name)}
          </h3>
          <div class="isp">ISP: ${group.isp ? translateISP(escapeHtml(group.isp)) : '所有ISP'}</div>
          <div class="region-tags">
            ${group.regions.length === 0
              ? '<span class="empty-regions">未选择地区</span>'
              : group.regions.map(r => `
                  <span class="tag">${translateProvince(r.province)} - ${translateCity(r.city)}</span>
                `).join('')
            }
          </div>
        </div>
        <div class="group-actions">
          <button class="btn btn-sm btn-download" onclick="downloadGroup('${group.id}')">
            下载
          </button>
          <button class="btn btn-sm btn-edit" onclick="editGroup('${group.id}')">
            编辑
          </button>
          <button class="btn btn-sm btn-delete" onclick="deleteGroup('${group.id}')">
            删除
          </button>
        </div>
      </div>
      <div class="group-footer">
        创建于: ${new Date(group.created_at).toLocaleString('zh-CN')}
      </div>
    </div>
  `).join('');
  updateBatchBar();
}

// ==================== Modal ====================

function showCreateModal() {
  editingGroup = null;
  selectedRegions = [];
  selectedRegionsSet.clear(); // 同步清空 Set
  expandedProvinces.clear();
  currentGeoRegion = '全部'; // 重置地理分区过滤

  document.getElementById('modalTitle').textContent = '新建线路分组';
  document.getElementById('groupName').value = '';
  document.getElementById('groupISP').value = '';
  document.getElementById('groupOrigin').value = '';
  document.getElementById('groupOrigin').disabled = false;
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('regionSearch').value = '';

  // Populate ISPs
  const ispSelect = document.getElementById('groupISP');
  ispSelect.innerHTML = '<option value="">所有ISP（不筛选）</option>' +
    isps.map(isp => {
      const displayName = translateISP(isp);
      return `<option value="${escapeHtml(isp)}">${escapeHtml(displayName)}</option>`;
    }).join('');

  renderGeoRegionTabs();
  renderRegionList();
  document.getElementById('modal').style.display = 'flex';
}

function editGroup(id) {
  const group = groups.find(g => g.id === id);
  if (!group) return;

  editingGroup = group;
  selectedRegions = group.regions.map(r => {
    const region = regions.find(reg =>
      reg.province === r.province && reg.city === r.city
    );
    return region || r;
  });

  // 同步初始化 Set
  selectedRegionsSet.clear();
  for (const region of selectedRegions) {
    selectedRegionsSet.add(getRegionKey(region.province, region.city));
  }

  expandedProvinces.clear();
  currentGeoRegion = '全部'; // 重置地理分区过滤

  document.getElementById('modalTitle').textContent = '编辑线路分组';
  document.getElementById('groupName').value = group.name;
  document.getElementById('groupISP').value = group.isp;
  document.getElementById('groupOrigin').value = group.origin || 'HKG';
  document.getElementById('groupOrigin').disabled = true;  // 编辑时不允许修改起点
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('regionSearch').value = '';

  // Populate ISPs
  const ispSelect = document.getElementById('groupISP');
  ispSelect.innerHTML = '<option value="">所有ISP（不筛选）</option>' +
    isps.map(isp => {
      const displayName = translateISP(isp);
      return `<option value="${escapeHtml(isp)}">${escapeHtml(displayName)}</option>`;
    }).join('');
  ispSelect.value = group.isp;

  // 加载该起点的地区列表
  loadRegions(group.origin).then(() => {
    renderGeoRegionTabs();
    renderRegionList();
  });

  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

async function saveGroup() {
  const name = document.getElementById('groupName').value.trim();
  const isp = document.getElementById('groupISP').value;
  const origin = document.getElementById('groupOrigin').value;
  const errorEl = document.getElementById('modalError');
  const saveBtn = document.getElementById('saveBtn');

  // Validation
  if (!origin) {
    errorEl.textContent = '请选择起点位置';
    errorEl.style.display = 'block';
    return;
  }
  if (!name) {
    errorEl.textContent = '请输入线路分组名称';
    errorEl.style.display = 'block';
    return;
  }
  // ISP可以为空（表示所有ISP）
  if (selectedRegions.length === 0) {
    errorEl.textContent = '请至少选择一个地区';
    errorEl.style.display = 'block';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  errorEl.style.display = 'none';

  try {
    const regionData = selectedRegions.map(r => ({
      province: r.province,
      city: r.city,
    }));

    if (editingGroup) {
      // 编辑时不传 origin（后端会使用原有的 origin）
      await api(`/groups/${editingGroup.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, isp, regions: regionData }),
      });
    } else {
      // 新建时必须传 origin
      await api('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, isp, origin, regions: regionData }),
      });
    }

    closeModal();
    await loadData();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存';
  }
}

// ==================== Region Selection ====================

function renderRegionList() {
  const searchQuery = document.getElementById('regionSearch').value.toLowerCase();

  // Filter available regions (exclude assigned to other groups)
  let availableRegions = regions.filter(r =>
    r.assignedTo === null || (editingGroup && r.assignedTo === editingGroup.id)
  );

  // Filter by geo region (地理分区过滤)
  if (currentGeoRegion !== '全部') {
    const allowedProvinces = geoRegions[currentGeoRegion];
    if (allowedProvinces) {
      availableRegions = availableRegions.filter(r =>
        allowedProvinces.includes(r.province)
      );
    }
  }

  // Group by province
  const provinceGroups = {};
  for (const region of availableRegions) {
    if (!provinceGroups[region.province]) {
      provinceGroups[region.province] = [];
    }
    provinceGroups[region.province].push(region);
  }

  // Filter by search (支持中英文搜索)
  const filteredProvinces = Object.entries(provinceGroups)
    .map(([province, cities]) => {
      const provinceZh = translateProvince(province).toLowerCase();
      const provinceEn = province.toLowerCase();

      return {
        province,
        cities: cities.filter(r => {
          const matchProvince = provinceZh.includes(searchQuery) || provinceEn.includes(searchQuery);
          const matchCity = r.city.toLowerCase().includes(searchQuery);
          return matchProvince || matchCity;
        }),
      };
    })
    .filter(group => group.cities.length > 0)
    .sort((a, b) => a.province.localeCompare(b.province, 'zh-CN'));

  // Update count and render selected list
  document.getElementById('selectedCount').textContent =
    `已选择 ${selectedRegions.length} 个地区`;
  renderSelectedList();

  // Render
  const container = document.getElementById('regionList');
  if (filteredProvinces.length === 0) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">没有找到匹配的地区</div>';
    return;
  }

  container.innerHTML = filteredProvinces.map(group => {
    const isExpanded = expandedProvinces.has(group.province);
    const allSelected = group.cities.every(c => isRegionSelected(c));
    const provinceDisplay = translateProvince(group.province);

    return `
      <div class="province-group ${isExpanded ? 'expanded' : ''}">
        <div class="province-header" onclick="toggleProvince('${escapeHtml(group.province)}')">
          <input type="checkbox"
            ${allSelected ? 'checked' : ''}
            onclick="event.stopPropagation(); toggleProvinceAll('${escapeHtml(group.province)}')">
          <span class="province-name">${escapeHtml(provinceDisplay)}</span>
          <span class="province-count">(${group.cities.length}个城市)</span>
          <span class="province-toggle">${isExpanded ? '▼' : '▶'}</span>
        </div>
        ${isExpanded ? `
          <div class="city-list">
            ${group.cities.map(city => {
              const cityName = translateCity(city.city);
              const isProvincialLevel = !city.city || city.city === '';
              return `
                <div class="city-item" onclick="toggleCity('${escapeHtml(city.province)}', '${escapeHtml(city.city)}')">
                  <input type="checkbox" ${isRegionSelected(city) ? 'checked' : ''}>
                  <span class="city-name">${cityName}</span>
                  ${isProvincialLevel ? '<span class="city-hint" title="此选项仅包含无法定位到具体城市的IP段（约5%）">ⓘ</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// 渲染地理分区标签
function renderGeoRegionTabs() {
  const container = document.getElementById('geoRegionTabs');
  if (!container) return;

  const regions = Object.keys(geoRegions);
  container.innerHTML = regions.map(region => {
    const isActive = currentGeoRegion === region;
    return `<span class="geo-region-tab ${isActive ? 'active' : ''}" onclick="filterByGeoRegion('${escapeHtml(region)}')">${escapeHtml(region)}</span>`;
  }).join('');
}

// 切换地理分区过滤
function filterByGeoRegion(region) {
  currentGeoRegion = region;
  renderGeoRegionTabs();
  renderRegionList();
}

function isRegionSelected(region) {
  return selectedRegionsSet.has(getRegionKey(region.province, region.city));
}

function toggleProvince(province) {
  // 单一展开模式：同时只允许一个省份展开
  if (expandedProvinces.has(province)) {
    // 点击已展开的省份 → 关闭
    expandedProvinces.delete(province);
  } else {
    // 点击未展开的省份 → 关闭其他所有，打开当前
    expandedProvinces.clear();
    expandedProvinces.add(province);
  }
  renderRegionList();
}

function toggleProvinceAll(province) {
  const cities = regions.filter(r =>
    r.province === province &&
    (r.assignedTo === null || (editingGroup && r.assignedTo === editingGroup.id))
  );

  const allSelected = cities.every(c => isRegionSelected(c));

  if (allSelected) {
    // Deselect all - remove from both structures
    for (const city of cities) {
      const key = getRegionKey(city.province, city.city);
      selectedRegionsSet.delete(key);
    }
    selectedRegions = selectedRegions.filter(s =>
      !cities.some(c => c.province === s.province && c.city === s.city)
    );
  } else {
    // Select all - add to both structures
    for (const city of cities) {
      if (!isRegionSelected(city)) {
        const key = getRegionKey(city.province, city.city);
        selectedRegionsSet.add(key);
        selectedRegions.push(city);
      }
    }
  }

  renderRegionList();
}

function toggleCity(province, city) {
  const region = regions.find(r => r.province === province && r.city === city);
  if (!region) return;

  const key = getRegionKey(province, city);

  if (selectedRegionsSet.has(key)) {
    // Remove from both structures
    selectedRegionsSet.delete(key);
    const index = selectedRegions.findIndex(r =>
      r.province === province && r.city === city
    );
    if (index >= 0) {
      selectedRegions.splice(index, 1);
    }
  } else {
    // Add to both structures
    selectedRegionsSet.add(key);
    selectedRegions.push(region);
  }

  renderRegionList();
}

// ==================== Selected Region Panel ====================

function renderSelectedList() {
  const container = document.getElementById('selectedList');
  if (!container) return;

  if (selectedRegions.length === 0) {
    container.innerHTML = '<div class="selected-empty">暂无选择的地区<br>从左侧选择地区</div>';
    return;
  }

  container.innerHTML = selectedRegions.map(region => {
    const provinceText = translateProvince(region.province);
    const cityText = translateCity(region.city);
    return `
      <div class="selected-item">
        <span class="selected-item-text">${escapeHtml(provinceText)} - ${escapeHtml(cityText)}</span>
        <button class="selected-item-remove" onclick="removeSelectedRegion('${escapeHtml(region.province)}', '${escapeHtml(region.city)}')" title="删除">×</button>
      </div>
    `;
  }).join('');
}

function removeSelectedRegion(province, city) {
  const key = getRegionKey(province, city);
  const index = selectedRegions.findIndex(r =>
    r.province === province && r.city === city
  );

  if (index >= 0) {
    selectedRegions.splice(index, 1);
    selectedRegionsSet.delete(key); // 同步删除 Set
    renderRegionList();
  }
}

// ==================== Quick Actions ====================

function clearSelection() {
  // 清空所有选择
  selectedRegions = [];
  selectedRegionsSet.clear(); // 同步清空 Set
  renderRegionList();
}

// Search handler
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('regionSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderRegionList();
    });
  }

  // 点击外部关闭浮层
  document.addEventListener('click', (e) => {
    const regionList = document.getElementById('regionList');
    if (!regionList) return;

    // 检查点击是否在省份组或浮层内部
    const clickedInside = e.target.closest('.province-group');

    if (!clickedInside && expandedProvinces.size > 0) {
      // 点击在外部，关闭所有展开的浮层
      expandedProvinces.clear();
      renderRegionList();
    }
  });
});

// ==================== Batch Selection ====================

function toggleGroupSelection(id) {
  if (selectedGroupIds.has(id)) {
    selectedGroupIds.delete(id);
  } else {
    selectedGroupIds.add(id);
  }
  renderGroups();
}

function toggleSelectAll() {
  const checkbox = document.getElementById('selectAllCheckbox');
  if (checkbox.checked) {
    // 全选
    for (const group of groups) {
      selectedGroupIds.add(group.id);
    }
  } else {
    // 取消全选
    selectedGroupIds.clear();
  }
  renderGroups();
}

function clearBatchSelection() {
  selectedGroupIds.clear();
  renderGroups();
}

function updateBatchBar() {
  const batchBar = document.getElementById('batchBar');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountText = document.getElementById('selectedCountText');

  const count = selectedGroupIds.size;

  if (count > 0) {
    batchBar.style.display = 'block';
    selectedCountText.textContent = `已选择 ${count} 个分组`;
    selectAllCheckbox.checked = count === groups.length;
    selectAllCheckbox.indeterminate = count > 0 && count < groups.length;
  } else {
    batchBar.style.display = 'none';
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
}

async function deleteSelectedGroups() {
  const ids = Array.from(selectedGroupIds);
  if (ids.length === 0) return;

  const groupNames = ids.map(id => {
    const group = groups.find(g => g.id === id);
    return group ? group.name : id;
  }).join('、');

  if (!confirm(`确定删除以下 ${ids.length} 个分组吗？\n\n${groupNames}\n\n此操作不可撤销！`)) {
    return;
  }

  // 显示进度
  const batchBar = document.getElementById('batchBar');
  const originalHTML = batchBar.innerHTML;

  let successCount = 0;
  let failedGroups = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const group = groups.find(g => g.id === id);
    const groupName = group ? group.name : id;

    // 更新进度显示
    batchBar.innerHTML = `
      <div class="batch-bar-content">
        <span style="font-weight: 600;">正在删除: ${groupName} (${i + 1}/${ids.length})</span>
      </div>
    `;

    try {
      await api(`/groups/${id}`, { method: 'DELETE' });
      successCount++;

      // 立即从数组中移除（优化：不重新加载整个列表）
      const index = groups.findIndex(g => g.id === id);
      if (index >= 0) {
        groups.splice(index, 1);
      }
      selectedGroupIds.delete(id);
    } catch (err) {
      console.error(`删除分组 ${groupName} 失败:`, err);
      failedGroups.push({ name: groupName, error: err.message });
      break; // 遇到错误立即停止
    }
  }

  // 恢复批量操作栏
  batchBar.innerHTML = originalHTML;

  // 更新统计信息
  if (stats) {
    stats.groupCount = groups.length;
    document.getElementById('stats').innerHTML = `
      <p>IP记录: ${stats.totalRecords.toLocaleString()}</p>
      <p>线路分组数: ${stats.groupCount}</p>
    `;
  }

  // 重新渲染列表
  renderGroups();

  // 显示结果
  if (failedGroups.length === 0) {
    alert(`成功删除 ${successCount} 个分组！`);
  } else {
    const failedNames = failedGroups.map(f => `${f.name}: ${f.error}`).join('\n');
    alert(`删除了 ${successCount} 个分组，但有 ${failedGroups.length} 个失败：\n\n${failedNames}`);
  }

  // 更新生成按钮显示状态
  const generateBtn = document.getElementById('generateAllBtn');
  generateBtn.style.display = groups.length > 0 ? 'inline-block' : 'none';

  // 如果没有分组了，显示空状态
  if (groups.length === 0) {
    document.getElementById('empty').style.display = 'block';
    document.getElementById('groupList').innerHTML = '';
  }
}

// ==================== Actions ====================

async function deleteGroup(id) {
  if (!confirm('确定删除此线路分组？')) return;

  try {
    await api(`/groups/${id}`, { method: 'DELETE' });

    // 优化：直接从数组中移除，不重新加载
    const index = groups.findIndex(g => g.id === id);
    if (index >= 0) {
      groups.splice(index, 1);
    }

    // 从选中列表中移除（如果存在）
    selectedGroupIds.delete(id);

    // 更新统计信息
    if (stats) {
      stats.groupCount = groups.length;
      document.getElementById('stats').innerHTML = `
        <p>IP记录: ${stats.totalRecords.toLocaleString()}</p>
        <p>线路分组数: ${stats.groupCount}</p>
      `;
    }

    // 更新生成按钮显示状态
    const generateBtn = document.getElementById('generateAllBtn');
    generateBtn.style.display = groups.length > 0 ? 'inline-block' : 'none';

    // 如果没有分组了，显示空状态
    if (groups.length === 0) {
      document.getElementById('empty').style.display = 'block';
      document.getElementById('groupList').innerHTML = '';
    } else {
      // 重新渲染列表
      renderGroups();
    }
  } catch (err) {
    alert(`删除失败：${err.message}`);
  }
}

function downloadGroup(id) {
  window.open(`/api/download/${id}`, '_blank');
}

async function generateAll() {
  try {
    const result = await api('/generate', { method: 'POST' });

    // Download all files
    for (const [filename, content] of Object.entries(result.files)) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Delay to avoid browser blocking
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    alert('文件生成成功！');
  } catch (err) {
    alert(`生成失败：${err.message}`);
  }
}

// ==================== IP归属地查询 ====================

// IP归属地查询功能
document.getElementById('ipLookupButton').addEventListener('click', async () => {
  const input = document.getElementById('ipLookupInput');
  const resultDiv = document.getElementById('ipLookupResult');
  const value = input.value.trim();

  if (!value) {
    resultDiv.innerHTML = '<p style="color: #dc3545; margin: 0;">请输入IP地址或CIDR</p>';
    return;
  }

  resultDiv.innerHTML = '<p style="margin: 0; color: #6c757d;">查询中...</p>';

  try {
    // 判断是否为CIDR格式
    const isCIDR = value.includes('/');
    const endpoint = isCIDR ? `/api/lookup-cidr/${encodeURIComponent(value)}` : `/api/lookup/${value}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (response.ok) {
      const provinceCN = translateProvince(data.province);
      const cityCN = translateCity(data.city);

      // 构建简要信息（标题栏）
      const summaryParts = [
        escapeHtml(data.startIP || value),
        data.country ? escapeHtml(data.country) : '',
        provinceCN || '',
        cityCN || ''
      ].filter(p => p);
      const summary = summaryParts.join(' · ');

      // 构建分组信息HTML
      let groupsHTML = '';
      if (data.groups && data.groups.length > 0) {
        const groupTags = data.groups.map(g => {
          const ispLabel = g.isp ? ` - ${g.isp}` : ' - 所有运营商';
          return `<span style="display: inline-block; margin: 2px 4px 2px 0; padding: 5px 12px; background: #e3f2fd; color: #1565c0; border-radius: 4px; font-size: 13px; font-weight: 500;">
            ${escapeHtml(g.groupName)} (${g.origin}${ispLabel})
          </span>`;
        }).join('');

        groupsHTML = `
          <strong style="align-self: start; padding-top: 6px;">所在分组:</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${groupTags}
          </div>`;
      } else if (data.province && data.city) {
        groupsHTML = `<strong>所在分组:</strong> <span style="color: #9e9e9e; font-size: 13px;">未分配到任何分组</span>`;
      }

      resultDiv.innerHTML = `
        <div style="background: white; border-radius: 6px; border: 1px solid #dee2e6; overflow: hidden;">
          <!-- 标题栏（可点击） -->
          <div id="ipLookupHeader"
               style="padding: 12px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: background-color 0.2s;"
               onmouseover="this.style.backgroundColor='#f8f9fa'"
               onmouseout="this.style.backgroundColor='white'">
            <div style="flex: 1; font-size: 14px; font-weight: 500; color: #333;">
              ${summary}
            </div>
            <svg id="ipLookupArrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s; color: #6c757d;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <!-- 详细信息（可折叠） -->
          <div id="ipLookupDetails" style="max-height: 500px; overflow: hidden; transition: max-height 0.3s ease-out;">
            <div style="padding: 15px; border-top: 1px solid #e9ecef; background: #fafbfc;">
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 14px;">
                ${isCIDR ? `<strong>CIDR块:</strong> <span>${escapeHtml(value)}</span>` : ''}
                <strong>IP地址:</strong> <span>${escapeHtml(data.startIP || value)}</span>
                <strong>国家:</strong> <span>${escapeHtml(data.country)}</span>
                <strong>省份:</strong> <span>${provinceCN} <span style="color: #6c757d;">(${escapeHtml(data.province)})</span></span>
                <strong>城市:</strong> <span>${cityCN} <span style="color: #6c757d;">(${escapeHtml(data.city)})</span></span>
                <strong>运营商:</strong> <span>${escapeHtml(data.isp)}</span>
                ${groupsHTML}
                <strong>经纬度:</strong> <span>${escapeHtml(data.lngwgs)}, ${escapeHtml(data.latwgs)}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      // 添加折叠/展开功能
      const header = document.getElementById('ipLookupHeader');
      const details = document.getElementById('ipLookupDetails');
      const arrow = document.getElementById('ipLookupArrow');
      let isExpanded = true;

      header.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
          details.style.maxHeight = '500px';
          arrow.style.transform = 'rotate(0deg)';
        } else {
          details.style.maxHeight = '0';
          arrow.style.transform = 'rotate(-90deg)';
        }
      });
    } else {
      resultDiv.innerHTML = `<p style="color: #dc3545; margin: 0;">${escapeHtml(data.error)}</p>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color: #dc3545; margin: 0;">查询失败: ${escapeHtml(error.message)}</p>`;
  }
});

// 支持回车键查询
document.getElementById('ipLookupInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('ipLookupButton').click();
  }
});

// ==================== Utilities ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Initialization ====================

loadData();
