/**
 * GeoRouteGen - Common Utilities
 *
 * 中英文映射表和翻译函数
 * 被多个页面共享使用
 */

// ==================== 中英文映射 ====================

const provinceMap = {
  'Anhui': '安徽',
  'Beijing': '北京',
  'Chongqing': '重庆',
  'Fujian': '福建',
  'Gansu': '甘肃',
  'Guangdong': '广东',
  'Guangxi': '广西',
  'Guizhou': '贵州',
  'Hainan': '海南',
  'Hebei': '河北',
  'Heilongjiang': '黑龙江',
  'Henan': '河南',
  'Hubei': '湖北',
  'Hunan': '湖南',
  'Nei Mongol': '内蒙古',
  'Jiangsu': '江苏',
  'Jiangxi': '江西',
  'Jilin': '吉林',
  'Liaoning': '辽宁',
  'Ningxia': '宁夏',
  'Qinghai': '青海',
  'Shaanxi': '陕西',
  'Shandong': '山东',
  'Shanghai': '上海',
  'Shanxi': '山西',
  'Sichuan': '四川',
  'Tianjin': '天津',
  'Xizang': '西藏',
  'Xinjiang': '新疆',
  'Yunnan': '云南',
  'Zhejiang': '浙江',
  'Hong Kong': '香港',
  'Macau': '澳门',
  'Taiwan': '台湾'
};

const ispMap = {
  'China Telecom': '中国电信',
  'China Mobile': '中国移动',
  'China Unicom': '中国联通',
  'China TieTong': '中国铁通',
  'China Education and Research Network': '中国教育网',
  'China Broadcasting TV Net': '中国广电'
};

// 地理分区映射 - 按中国行政区划划分
const geoRegions = {
  '全部': null, // null 表示不过滤
  '华北': ['Beijing', 'Tianjin', 'Hebei', 'Shanxi', 'Inner Mongolia'],
  '东北': ['Liaoning', 'Jilin', 'Heilongjiang'],
  '华东': ['Shanghai', 'Jiangsu', 'Zhejiang', 'Anhui', 'Fujian', 'Jiangxi', 'Shandong'],
  '华南': ['Guangdong', 'Guangxi', 'Hainan'],
  '华中': ['Henan', 'Hubei', 'Hunan'],
  '西南': ['Chongqing', 'Sichuan', 'Guizhou', 'Yunnan', 'Tibet'],
  '西北': ['Shaanxi', 'Gansu', 'Qinghai', 'Ningxia', 'Xinjiang'],
  '港澳台': ['Hong Kong', 'Macau', 'Taiwan']
};

// 完整城市映射表 - 覆盖全国383个城市
const cityMap = {
  // 直辖市
  'Beijing': '北京市',
  'Beijing City': '北京市',
  'Shanghai': '上海市',
  'Shanghai City': '上海市',
  'Tianjin': '天津市',
  'Tianjin City': '天津市',
  'Chongqing': '重庆市',
  'Chongqing City': '重庆市',

  // 港澳台
  'Hong Kong': '香港',
  'Hongkong': '香港',
  'Macau': '澳门',
  'Macao': '澳门',
  'Taipei': '台北',
  'Taipei City': '台北市',
  'Kaohsiung': '高雄',
  'Kaohsiung City': '高雄市',
  'Taichung': '台中',
  'Taichung City': '台中市',
  'Tainan': '台南',
  'Tainan City': '台南市',

  // 安徽省
  'Hefei City': '合肥市',
  'Wuhu City': '芜湖市',
  'Bengbu City': '蚌埠市',
  'Huainan City': '淮南市',
  'Ma\'anshan City': '马鞍山市',
  'Huaibei City': '淮北市',
  'Tongling City': '铜陵市',
  'Anqing City': '安庆市',
  'Huangshan City': '黄山市',
  'Chuzhou City': '滁州市',
  'Fuyang City': '阜阳市',
  'Suzhou City': '宿州市',
  'Lu\'an City': '六安市',
  'Bozhou City': '亳州市',
  'Chizhou City': '池州市',
  'Xuancheng City': '宣城市',

  // 福建省
  'Fuzhou City': '福州市',
  'Xiamen City': '厦门市',
  'Putian City': '莆田市',
  'Sanming City': '三明市',
  'Quanzhou City': '泉州市',
  'Zhangzhou City': '漳州市',
  'Nanping City': '南平市',
  'Longyan City': '龙岩市',
  'Ningde City': '宁德市',

  // 甘肃省
  'Lanzhou City': '兰州市',
  'Jiayuguan City': '嘉峪关市',
  'Jinchang City': '金昌市',
  'Baiyin City': '白银市',
  'Tianshui City': '天水市',
  'Wuwei City': '武威市',
  'Zhangye City': '张掖市',
  'Pingliang City': '平凉市',
  'Jiuquan City': '酒泉市',
  'Qingyang City': '庆阳市',
  'Dingxi City': '定西市',
  'Longnan City': '陇南市',
  'Linxia Hui Autonomous Prefecture': '临夏回族自治州',
  'Gannan Tibetan Autonomous Prefecture': '甘南藏族自治州',

  // 广东省
  'Guangzhou City': '广州市',
  'Shenzhen City': '深圳市',
  'Zhuhai City': '珠海市',
  'Shantou City': '汕头市',
  'Foshan City': '佛山市',
  'Shaoguan City': '韶关市',
  'Zhanjiang City': '湛江市',
  'Zhaoqing City': '肇庆市',
  'Jiangmen City': '江门市',
  'Maoming City': '茂名市',
  'Huizhou City': '惠州市',
  'Meizhou City': '梅州市',
  'Shanwei City': '汕尾市',
  'Heyuan City': '河源市',
  'Yangjiang City': '阳江市',
  'Qingyuan City': '清远市',
  'Dongguan City': '东莞市',
  'Zhongshan City': '中山市',
  'Chaozhou City': '潮州市',
  'Jieyang City': '揭阳市',
  'Yunfu City': '云浮市',

  // 广西壮族自治区
  'Nanning City': '南宁市',
  'Liuzhou City': '柳州市',
  'Guilin City': '桂林市',
  'Wuzhou City': '梧州市',
  'Beihai City': '北海市',
  'Fangchenggang City': '防城港市',
  'Qinzhou City': '钦州市',
  'Guigang City': '贵港市',
  'Yulin City': '玉林市',
  'Baise City': '百色市',
  'Hezhou City': '贺州市',
  'Hechi City': '河池市',
  'Laibin City': '来宾市',
  'Chongzuo City': '崇左市',

  // 贵州省
  'Guiyang City': '贵阳市',
  'Liupanshui City': '六盘水市',
  'Zunyi City': '遵义市',
  'Anshun City': '安顺市',
  'Bijie City': '毕节市',
  'Tongren City': '铜仁市',
  'Qianxinan Buyei and Miao Autonomous Prefecture': '黔西南布依族苗族自治州',
  'Qiandongnan Miao and Dong Autonomous Prefecture': '黔东南苗族侗族自治州',
  'Qiannan Buyei and Miao Autonomous Prefecture': '黔南布依族苗族自治州',

  // 海南省
  'Haikou City': '海口市',
  'Sanya City': '三亚市',
  'Sansha City': '三沙市',
  'Danzhou City': '儋州市',
  'Wuzhishan City': '五指山市',
  'Qionghai City': '琼海市',
  'Wenchang City': '文昌市',
  'Wanning City': '万宁市',
  'Dongfang City': '东方市',
  'Dingan County': '定安县',
  'Tunchang County': '屯昌县',
  'Chengmai County': '澄迈县',
  'Lingao County': '临高县',
  'Baisha Li Autonomous County': '白沙黎族自治县',
  'Changjiang Li Autonomous County': '昌江黎族自治县',
  'Ledong Li Autonomous County': '乐东黎族自治县',
  'Lingshui Li Autonomous County': '陵水黎族自治县',
  'Baoting Li and Miao Autonomous County': '保亭黎族苗族自治县',
  'Qiongzhong Li and Miao Autonomous County': '琼中黎族苗族自治县',

  // 河北省
  'Shijiazhuang City': '石家庄市',
  'Tangshan City': '唐山市',
  'Qinhuangdao City': '秦皇岛市',
  'Handan City': '邯郸市',
  'Xingtai City': '邢台市',
  'Baoding City': '保定市',
  'Zhangjiakou City': '张家口市',
  'Chengde City': '承德市',
  'Cangzhou City': '沧州市',
  'Langfang City': '廊坊市',
  'Hengshui City': '衡水市',

  // 河南省
  'Zhengzhou City': '郑州市',
  'Kaifeng City': '开封市',
  'Luoyang City': '洛阳市',
  'Pingdingshan City': '平顶山市',
  'Anyang City': '安阳市',
  'Hebi City': '鹤壁市',
  'Xinxiang City': '新乡市',
  'Jiaozuo City': '焦作市',
  'Puyang City': '濮阳市',
  'Xuchang City': '许昌市',
  'Luohe City': '漯河市',
  'Sanmenxia City': '三门峡市',
  'Nanyang City': '南阳市',
  'Shangqiu City': '商丘市',
  'Xinyang City': '信阳市',
  'Zhoukou City': '周口市',
  'Zhumadian City': '驻马店市',
  'Jiyuan City': '济源市',

  // 黑龙江省
  'Harbin City': '哈尔滨市',
  'Qiqihar City': '齐齐哈尔市',
  'Jixi City': '鸡西市',
  'Hegang City': '鹤岗市',
  'Shuangyashan City': '双鸭山市',
  'Daqing City': '大庆市',
  'Yichun': '伊春市',
  'Jiamusi City': '佳木斯市',
  'Qitaihe City': '七台河市',
  'Mudanjiang City': '牡丹江市',
  'Heihe City': '黑河市',
  'Suihua City': '绥化市',
  'Daxing\'anling Prefecture': '大兴安岭地区',

  // 湖北省
  'Wuhan City': '武汉市',
  'Huangshi City': '黄石市',
  'Shiyan City': '十堰市',
  'Yichang City': '宜昌市',
  'Xiangyang City': '襄阳市',
  'Ezhou City': '鄂州市',
  'Jingmen City': '荆门市',
  'Xiaogan City': '孝感市',
  'Jingzhou City': '荆州市',
  'Huanggang City': '黄冈市',
  'Xianning City': '咸宁市',
  'Suizhou City': '随州市',
  'Enshi Tujia and Miao Autonomous Prefecture': '恩施土家族苗族自治州',
  'Xiantao City': '仙桃市',
  'Qianjiang City': '潜江市',
  'Tianmen City': '天门市',
  'Shennongjia Forestry District': '神农架林区',

  // 湖南省
  'Changsha City': '长沙市',
  'Zhuzhou City': '株洲市',
  'Xiangtan City': '湘潭市',
  'Hengyang City': '衡阳市',
  'Shaoyang City': '邵阳市',
  'Yueyang City': '岳阳市',
  'Changde City': '常德市',
  'Zhangjiajie City': '张家界市',
  'Yiyang City': '益阳市',
  'Chenzhou City': '郴州市',
  'Yongzhou City': '永州市',
  'Huaihua City': '怀化市',
  'Loudi City': '娄底市',
  'Xiangxi Tujia and Miao Autonomous Prefecture': '湘西土家族苗族自治州',

  // 吉林省
  'Changchun City': '长春市',
  'Jilin City': '吉林市',
  'Siping City': '四平市',
  'Liaoyuan City': '辽源市',
  'Tonghua City': '通化市',
  'Baishan City': '白山市',
  'Songyuan City': '松原市',
  'Baicheng City': '白城市',
  'Yanbian Korean Autonomous Prefecture': '延边朝鲜族自治州',

  // 江苏省
  'Nanjing City': '南京市',
  'Wuxi City': '无锡市',
  'Xuzhou City': '徐州市',
  'Changzhou City': '常州市',
  'Suzhou': '苏州市',
  'Nantong City': '南通市',
  'Lianyungang City': '连云港市',
  'Huai\'an City': '淮安市',
  'Yancheng City': '盐城市',
  'Yangzhou City': '扬州市',
  'Zhenjiang City': '镇江市',
  'Taizhou': '泰州市',
  'Suqian City': '宿迁市',

  // 江西省
  'Nanchang City': '南昌市',
  'Jingdezhen City': '景德镇市',
  'Pingxiang City': '萍乡市',
  'Jiujiang City': '九江市',
  'Xinyu City': '新余市',
  'Yingtan City': '鹰潭市',
  'Ganzhou City': '赣州市',
  'Ji\'an City': '吉安市',
  'Yichun City': '宜春市',
  'Fuzhou': '抚州市',
  'Shangrao City': '上饶市',

  // 辽宁省
  'Shenyang City': '沈阳市',
  'Dalian City': '大连市',
  'Anshan City': '鞍山市',
  'Fushun City': '抚顺市',
  'Benxi City': '本溪市',
  'Dandong City': '丹东市',
  'Jinzhou City': '锦州市',
  'Yingkou City': '营口市',
  'Fuxin City': '阜新市',
  'Liaoyang City': '辽阳市',
  'Panjin City': '盘锦市',
  'Tieling City': '铁岭市',
  'Chaoyang City': '朝阳市',
  'Huludao City': '葫芦岛市',

  // 内蒙古自治区
  'Hohhot City': '呼和浩特市',
  'Baotou City': '包头市',
  'Wuhai City': '乌海市',
  'Chifeng City': '赤峰市',
  'Tongliao City': '通辽市',
  'Ordos City': '鄂尔多斯市',
  'Hulun Buir City': '呼伦贝尔市',
  'Bayannur City': '巴彦淖尔市',
  'Ulanqab City': '乌兰察布市',
  'Hinggan League': '兴安盟',
  'Xilin Gol League': '锡林郭勒盟',
  'Alxa League': '阿拉善盟',

  // 宁夏回族自治区
  'Yinchuan City': '银川市',
  'Shizuishan City': '石嘴山市',
  'Wuzhong City': '吴忠市',
  'Guyuan City': '固原市',
  'Zhongwei City': '中卫市',

  // 青海省
  'Xining City': '西宁市',
  'Haidong City': '海东市',
  'Haibei Tibetan Autonomous Prefecture': '海北藏族自治州',
  'Huangnan Tibetan Autonomous Prefecture': '黄南藏族自治州',
  'Hainan Tibetan Autonomous Prefecture': '海南藏族自治州',
  'Golog Tibetan Autonomous Prefecture': '果洛藏族自治州',
  'Yushu Tibetan Autonomous Prefecture': '玉树藏族自治州',
  'Haixi Mongol and Tibetan Autonomous Prefecture': '海西蒙古族藏族自治州',

  // 山东省
  'Jinan City': '济南市',
  'Qingdao City': '青岛市',
  'Zibo City': '淄博市',
  'Zaozhuang City': '枣庄市',
  'Dongying City': '东营市',
  'Yantai City': '烟台市',
  'Weifang City': '潍坊市',
  'Jining City': '济宁市',
  'Tai\'an City': '泰安市',
  'Weihai City': '威海市',
  'Rizhao City': '日照市',
  'Linyi City': '临沂市',
  'Dezhou City': '德州市',
  'Liaocheng City': '聊城市',
  'Binzhou City': '滨州市',
  'Heze City': '菏泽市',

  // 山西省
  'Taiyuan City': '太原市',
  'Datong City': '大同市',
  'Yangquan City': '阳泉市',
  'Changzhi City': '长治市',
  'Jincheng City': '晋城市',
  'Shuozhou City': '朔州市',
  'Jinzhong City': '晋中市',
  'Yuncheng City': '运城市',
  'Xinzhou City': '忻州市',
  'Linfen City': '临汾市',
  'Luliang City': '吕梁市',

  // 陕西省
  'Xi\'an City': '西安市',
  'Tongchuan City': '铜川市',
  'Baoji City': '宝鸡市',
  'Xianyang City': '咸阳市',
  'Weinan City': '渭南市',
  'Yan\'an City': '延安市',
  'Hanzhong City': '汉中市',
  'Yulin': '榆林市',
  'Ankang City': '安康市',
  'Shangluo City': '商洛市',

  // 四川省
  'Chengdu City': '成都市',
  'Zigong City': '自贡市',
  'Panzhihua City': '攀枝花市',
  'Luzhou City': '泸州市',
  'Deyang City': '德阳市',
  'Mianyang City': '绵阳市',
  'Guangyuan City': '广元市',
  'Suining City': '遂宁市',
  'Neijiang City': '内江市',
  'Leshan City': '乐山市',
  'Nanchong City': '南充市',
  'Meishan City': '眉山市',
  'Yibin City': '宜宾市',
  'Guang\'an City': '广安市',
  'Dazhou City': '达州市',
  'Ya\'an City': '雅安市',
  'Bazhong City': '巴中市',
  'Ziyang City': '资阳市',
  'Aba Tibetan and Qiang Autonomous Prefecture': '阿坝藏族羌族自治州',
  'Garze Tibetan Autonomous Prefecture': '甘孜藏族自治州',
  'Liangshan Yi Autonomous Prefecture': '凉山彝族自治州',

  // 西藏自治区
  'Lhasa City': '拉萨市',
  'Shigatse City': '日喀则市',
  'Chamdo City': '昌都市',
  'Changdu City': '昌都市',
  'Lhoka Prefecture': '山南市',
  'Nagqu City': '那曲市',
  'Ngari Prefecture': '阿里地区',
  'Nyingchi City': '林芝市',

  // 新疆维吾尔自治区
  'Urumqi City': '乌鲁木齐市',
  'Karamay City': '克拉玛依市',
  'Turpan City': '吐鲁番市',
  'Hami City': '哈密市',
  'Changji Hui Autonomous Prefecture': '昌吉回族自治州',
  'Bortala Mongol Autonomous Prefecture': '博尔塔拉蒙古自治州',
  'Bayingolin Mongol Autonomous Prefecture': '巴音郭楞蒙古自治州',
  'Akesu Prefecture': '阿克苏地区',
  'Kizilsu Kyrgyz Autonomous Prefecture': '克孜勒苏柯尔克孜自治州',
  'Kashgar Prefecture': '喀什地区',
  'Hotan Prefecture': '和田地区',
  'Ili Kazakh Autonomous Prefecture': '伊犁哈萨克自治州',
  'Tacheng Prefecture': '塔城地区',
  'Altay Prefecture': '阿勒泰地区',
  'Shihezi City': '石河子市',
  'Alar City': '阿拉尔市',
  'Tumxuk City': '图木舒克市',
  'Wujiaqu City': '五家渠市',
  'Beitun City': '北屯市',
  'Tiemenguan City': '铁门关市',
  'Shuanghe City': '双河市',
  'Cocodala City': '可克达拉市',
  'Kunyu City': '昆玉市',
  'Huyanghe City': '胡杨河市',
  'Xinxing City': '新星市',

  // 云南省
  'Kunming City': '昆明市',
  'Qujing City': '曲靖市',
  'Yuxi City': '玉溪市',
  'Baoshan City': '保山市',
  'Zhaotong City': '昭通市',
  'Lijiang City': '丽江市',
  'Pu\'er City': '普洱市',
  'Lincang City': '临沧市',
  'Chuxiong Yi Autonomous Prefecture': '楚雄彝族自治州',
  'Honghe Hani and Yi Autonomous Prefecture': '红河哈尼族彝族自治州',
  'Wenshan Zhuang and Miao Autonomous Prefecture': '文山壮族苗族自治州',
  'Xishuangbanna Dai Autonomous Prefecture': '西双版纳傣族自治州',
  'Dali Bai Autonomous Prefecture': '大理白族自治州',
  'Dehong Dai and Jingpo Autonomous Prefecture': '德宏傣族景颇族自治州',
  'Nujiang Lisu Autonomous Prefecture': '怒江傈僳族自治州',
  'Diqing Tibetan Autonomous Prefecture': '迪庆藏族自治州',

  // 浙江省
  'Hangzhou City': '杭州市',
  'Ningbo City': '宁波市',
  'Wenzhou City': '温州市',
  'Jiaxing City': '嘉兴市',
  'Huzhou City': '湖州市',
  'Shaoxing City': '绍兴市',
  'Jinhua City': '金华市',
  'Quzhou City': '衢州市',
  'Zhoushan City': '舟山市',
  'Lishui City': '丽水市',
  'Taizhou City': '台州市',

  // 台湾地区其他城市/县
  'Changhua County': '彰化县',
  'Chiayi City': '嘉义市',
  'Chiayi County': '嘉义县',
  'Hsinchu City': '新竹市',
  'Hsinchu County': '新竹县',
  'Hualien County': '花莲县',
  'Keelung City': '基隆市',
  'Kinmen County': '金门县',
  'Lienchiang County': '连江县',
  'Miaoli County': '苗栗县',
  'Nantou County': '南投县',
  'Penghu County': '澎湖县',
  'Pingtung County': '屏东县',
  'Taichung County': '台中县',
  'Tainan County': '台南县',
  'Taipei County': '台北县',
  'New Taipei City': '新北市',
  'Taitung County': '台东县',
  'Taoyuan City': '桃园市',
  'Taoyuan County': '桃园县',
  'Yilan County': '宜兰县',
  'Yunlin County': '云林县',

  // 其他特殊格式的城市（不带转义撇号）
  "Daxing'anling Prefecture": '大兴安岭地区',
  "Ding'an County": '定安县',
  'Ganzi Tibetan Autonomous Prefecture': '甘孜藏族自治州',
  "Guang'an City": '广安市',
  "Huai'an City": '淮安市',
  'Hulunbuir City': '呼伦贝尔市',
  "Ji'an City": '吉安市',
  "Lu'an City": '六安市',
  'Lvliang City': '吕梁市',
  "Ma'anshan City": '马鞍山市',
  "Pu'er City": '普洱市',
  'Shannan City': '山南市',
  "Tai'an City": '泰安市',
  "Xi'an City": '西安市',
  'Xilingol League': '锡林郭勒盟',
  "Ya'an City": '雅安市',
  "Yan'an City": '延安市'
};

// ==================== 翻译函数 ====================

function translateProvince(province) {
  return provinceMap[province] || province;
}

function translateISP(isp) {
  return ispMap[isp] || isp;
}

function translateCity(city) {
  if (!city || city === '') return '省级（未定位城市）';

  // 先查映射表
  if (cityMap[city]) {
    return cityMap[city];
  }

  // 自动处理：去掉 " City" 后缀
  if (city.endsWith(' City')) {
    return city.replace(' City', '市');
  }

  // 处理 Prefecture
  if (city.includes('Prefecture')) {
    return city.replace(' Prefecture', '地区').replace(' Autonomous Prefecture', '自治州');
  }

  // 其他情况返回原文
  return city;
}
