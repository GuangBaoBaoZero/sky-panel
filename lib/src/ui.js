// ui.js — 星图面板 UI 源（手写）：原创模块化 Canvas 圆图 v1.9
// v1.8 功能清单：①双视图圆图（图①行星图=黄经坐标 28宿/十二辰/24节气/黄道/九体行星带；图②天顶图=地平坐标投影）
//       ②动画播放（1×/100×/1000× 虚拟时间推进，任意时间操作自动暂停）③天象事件日历（30 天日月食/21 对行星合/
//       冲日/水金大距，按日缓存）④20 项图层面板 ⑤键盘快捷键（J/K/N/M/D/F/H/Space/E/R+方向键）
//       ⑥悬停 tooltip + 行星详情卡（升/中/落时刻）⑦DSH CSS 变量双主题跟随 ⑧四象星官连线（业内独家）。
// 产物 client.js 由 build 生成（AE UMD 挂 window.Astronomy + 知识层挂 window.__sky_knowledge__，均先于本工厂执行）。
// 本文件 100% 原创绘制层（不复制任何第三方绘制代码；早期复刻版仅保留在 git 历史可回退）。
// 设计：天文仪器面板——720×720 设计坐标系圆图（十二辰 r340 / 28宿 r310 / 24节气 r280 / 黄道 r250 / 行星带 150-240 / 中心 r<100）；
//       渲染：canvas backing 随显示尺寸×devicePixelRatio 动态（resizeTo + setTransform 等比映射 720→设备像素——原生分辨率渲染，任何侧栏宽度文字清晰）；
//       底色零自定义——容器背景 = DSH CSS 变量（--dsw-alias-bg-*），文字/刻度色每帧读 --dsw-alias-label-*，双主题自动跟随；
//       黄经统一坐标轴：冬至 270° = 正下，黄经增 = 逆时针（天左旋）；
//       模块化绘制函数族（每函数一个视觉元素，可独立开关）+ redraw() 统一入口。
// v1.6（Gannzilla 借鉴）：①四象星官连线（七宿距星弧线 r284 四色——业内独家）②行星详情卡（点击弹出：
//       黄经度分秒/入宿/距离百分比/顺逆/升中落时刻——AE SearchRiseSet+SearchHourAngle，观测地=位置面板 getPosition）③视觉升级：
//       十二辰柔和色带环（六方位色 35% 透明度）/行星纯色平面圆点（v1.6 渐变球已回退）/行星相位连线语义分色（合金/冲红/三合绿）。
// v1.7：①动画播放（▶ 100ms 节拍虚拟时间推进 1×/100×/1000×，与实时互斥，任意时间操作自动暂停）
//       ②天象事件日历（未来 30 天：日月食 SearchLunarEclipse/SearchGlobalSolarEclipse + 行星合 21 对黄经差跨 0 二分细化
//       + 冲日跨 ±180 + 水金大距日采样极大；localStorage 按日缓存）③图②天顶图（地平坐标投影：N 上 E 左、
//       天顶圆心/地平圈 r340、可见性着色（地下灰）、N/E/S/W 十字+30° 方位刻度、民用/航海/天文晨昏蒙影三虚线圆；
//       观测位置默认北京可经「位置」面板改经纬度+城市预设，持久化 localStorage）。
// 保留机制（数据/引擎层）：命名星补丁（AE Star 槽轮转）、宿度差值法、顺逆行回溯、内置 AE 农历（lunarText）、
//       实时 1s/暂停恢复、键盘（tabIndex=0）、图层面板 14 项、悬停 tooltip。
// v1.9：①六段时刻输入行（年月日时分秒分段点击编辑，各段钳制；年开放公元前 B 前缀、下限 -7000）
//       ②±时间三件套 −[单位▾]＋（分/时/日/月/年自造下拉）③自造下拉 SkyDrop（DSH 原生同款：无边框菜单+
//       阴影+Lucide chevron——弃原生 select）④Lucide 图标体系（播放/实时/现在/位置/事件按钮两态）
//       ⑤升/中/落时刻观测地跟随位置面板 getPosition（原硬编码北京——事件缓存键含经纬度，位置变更自动重算）。
window.__ModuleLoader__.load({
	id: "dsh-sky-panel",
	factory: function (require) {
		var React = require("react");
		var module = { exports: {} };
		var exports = module.exports;
		var createElement = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;
		var useRef = React.useRef;
		var useLayoutEffect = React.useLayoutEffect || React.useEffect;   // 无 layoutEffect 环境回退 passive（防闪帧）

		var PANEL_ID = "dsh-sky-panel";
		var KIND = "sky-panel";
		var Astro = window.Astronomy;
		var K = window.__sky_knowledge__;

		// ════════════════════════════════════════════════════════════════
		// §1 布局与色彩常量（原创设计规格——v1.5§2.4）
		// ════════════════════════════════════════════════════════════════
		var SIZE = 720;                 // 设计基准边长（backing=显示尺寸×DPR 动态，经 setTransform 等比映射——见 resizeTo）
		var CX = 360, CY = 360;         // 圆心
		var R_BRANCH = 340;             // 十二辰外圈
		var R_XIU = 310;                // 28 宿圈
		var R_JIEQI = 280;              // 24 节气圈
		var R_ECLIPTIC = 250;           // 黄道圈（行星带外缘基准）
		var R_PLANET_IN = 150;          // 行星带内缘
		var R_CENTER = 100;             // 中心信息区半径

		// 行星半径带（150-234 等距 10.5 步进 9 体：月亮最内贴近地心，太阳最内贴黄道圈但标注不越节气名圈）
		var R_BAND = {
			'月亮': 150, '水星': 160.5, '金星': 171, '火星': 181.5,
			'木星': 192, '土星': 202.5, '天王星': 213, '海王星': 223.5, '太阳': 234
		};
		// 行星色（固定 RGB 功能色——IBM Carbon 科学色板口径，不随主题变）
		var P_COLOR = {
			'太阳': '#FFB300', '月亮': '#E0E0E0', '水星': '#9E9E9E', '金星': '#FFD54F',
			'火星': '#EF5350', '木星': '#FF8A65', '土星': '#FFCA28', '天王星': '#4DD0E1', '海王星': '#42A5F5'
		};
		// 行星点半径（px）
		var P_SIZE = { '太阳': 9, '月亮': 8.5, '水星': 4, '金星': 6, '火星': 5.5, '木星': 8, '土星': 7, '天王星': 5, '海王星': 5 };
		// 行星拉丁名（tooltip）
		var P_LATIN = {
			'太阳': 'Sun', '月亮': 'Moon', '水星': 'Mercury', '金星': 'Venus', '火星': 'Mars',
			'木星': 'Jupiter', '土星': 'Saturn', '天王星': 'Uranus', '海王星': 'Neptune'
		};
		var LATIN2CN = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星' };
		var PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

		var ZHI = '子丑寅卯辰巳午未申酉戌亥';
		var GAN = '甲乙丙丁戊己庚辛壬癸';
		// 节气名按黄经增序（冬至 270° 起，每 15° 一气）
		var JIEQI = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏',
			'小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露',
			'霜降', '立冬', '小雪', '大雪'];
		// 黄道十二宫（黄经 0° 起，每 30° 一宫——行星标注用）
		var GONG = ['白羊', '金牛', '双子', '巨蟹', '狮子', '室女', '天秤', '天蝎', '人马', '摩羯', '宝瓶', '双鱼'];
	// 四象分组（宿序 0-27：青龙 0-6 / 玄武 7-13 / 白虎 14-20 / 朱雀 21-27）——低饱和四色适配双主题
	var XIANG_COLOR = ['#3FA796', '#5B8DEF', '#B0723C', '#C05780'];
	// ── （v1.6）新增常量 ──
	// 四象星官连线弧半径：宿名层内走廊（宿名 r293 字域 287-299 / 24节气圈 r280——284 居中不压字）
	var R_XLINE = R_XIU - 26;      // = 284
	// 四象连线色（35% 饱和度：苍龙青绿 / 玄武深蓝 / 白虎金白 / 朱雀红橙）
	var XIANG_NAME = ['青龙', '玄武', '白虎', '朱雀'];
	var XLINE_COLOR = { '青龙': '#4FA79A', '玄武': '#7288BE', '白虎': '#C8B888', '朱雀': '#C99A8B' };
	// 十二辰色带环六方位色（v1.6 规格：子丑深蓝 / 寅卯绿 / 辰巳青 / 午未红 / 申酉金 / 戌亥紫——35% 透明度铺带）
	var BRANCH_BAND = ['#5C7CFA', '#51CF66', '#66D9E8', '#FF6B6B', '#FFD43B', '#B197FC'];
	// 行星相位连线语义色（合=金 / 冲=红 / 三合=绿）与容许度
	var ASPECT_COLOR = { '合': '#FFD43B', '冲': '#FF6B6B', '三合': '#51CF66' };
	var ASPECT_ORB = 3;
	// 行星天文符号（详情卡标题）
	var P_SYMBOL = { '太阳': '☉', '月亮': '☽', '水星': '☿', '金星': '♀', '火星': '♂', '木星': '♃', '土星': '♄', '天王星': '♅', '海王星': '♆' };
	// 地心距离界（近点↔远点 百分比分母）：日月用真实地心近远点界；行星由知识层日心界推地心界
	// （内行星 [1-a_max, 1+a_min] 下合↔上合 / 外行星 [a_min-1, a_max+1] 冲↔合）
	var GEO_BOUNDS = {
		'Sun': [0.98329, 1.01709],
		'Moon': [0.0023824, 0.0027186]
	};
	(function () {
		for (var b in K.PLANET_DIST) {
			var pd = K.PLANET_DIST[b];
			GEO_BOUNDS[b] = pd.max < 1 ? [1 - pd.max, 1 + pd.min] : [pd.min - 1, pd.max + 1];
		}
	})();
		var FONT_MONO = 'ui-monospace, Consolas, "Courier New", monospace';

		// ════════════════════════════════════════════════════════════════
		// §2 命名星解析补丁（vendor AE 兼容层——引擎段保留，机制不变）
		// ════════════════════════════════════════════════════════════════
		// vendor AE 只提供 Star1-8 八个用户槽，而本面板需命名 28 宿距星 + 北斗 + 亮星（>8 颗）。
		// 补丁：所有命名星（含 Star1-8 名）一律存自定义表，查询时轮转占用 Star1-8 槽（定义+查询原子完成，
		// 用即弃）——Star1-8 禁直通 native：直通会被 Star9+ 的轮转定义覆盖拿到脏数据（宿星错位）。
		(function patchStarSlots() {
			var nativeDefineStar = Astro.DefineStar;
			var nativeEquator = Astro.Equator;
			var nativeGeoVector = Astro.GeoVector;
			var nativeEclipticLongitude = Astro.EclipticLongitude;
			var custom = {};   // 名 -> [ra, dec, distLightYears]
			var slotSeq = 0;
			function resolve(body) {
				if (typeof body === 'string' && Object.prototype.hasOwnProperty.call(custom, body)) {
					slotSeq = (slotSeq % 8) + 1;
					var slot = 'Star' + slotSeq;
					var d = custom[body];
					nativeDefineStar(slot, d[0], d[1], d[2]);
					return slot;
				}
				return body;
			}
			Astro.DefineStar = function (body, ra, dec, distanceLightYears) {
				custom[body] = [ra, dec, distanceLightYears];
			};
			Astro.Equator = function (body, date, observer, ofdate, aberration) {
				return nativeEquator(resolve(body), date, observer, ofdate, aberration);
			};
			Astro.GeoVector = function (body, date, aberration) {
				return nativeGeoVector(resolve(body), date, aberration);
			};
			Astro.EclipticLongitude = function (body, date) {
				return nativeEclipticLongitude(resolve(body), date);
			};
		})();

		// ════════════════════════════════════════════════════════════════
		// §3 持久化（settings 12 项图层 / 观测地——localStorage，键加插件前缀）
		// ════════════════════════════════════════════════════════════════
		var LS_SETTINGS = 'dsh-sky-panel-settings';
		var LS_POSITION = 'dsh-sky-panel-position';
	var DEFAULT_SETTINGS = {
		twelveBranches: true,   // 十二辰外圈（v1.6 含六方位色带环）
		showBranchColors: true, // 十二辰色带（关=只留圈线刻度+辰名）
		fineTicksBranches: true,  // 十二辰 1° 细刻度（外圈内侧短线）
		fineTicksXiu: false,      // 28 宿圈 1° 细刻度
		fineTicksJieqi: false,    // 节气圈 1° 细刻度
		fineTicksEcliptic: false, // 黄道圈 1° 细刻度
		zodiacNames: true,      // 十二辰名（关=只留刻度）
		xiuRing: true,          // 28 宿圈
		xiangLines: true,       // 四象星官连线（七宿距星弧线四色）
		xiuWidths: false,       // 宿度数字
		jieqiRing: true,        // 24 节气圈
		eclipticRing: true,     // 黄道圈
		planetOrbits: false,    // 行星轨道同心圆
		aspectLines: true,      // 行星相位连线（合金/冲红/三合绿）
		planetLabels: true,     // 行星标注
		showZodiacLabel: true,  // 行星标注中的星座名（关=只显示名称+逆行）
		retroMark: true,        // 逆行标记
		moonPhase: true,        // 月相 glyph（terminator 弧线）
		centerInfo: true,       // 中心时间/农历
		centerCross: true       // 中心地心标
	};
		var DEFAULT_POSITION = { latitude: 39.9, longitude: 116.4, altitude: 44 };
		// 观测地预设（位置设置面板下拉——图②天顶图与悬停地平读数共用）
		var POS_PRESETS = [
			['北京', 39.90, 116.40, 44], ['上海', 31.23, 121.47, 10], ['广州', 23.13, 113.26, 20],
			['成都', 30.57, 104.07, 500], ['西安', 34.34, 108.94, 400]
		];

		function loadJSON(key, fallback) {
			try {
				var raw = localStorage.getItem(key);
				if (!raw) return fallback;
				var v = JSON.parse(raw);
				return (v && typeof v === 'object') ? v : fallback;
			} catch (e) { return fallback; }
		}
		function loadSettings() {
			var saved = loadJSON(LS_SETTINGS, null);
			var s = {};
			for (var k in DEFAULT_SETTINGS) {
				s[k] = (saved && saved.s && k in saved.s) ? !!saved.s[k] : DEFAULT_SETTINGS[k];
			}
			return { s: s };
		}

		// ════════════════════════════════════════════════════════════════
		// §4 引擎段：天文数据计算（保留机制——宿度差值法/顺逆行回溯/时角）
		// ════════════════════════════════════════════════════════════════
		var R_YEAR = 365.25;

		// 28 宿距星 J2000 赤经（知识层——星表验证版，替代旧静态表：数据来源独立化）
		var x28cjJ2000 = K.X28_STARS.map(function (s) { return s.ra * 3600; });
		var x28n = K.X28_NAMES;

		// 宿界宽（赤经差 → 度日），基准数组 = 距星赤经秒值
		function xiuBoundsFrom(raSec) {
			var a = [];
			for (var z = 0; z < 28; z++) {
				var next = (z + 1) % 28;
				var ff = raSec[next] - raSec[z];
				if (ff < 0) ff += 24 * 3600;
				a.push(ff / (24 * 3600) * R_YEAR);
			}
			return a;
		}

		// 入宿度：赤经 → {宿 idx, 度数 du, 四象 xiang}
		function xiuOfRA(raHours, bounds, raSec) {
			var ra = raHours;
			while (ra > 24) ra -= 24;
			while (ra < 0) ra += 24;
			var a = ra * 3600 - raSec[0];
			if (a < 0) a += 24 * 3600;
			a = a / (24 * 3600) * R_YEAR;
			var idx = 0, sum = 0;
			for (var i = 0; i < bounds.length; i++) {
				if (bounds[i] + sum > a) break;
				sum += bounds[i];
				idx += 1;
			}
			var xiang = '青龙';
			if (idx >= 7 && idx <= 13) xiang = '玄武';
			else if (idx >= 14 && idx <= 20) xiang = '白虎';
			else if (idx >= 21) xiang = '朱雀';
			return { idx: idx, xiang: xiang, du: (a - sum).toFixed(2) };
		}

		// 顺逆行：今日 vs 昨日赤经差判顺行；逆行则回溯到逆行起点（≤365 天）
		function getRetrogradeState(body, observer, now) {
			if (body === 'Sun' || body === 'Moon') return { state: 1 };
			function pureDate(d) { var dd = new Date(d); dd.setHours(0); dd.setMinutes(0); dd.setSeconds(0); return dd; }
			var nn = pureDate(now);
			var ytd = new Date(nn); ytd.setDate(ytd.getDate() - 1);
			var equToday = Astro.Equator(body, nn, observer, true, true);
			var equ = Astro.Equator(body, ytd, observer, true, true);
			var diff = equToday.ra - equ.ra;
			if ((diff > 0 && diff < 1) || diff < -23) return { state: 1 };  // 顺行（春分点附近跨界容错）
			var last = equToday.ra;
			var today = new Date(nn);
			for (var i = 1; i < 365; i++) {
				today.setDate(today.getDate() - 1);
				equ = Astro.Equator(body, today, observer, true, true);
				diff = equ.ra - last;
				if ((diff < 0 && diff > -1) || diff > 23) return { state: 0, days: i - 1 };
				last = equ.ra;
			}
			return { state: 1 };
		}

		function formatHourDeg(h) {
			var hour = parseInt(h, 10);
			var minute = (h - hour) * 60;
			var sec = (minute - parseInt(minute, 10)) * 60;
			minute = '' + parseInt(minute, 10);
			var rest = sec - parseInt(sec, 10);
			sec = '' + parseInt(sec, 10);
			function pad(s, w) { while (s.length < w) s = '0' + s; return s; }
			return pad('' + hour, 2) + ':' + pad(minute, 2) + ':' + pad(sec, 2) + rest.toFixed(2).replace(/^0/, '');
		}

	// 黄经 → 度分秒
	function lonDMS(lon) {
		var d = Math.floor(lon);
		var mFull = (lon - d) * 60;
		var m = Math.floor(mFull);
		var s = Math.round((mFull - m) * 60);
		if (s === 60) { s = 0; m += 1; }
		if (m === 60) { m = 0; d += 1; }
		function pad(x) { return (x < 10 ? '0' : '') + x; }
		return d + '°' + pad(m) + '′' + pad(s) + '″';
	}

	// ── ：相位连线 / 详情卡数据 ──

		/**
		 * 行星相位对查找：黄经差 0°=合 / 180°=冲 / 120°(240°)=三合（容许度 ±3°）——纯函数（verify 可测）。
		 * @param {Array<{key: string, elon: number}>} planets 行星行（含黄经）
		 * @returns {Array<{type: string, a: string, b: string, sep: number}>} 相位列表（type∈{'合','冲','三合'}，sep=折叠后黄经差）
		 */
		function findAspects(planets) {
		var out = [];
		for (var i = 0; i < planets.length; i++) {
			for (var j = i + 1; j < planets.length; j++) {
				var d = Math.abs(planets[i].elon - planets[j].elon) % 360;
				if (d > 180) d = 360 - d;
				var type = null;
				if (d <= ASPECT_ORB) type = '合';
				else if (Math.abs(d - 180) <= ASPECT_ORB) type = '冲';
				else if (Math.abs(d - 120) <= ASPECT_ORB) type = '三合';   // 240° 折叠后与 120° 同一档
				if (type) out.push({ type: type, a: planets[i].key, b: planets[j].key, sep: d });
			}
		}
		return out;
	}

	// 今日升/中/落时刻（观测地=位置面板 getPosition，时区仍按本地 +8 口径）：本地零时起前搜，AE 修正大气折射与视差
	function fmtHM(d) {
		function p(x) { return (x < 10 ? '0' : '') + x; }
		return p(d.getHours()) + ':' + p(d.getMinutes());
	}
	function computeEvents(bodyKey, now, position) {
		var obs = new Astro.Observer(position.latitude, position.longitude, position.altitude || 0);
		var mid = new Date(now);
		mid.setHours(0); mid.setMinutes(0); mid.setSeconds(0); mid.setMilliseconds(0);
		var out = { rise: null, transit: null, set: null };
		try {
			var r = Astro.SearchRiseSet(bodyKey, obs, +1, mid, 2);
			if (r) out.rise = fmtHM(r.date);
		} catch (e) { }
		try {
			var s = Astro.SearchRiseSet(bodyKey, obs, -1, mid, 2);
			if (s) out.set = fmtHM(s.date);
		} catch (e) { }
		try {
			var t = Astro.SearchHourAngle(bodyKey, obs, 0, mid);
			if (t && t.time) out.transit = fmtHM(t.time.date);
		} catch (e) { }
		return out;
	}

	// 详情卡数据组装（行星行 + 时刻 → 卡片对象）
	function buildCard(row, events) {
		var b = GEO_BOUNDS[row.key] || [0, 1];
		var pct = (row.dist - b[0]) / (b[1] - b[0]) * 100;
		if (pct < 0) pct = 0;
		if (pct > 100) pct = 100;
		return {
			key: row.key, cn: row.cn, latin: P_LATIN[row.cn], symbol: P_SYMBOL[row.cn], color: P_COLOR[row.cn],
			elon: row.elon, elonDMS: lonDMS(row.elon), gong: GONG[Math.floor(row.elon / 30) % 12],
			xiu: x28n[row.xiuIdx], du: row.du, xiang: row.xiang,
			elat: row.elat, dist: row.dist, distPct: Math.round(pct),
			mag: row.mag, retro: row.retro.state === 0, retroDays: row.retro.days || 0, timeAngle: row.timeAngle,
			elong: row.elong != null ? row.elong : null, illum: row.illum != null ? row.illum : null,
			rise: events.rise, transit: events.transit, set: events.set
		};
	}

	// 恒星定义（知识层驱动——28 宿距星 + 北斗七星 + 11 亮星，经命名星补丁入自定义表）
		function initStars() {
			K.X28_STARS.forEach(function (s, i) {
				Astro.DefineStar('Star' + (i + 1), s.ra, s.dec, 100);
			});
			// 北斗七星（天枢…摇光）
			var bd = [
				[11 + 3.759 / 60, 61 + 44.882 / 60, 123.64],   // 天枢
				[11 + 1.877 / 60, 56 + 22.722 / 60, 79.74],    // 天璇
				[11 + 53.858 / 60, 53 + 41.425 / 60, 83.18],   // 天玑
				[12 + 15.451 / 60, 57 + 1.692 / 60, 80.51],    // 天权
				[12 + 54.050 / 60, 55 + 57.295 / 60, 82.55],   // 玉衡
				[13 + 23.942 / 60, 54 + 55.210 / 60, 78.16],   // 开阳
				[13 + 47.541 / 60, 49 + 18.473 / 60, 103.94]   // 摇光
			];
			bd.forEach(function (d, i) { Astro.DefineStar('BD' + (i + 1), d[0], d[1], d[2]); });
			K.BRIGHT_STARS.forEach(function (s) {
				Astro.DefineStar('BS_' + s.name, s.ra, s.dec, 100);
			});
		}

		/**
		 * 一帧天象数据：9 体行星 + 28 宿距星黄经/赤经 + 宿界（绘制与详情卡的统一数据源）。
		 * @param {Date} now 时刻
		 * @param {{latitude: number, longitude: number, altitude: number}} position 观测地
		 * @returns {{planets: Array<Object>, starsLon: number[], starsRA: number[], xiuBounds: number[], lunar: string}}
		 *   planets 行含 elon 黄经/elat 黄纬/ra/dec/dist AU/alt/az 地平/retro 顺逆/xiuIdx 入宿序/xiang 四象/du 入宿度/
		 *   timeAngle 时角/mag 星等；月亮另含 elong 距日黄经差与 illum 照亮比
		 */
		function computeSky(now, position) {
			var observer = new Astro.Observer(position.latitude, position.longitude, position.altitude);
			var out = { planets: [], starsLon: [], starsRA: [], lunar: '' };
			// 28 宿距星：of-date 赤经（宿度基准）+ 黄经（绘制统一轴）
			for (var i = 1; i <= 28; i++) {
				var eq = Astro.Equator('Star' + i, now, observer, true, true);
				out.starsRA.push(eq.ra * 3600);
				out.starsLon.push(((Astro.EclipticLongitude('Star' + i, now) % 360) + 360) % 360);
			}
			var bounds = xiuBoundsFrom(out.starsRA);
			out.xiuBounds = bounds;
			for (var p = 0; p < PLANET_ORDER.length; p++) {
				var body = PLANET_ORDER[p];
				var cn = LATIN2CN[body];
			var gv = Astro.GeoVector(body, now, true);
				var ecl = Astro.Ecliptic(gv);
				var equOfDate = Astro.Equator(body, now, observer, true, true);
				var equJ2000 = Astro.Equator(body, now, observer, false, true);
				var hor = Astro.Horizon(now, observer, equJ2000.ra, equJ2000.dec, 'normal');
				var row = {
					key: body, cn: cn,
					elon: ((ecl.elon % 360) + 360) % 360,
					elat: ecl.elat,
					ra: equOfDate.ra, dec: equOfDate.dec,
					dist: Math.sqrt(gv.x * gv.x + gv.y * gv.y + gv.z * gv.z),
					alt: hor.altitude, az: hor.azimuth,
					retro: getRetrogradeState(body, observer, now),
					timeAngle: formatHourDeg(Astro.HourAngle(body, now, observer)),
					mag: null
				};
				try { row.mag = Astro.Illumination(body, now).mag; } catch (e) { }
				if (body === 'Moon') {
					row.elong = ((Astro.PairLongitude('Moon', 'Sun', now) % 360) + 360) % 360;  // 0=朔 90=上弦 180=望 270=下弦
					row.illum = (1 - Math.cos(row.elong * Math.PI / 180)) / 2;
				}
				var xo = xiuOfRA(row.ra, bounds, out.starsRA);
				row.xiuIdx = xo.idx; row.xiang = xo.xiang; row.du = xo.du;
				out.planets.push(row);
			}
			return out;
		}

		// ════════════════════════════════════════════════════════════════
		// §5 内置农历（AE 朔/中气定气算法——引擎段保留，433 样本 golden 全对）
		// ════════════════════════════════════════════════════════════════
		// 规则：朔望月分月；冬至所在月=十一月（建子）；无中气之月=闰月；日界东八区。
		// 输出："干支年[闰]月名日名"（面板取 replace(/.*年/,'') 的月日部分）。
		var DAY_MS = 86400000;
		var CN_DAY = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
			'十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
			'廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
		var CN_MON = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
		var GAN_C = '甲乙丙丁戊己庚辛壬癸';
		var ZHI_C = '子丑寅卯辰巳午未申酉戌亥';
		var lunarCache = {};

		function newMoonAfter(ms) {
			var t = Astro.SearchMoonPhase(0, new Date(ms), 40);
			return t ? +t.date : null;
		}
		// ms 前最近的朔：33 天窗口可能含两个朔，须推进取 ≤ms 的最后一个
		function prevNewMoon(ms) {
			var t = Astro.SearchMoonPhase(0, new Date(ms - 33 * DAY_MS), 36);
			if (!t) return null;
			var last = +t.date;
			var nt = Astro.SearchMoonPhase(0, new Date(last + 1), 36);
			while (nt && +nt.date <= ms) {
				last = +nt.date;
				nt = Astro.SearchMoonPhase(0, new Date(last + 1), 36);
			}
			return last;
		}
		// 中气=太阳视黄经 30° 整倍数（冬至270/大寒300/雨水330/春分0/…）
		function nextZhongQi(prevMs, prevTarget) {
			var target = (prevTarget + 30) % 360;
			var t = Astro.SearchSunLongitude(target, new Date(prevMs + 5 * DAY_MS), 40);
			return t ? +t.date : null;
		}
		// ≤ms 的最近冬至（日历锚定 12-21±1 + ±10 天小窗精搜——长窗口 SearchSunLongitude 会跳解）
		function dongZhiBefore(ms) {
			var y = new Date(ms + 8 * 3600e3).getUTCFullYear();
			var guess = Date.UTC(y, 11, 21) - 8 * 3600e3;
			if (guess > ms) guess = Date.UTC(y - 1, 11, 21) - 8 * 3600e3;
			var t = Astro.SearchSunLongitude(270, new Date(guess - 10 * DAY_MS), 20);
			if (!t) return null;
			var dz = +t.date;
			return dz <= ms ? dz : null;
		}

		function lunarText(date) {
			try {
				var day0 = Math.floor((+date + 8 * 3600e3) / DAY_MS);
				if (day0 in lunarCache) return lunarCache[day0];
				function dayIdxOf(ms) { return Math.floor((ms + 8 * 3600e3) / DAY_MS); }
				function dayEndMsOf(day) { return (day + 1) * DAY_MS - 8 * 3600e3 - 1; }

				// 1. 当前月：朔日 ≤ day0 的最近朔；日序差 = 日名
				var s1ms = prevNewMoon(dayEndMsOf(day0));
				if (s1ms == null) return '';
				var s1day = dayIdxOf(s1ms);
				var dayNum = day0 - s1day + 1;
				if (dayNum < 1 || dayNum > 30) return '';
				var s2ms = newMoonAfter(s1ms + 1);
				if (s2ms == null) return '';
				var s2day = dayIdxOf(s2ms);

				// 2. 冬至日与冬至月朔日（建子=十一月）
				var dzMs = dongZhiBefore(dayEndMsOf(day0));
				if (dzMs == null) return '';
				var dzDay = dayIdxOf(dzMs);
				var sDms = prevNewMoon(dayEndMsOf(dzDay));
				if (sDms == null) return '';
				var sDday = dayIdxOf(sDms);
				if (sDday > s1day) return '';

				// 3. 朔日序列（反向逐月）与中气日序列（冬至日 → 覆盖到下朔日）
				var shuoDays = [s1day];
				var guard = 0;
				while (shuoDays[0] > sDday && guard++ < 20) {
					var pm = prevNewMoon(dayEndMsOf(shuoDays[0] - 1));
					if (pm == null) return '';
					shuoDays.unshift(dayIdxOf(pm));
				}
				if (shuoDays[0] > sDday) return '';
				shuoDays.push(s2day);
				if (shuoDays.length > 20) return '';
				var zqDays = [];
				var zt = dzMs, ztarget = 270;
				var zDay = dzDay;
				while (zDay < s2day) {
					zqDays.push(zDay);
					zt = nextZhongQi(zt, ztarget);
					ztarget = (ztarget + 30) % 360;
					if (zt == null) return '';
					zDay = dayIdxOf(zt);
				}

				// 4. 从冬至月（十一月）逐月推进：中气日 ∈ [本月朔日, 下月朔日) → 正常月；无中气 → 闰
				var monthIdx = 11, isLeap = false, zqPtr = 1;
				var mi = 0;
				for (; mi < shuoDays.length - 1; mi++) {
					if (mi > 0) {
						if (zqPtr < zqDays.length && zqDays[zqPtr] < shuoDays[mi + 1]) {
							monthIdx = (monthIdx % 12) + 1;
							isLeap = false;
							zqPtr++;
						} else {
							isLeap = true;
						}
					}
					if (shuoDays[mi] === s1day) break;
				}
				if (mi >= shuoDays.length - 1) return '';

				// 5. 年干支
				var gzYear = new Date(dzMs).getFullYear() + 1;
				var gz = GAN_C[(gzYear - 4) % 10] + ZHI_C[(gzYear - 4) % 12];
				var out = gz + '年' + (isLeap ? '闰' : '') + CN_MON[monthIdx] + '月' + CN_DAY[dayNum - 1];
				lunarCache[day0] = out;
				return out;
			} catch (e) {
				return '';
			}
		}

	// 天象事件日历（）：未来 30 天日月食/行星合/冲日/大距——纯函数（verify 可测），localStorage 按日缓存
	// 黄经差符号翻转法：逐日采样 PairLongitude 差值，跨 0°（合）或 180°（冲）即二分细化到分钟
	function sepOf(bodyA, bodyB, date) {
		var d = Astro.PairLongitude(bodyA, bodyB, date) % 360;
		if (d > 180) d -= 360;   // 折叠到 (-180,180]：0=合 -180/180=冲
		return d;
	}
	function refineCross(fn, t0, t1) {   // fn 在 [t0,t1] 内变号 → 二分 60 秒精度
		var a = fn(t0), b = fn(t1);
		if (a === 0 || b === 0 || a > 0 === b > 0) return null;
		var lo = t0, hi = t1;
		while (hi - lo > 60000) {
			var mid = (lo + hi) / 2;
			var m = fn(mid);
			if (m === 0) return mid;
			if (m > 0 === a > 0) { lo = mid; } else { hi = mid; }
		}
		return (lo + hi) / 2;
	}
	function fmtEvent(d) {
		function p(x) { return (x < 10 ? '0' : '') + x; }
		return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
	}
	var EV_BODIES = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
	/**
	 * 天象事件日历（）：未来 30 天日月食/行星合（21 对）/冲日（5 外行星）/水金大距——纯函数（verify 可测）。
	 * 黄经差符号翻转法：逐日采样 PairLongitude 差值，跨 0°（合）或 180°（冲）二分细化到分钟。
	 * @param {Date} now 起点
	 * @returns {Array<{ms: number, type: string, text: string, when: string}>} 按 ms 升序的事件列表
	 *   （type∈{'月食','日食','行星合','冲日','大距'}；when='MM-DD HH:mm' 本地时刻）
	 */
	function computeEvents30(now) {
		var t0 = +now, t1 = t0 + 30 * DAY_MS, out = [];
		var ev;
		try {   // 月食：SearchLunarEclipse 从 now 起 40 天窗口首个
			ev = Astro.SearchLunarEclipse(now);
			if (ev && +ev.peak < t1) out.push({
				ms: +ev.peak, type: '月食', text: '月食（' + (ev.kind === 'total' ? '全食' : ev.kind === 'partial' ? '偏食' : '半影食') + '）'
			});
		} catch (e) { }
		try {   // 日食：SearchGlobalSolarEclipse 同窗
			ev = Astro.SearchGlobalSolarEclipse(now);
			if (ev && +ev.peak < t1) out.push({
				ms: +ev.peak, type: '日食', text: '日食（' + (ev.kind === 'total' ? '全食' : ev.kind === 'annular' ? '环食' : ev.kind === 'partial' ? '偏食' : '混合') + '）'
			});
		} catch (e) { }
		// 行星合（21 对）：黄经差跨 0° 时刻
		for (var i = 0; i < EV_BODIES.length; i++) {
			for (var j = i + 1; j < EV_BODIES.length; j++) {
				var a = EV_BODIES[i], b = EV_BODIES[j];
				var fn = function (t) { return sepOf(a, b, new Date(t)); };
				var prev = fn(t0), prevT = t0;
				for (var t = t0 + DAY_MS; t <= t1 + DAY_MS; t += DAY_MS) {
					var cur = fn(t);
					if ((prev < 0 && cur > 0) || (prev > 0 && cur < 0)) {
						var cross = refineCross(fn, prevT, t);
						if (cross != null && cross <= t1) out.push({
							ms: cross, type: '行星合',
							text: LATIN2CN[a] + '合' + LATIN2CN[b] + '（黄经差 0°）'
						});
					}
					prev = cur; prevT = t;
				}
			}
		}
		// 冲日（5 外行星）+ 大距（水金）：黄经差跨 ±180 与 |sep| 局部极大
		for (var o = 0; o < EV_BODIES.length; o++) {
			var body = EV_BODIES[o];
			var sf = function (t) { return sepOf(body, 'Sun', new Date(t)); };
			var sPrev = sf(t0), sPrev2 = null, tPrev = t0, tPrev2 = null;
			for (var t2 = t0 + DAY_MS; t2 <= t1 + DAY_MS; t2 += DAY_MS) {
				var sCur = sf(t2);
				if ((sPrev < -170 && sCur > 170) || (sPrev > 170 && sCur < -170)) {   // 跨 ±180 = 冲
					var of = function (t) { var v = sf(t); return v > 0 ? v - 180 : v + 180; };   // 折叠后跨 0
					var oc = refineCross(of, tPrev, t2);
					if (oc != null && oc <= t1) out.push({ ms: oc, type: '冲日', text: LATIN2CN[body] + '冲日（黄经差 180°）' });
				}
				// 大距：|sep| 日采样局部极大（水金专属，容许度距 >15° 才报）
				if ((body === 'Mercury' || body === 'Venus') && sPrev2 != null
					&& Math.abs(sPrev) > Math.abs(sPrev2) && Math.abs(sPrev) >= Math.abs(sCur) && Math.abs(sPrev) > 15) {
					var mx = (tPrev + tPrev2) / 2;
					var deg = Math.round(Math.abs(sPrev));
					out.push({ ms: mx, type: '大距', text: LATIN2CN[body] + (sPrev > 0 ? '东大距' : '西大距') + '（距日 ' + deg + '°）' });
				}
				sPrev2 = sPrev; sPrev = sCur; tPrev2 = tPrev; tPrev = t2;
			}
		}
		out.sort(function (x, y) { return x.ms - y.ms; });
		return out.map(function (e2) { e2.when = fmtEvent(new Date(e2.ms)); return e2; });
	}
	// 按日缓存（同一天不重复计算——localStorage）
	function events30(now) {
		var day = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
		try {
			var cached = loadJSON('dsh-sky-panel-events', null);
			if (cached && cached.day === day && cached.list) return cached.list;
		} catch (e) { }
		var list = computeEvents30(now);
		try { localStorage.setItem('dsh-sky-panel-events', JSON.stringify({ day: day, list: list })); } catch (e) { }
		return list;
	}

	// ════════════════════════════════════════════════════════════════
	// §6 主题解析（DSH CSS 变量级联——每帧读取；无 DOM 环境回退中性灰）
		// ════════════════════════════════════════════════════════════════
		/**
		 * 主题解析（DSH CSS 变量级联——每帧读取）。
		 * @returns {{primary: string, secondary: string, tertiary: string, border: string,
		 *            soft: string, moonDark: string, moonLight: string, glow: boolean, sig: string}}
		 *   文字三级/边框两级色 + 月相双面色 + 深色微光开关（label-primary 亮度>0.5）+ 主题签名（外部轮询判变化）；
		 *   无 DOM 环境回退中性灰
		 */
		function resolveTheme() {
			var t = {
				primary: '#9a9a9a', secondary: '#777777', tertiary: '#555555',
				border: 'rgba(128,128,128,0.55)', soft: 'rgba(128,128,128,0.28)',
				moonDark: '#9A9AA4', moonLight: '#E0E0E0', glow: false, sig: 'default'
			};
			try {
				if (typeof document === 'undefined' || !document.documentElement) return t;
				var cs = getComputedStyle(document.documentElement);
				function pick(name, fallback) {
					var v = cs.getPropertyValue(name);
					v = v ? v.trim() : '';
					return v || fallback;
				}
				t.primary = pick('--dsw-alias-label-primary', t.primary);
				t.secondary = pick('--dsw-alias-label-secondary', t.secondary);
				t.tertiary = pick('--dsw-alias-label-tertiary', t.tertiary);
				t.border = pick('--dsw-alias-border-l3', t.border);
				t.soft = pick('--dsw-alias-border-l2', t.soft);
			// 深浅判断：label-primary 为亮色字（深色模式）→ 行星微光开
			var m = t.primary.match(/#([0-9a-f]{6})/i);
			var lum = m ? parseInt(m[1].slice(0, 2), 16) / 255 : 0.85;
			t.glow = lum > 0.5;
				t.sig = t.primary + '|' + t.secondary + '|' + t.tertiary;
			} catch (e) { }
			return t;
		}

		// ════════════════════════════════════════════════════════════════
		// §7 模块化绘制函数族（原创——每个函数只画一个元素，可独立开关）
		// ════════════════════════════════════════════════════════════════

		/**
		 * 黄经 → 720 设计坐标系屏幕坐标（冬至 270°=正下，黄经增=逆时针天左旋）。
		 * @param {number} lonDeg 黄经（度，0-360）
		 * @param {number} r 半径（设计坐标 px）
		 * @returns {{x: number, y: number}} 屏幕坐标
		 */
		function projectLon(lonDeg, r) {
			var a = lonDeg * Math.PI / 180;
			return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
		}

		/** 底层基准：行星带内外缘两圈极淡参考弧（背景本身=容器 DSH 变量色，canvas 透明） */
		function drawBackground(ctx, T) {
      // v1.6 删除虚线参考弧（R_PLANET_IN 与月亮轨道重叠 / R_ECLIPTIC 与黄道圈实线重叠——功能重复致视觉干扰）
    }

function wedge(ctx, rIn, rOut, lonFrom, lonTo, color, alpha) {
		var a1 = -lonFrom * Math.PI / 180, a2 = -lonTo * Math.PI / 180;
		ctx.beginPath();
		ctx.arc(CX, CY, rOut, a1, a2, true);
		ctx.arc(CX, CY, rIn, a2, a1, false);
		ctx.closePath();
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		ctx.fill();
		ctx.restore();
	}

	/** 十二辰外圈：r340 六方位色带环（35% 透明度）+ 圈线 + 30° 等分刻度 + 十二支名（子=冬至=正下） */
	function drawTwelveBranches(ctx, T, opts) {
		ctx.save();
		// 色带环：每辰 30°，六方位两辰同色（子丑深蓝→戌亥紫）——四季方位色彩语义（可选层）
		if (opts.showBranchColors) {
			for (var b = 0; b < 12; b++) {
				var lonC = 270 + b * 30;
				wedge(ctx, R_BRANCH - 22, R_BRANCH, lonC - 15, lonC + 15, BRANCH_BAND[Math.floor(b / 2)], 0.35);
				// 带缘细分（同色相邻带之间的界线）
				var be = (lonC - 15) * Math.PI / 180;
				ctx.strokeStyle = T.soft;
				ctx.lineWidth = 0.7;
				ctx.beginPath();
				ctx.moveTo(CX + (R_BRANCH - 22) * Math.cos(be), CY - (R_BRANCH - 22) * Math.sin(be));
				ctx.lineTo(CX + R_BRANCH * Math.cos(be), CY - R_BRANCH * Math.sin(be));
				ctx.stroke();
			}
		}
		ctx.strokeStyle = T.border;
		ctx.lineWidth = 0.75;
		ctx.beginPath(); ctx.arc(CX, CY, R_BRANCH, 0, Math.PI * 2); ctx.stroke();
			ctx.font = '11px ' + FONT_MONO;
			for (var i = 0; i < 12; i++) {
				// 支 i 的黄经中心：子=270，丑=300，…（顺黄经序）
				var lon = 270 + i * 30;
				var a = lon * Math.PI / 180;
				var c = Math.cos(a), s = Math.sin(a);
				ctx.beginPath();
				ctx.moveTo(CX + (R_BRANCH - 6) * c, CY - (R_BRANCH - 6) * s);
				ctx.lineTo(CX + R_BRANCH * c, CY - R_BRANCH * s);
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.75;
			ctx.stroke();
			if (opts.zodiacNames) {
					var p = projectLon(lon, R_BRANCH - 14);
					ctx.fillStyle = i % 3 === 0 ? T.primary : T.secondary;
					ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
					ctx.fillText(ZHI[i], p.x, p.y);
		}
		}
		// 15° 中刻度：介于主刻度（10px）与细刻度（4px）之间，跳过 30° 倍数位（主刻度已占）
		ctx.strokeStyle = T.border;
		ctx.lineWidth = 0.75;
		for (var m = 15; m < 360; m += 30) {
			var ma = m * Math.PI / 180;
			var mc = Math.cos(ma), ms = Math.sin(ma);
			ctx.beginPath();
			ctx.moveTo(CX + (R_BRANCH - 6) * mc, CY - (R_BRANCH - 6) * ms);
			ctx.lineTo(CX + R_BRANCH * mc, CY - R_BRANCH * ms);
			ctx.stroke();
		}
		// 1° 细刻度：十二辰外圈内侧短线（r336-340），跳过 15°/30° 主刻度位避免重叠
		if (opts.fineTicksBranches) {
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.4;
			for (var f = 0; f < 360; f += 1) {
				if (f % 15 === 0) continue;
				var t = f * Math.PI / 180;
				var tc = Math.cos(t), ts = Math.sin(t);
				ctx.beginPath();
				ctx.moveTo(CX + (R_BRANCH - 4) * tc, CY - (R_BRANCH - 4) * ts);
				ctx.lineTo(CX + R_BRANCH * tc, CY - R_BRANCH * ts);
				ctx.stroke();
			}
		}
		ctx.restore();
	}

	/** 28 宿圈：r310 圈线 + 距星黄经不等分刻度 + 宿名（四象四色）+ 宿度数字（可选） */
		function draw28Xiu(ctx, T, opts, sky) {
			ctx.save();
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.75;
			ctx.beginPath(); ctx.arc(CX, CY, R_XIU, 0, Math.PI * 2); ctx.stroke();
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			// 宿名圆周避让：窄宿（觜0.92°等）相邻宿名弧距 <24px（两字宽+间距）时沿圆周对向各偏 5px，多轮扫描至无冲突——保持同一半径
			var R_LBL = R_XIU - 17;
			var SHIFT_DEG = 3 / (R_LBL * Math.PI / 180);
			var MIN_DEG = 18 / (R_LBL * Math.PI / 180);
			var labelLon = sky.starsLon.slice();
			for (var pass = 0; pass < 28; pass++) {
				var moved = false;
				for (var j = 0; j < 28; j++) {
					var k = (j + 1) % 28;
					var d = labelLon[k] - labelLon[j];
					if (d <= 0) d += 360;
					if (d < MIN_DEG) {
						var sh = Math.min(SHIFT_DEG, (MIN_DEG - d) / 2);
						labelLon[j] -= sh;
						labelLon[k] += sh;
						moved = true;
					}
				}
				if (!moved) break;
			}
			for (var i = 0; i < 28; i++) {
				var lon = sky.starsLon[i];
				var a = lon * Math.PI / 180;
				var c = Math.cos(a), s = Math.sin(a);
				// 距星刻度（宿界起点）
				ctx.beginPath();
				ctx.moveTo(CX + (R_XIU - 6) * c, CY - (R_XIU - 6) * s);
				ctx.lineTo(CX + R_XIU * c, CY - R_XIU * s);
				ctx.strokeStyle = T.border;
				ctx.lineWidth = 0.75;
				ctx.stroke();
				// 宿名（四象分色）
				var p = projectLon(labelLon[i], R_LBL);
				ctx.font = '12px ' + FONT_MONO;
				ctx.fillStyle = XIANG_COLOR[Math.floor(i / 7) % 4];
				ctx.fillText(x28n[i], p.x, p.y);
				// 宿度数字（界宽，度→365.25 制取整到 0.5——传统宿度口径）——圈线外侧走廊，与十二辰支名错层
				if (opts.xiuWidths) {
					var w = sky.starsLon[(i + 1) % 28] - lon;
					if (w <= 0) w += 360;
					var du = w / 360 * R_YEAR;
					var zs = Math.trunc(du), xs = du - zs;
					if (xs < 0.33) du = zs; else if (xs > 0.66) du = zs + 1; else du = zs + 0.5;
					var pwLon = lon;
					if (i === 19) pwLon = lon - 1;   // 觜：向毕方向微偏——与参数字分开
					if (i === 20) pwLon = lon + 1;   // 参：向井方向微偏
					var pw = projectLon(pwLon, R_XIU + 6);
					ctx.font = '9px ' + FONT_MONO;
					ctx.fillStyle = T.tertiary;
					ctx.fillText('' + du, pw.x, pw.y);
			}
		}
		// 1° 细刻度：r304-310，跳过宿界刻度位（距星黄经 ±1° 内）避免重叠
		if (opts.fineTicksXiu) {
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.4;
			for (var fx = 0; fx < 360; fx += 1) {
				var skip = false;
				for (var sx = 0; sx < 28; sx++) {
					var d = Math.abs(fx - sky.starsLon[sx]);
					if (d > 180) d = 360 - d;
					if (d < 1) { skip = true; break; }
				}
				if (skip) continue;
				var ax = fx * Math.PI / 180;
				var cx2 = Math.cos(ax), sx2 = Math.sin(ax);
				ctx.beginPath();
				ctx.moveTo(CX + (R_XIU - 4) * cx2, CY - (R_XIU - 4) * sx2);
				ctx.lineTo(CX + R_XIU * cx2, CY - R_XIU * sx2);
				ctx.stroke();
			}
		}
		ctx.restore();
	}

	/** 四象星官连线（业内独家）：同象七宿距星沿 r284 走廊弧线顺序连接 + 距星点
	 *  组内星序=黄经增序（宿界全正值保证单调），一象一笔弧 + 7 距星点，四象四色 35% 饱和 */
	function drawXiangLines(ctx, T, sky) {
		ctx.save();
		for (var g = 0; g < 4; g++) {
			var i0 = g * 7;
			var lonA = sky.starsLon[i0];
			var lonB = sky.starsLon[i0 + 6];
			if (lonB <= lonA) lonB += 360;   // 组内单调保险（宿界全正，正常不触发）
			var color = XLINE_COLOR[XIANG_NAME[g]];
			ctx.globalAlpha = 0.6;
			ctx.strokeStyle = color;
			ctx.lineWidth = 0.75;
			ctx.beginPath();
			ctx.arc(CX, CY, R_XLINE, -lonA * Math.PI / 180, -lonB * Math.PI / 180, true);
			ctx.stroke();
			// 距星点（七宿锚点）
			ctx.fillStyle = color;
			for (var i = i0; i <= i0 + 6; i++) {
				var p = projectLon(sky.starsLon[i], R_XLINE);
				ctx.beginPath();
				ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.restore();
	}

	/** 行星相位连线（v1.6）：黄经差 合/冲/三合（±3°）语义分色（金/红/绿）——虚线弦连接两行星 */
	function drawAspectLines(ctx, T, sky) {
		var asp = findAspects(sky.planets);
		if (!asp.length) return;
		var byKey = {};
		for (var i = 0; i < sky.planets.length; i++) byKey[sky.planets[i].key] = sky.planets[i];
		ctx.save();
		ctx.lineWidth = 0.5;
		ctx.setLineDash([5, 4]);
		ctx.globalAlpha = 0.5;
		for (var a = 0; a < asp.length; a++) {
			var pa = byKey[asp[a].a], pb = byKey[asp[a].b];
			if (!pa || !pb) continue;
			var qa = projectLon(pa.elon, R_BAND[pa.cn]);
			var qb = projectLon(pb.elon, R_BAND[pb.cn]);
			ctx.strokeStyle = ASPECT_COLOR[asp[a].type];
			ctx.beginPath();
			ctx.moveTo(qa.x, qa.y);
			ctx.lineTo(qb.x, qb.y);
			ctx.stroke();
		}
		ctx.setLineDash([]);
		ctx.restore();
	}

	/** 24 节气圈：r280 圈线 + 15° 等分刻度（锚冬至 270°）+ 24 节气名 */
		function draw24Jieqi(ctx, T, opts, sky) {
			ctx.save();
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.75;
			ctx.beginPath(); ctx.arc(CX, CY, R_JIEQI, 0, Math.PI * 2); ctx.stroke();
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			var sun = sky.planets.find(function (p) { return p.key === 'Sun'; });
			// 太阳所在节气序：rel = 太阳黄经相对冬至的偏移（0-360），本气区间 [i*15, (i+1)*15)
			var sunRel = sun ? ((sun.elon - 270 + 360) % 360) : -1;
			var sunIdx = (sunRel >= 0 && sunRel < 360) ? Math.floor(sunRel / 15) : -1;
			for (var i = 0; i < 24; i++) {
				var lon = (270 + i * 15) % 360;
				var a = lon * Math.PI / 180;
				var c = Math.cos(a), s = Math.sin(a);
				var major = i % 6 === 0;   // 二分二至四立
				ctx.beginPath();
				ctx.moveTo(CX + (R_JIEQI - 6) * c, CY - (R_JIEQI - (6)) * s);
				ctx.lineTo(CX + R_JIEQI * c, CY - R_JIEQI * s);
				ctx.strokeStyle = T.border;
				ctx.lineWidth = 0.75;
				ctx.stroke();
				// 节气名（当前节气高亮）——r268 与黄道圈 250 之间留出太阳标注位
				var p = projectLon(lon, R_JIEQI - 16);
				ctx.font = (major ? '11px ' : '10px ') + FONT_MONO;
				ctx.fillStyle = i === sunIdx ? '#E5743C' : T.secondary;
				ctx.fillText(JIEQI[i], p.x, p.y);
		}
		// 1° 细刻度：r274-280，跳过 15° 刻度位避免重叠
		if (opts.fineTicksJieqi) {
			ctx.strokeStyle = T.border;
			ctx.lineWidth = 0.4;
			for (var fj = 0; fj < 360; fj += 1) {
				if (fj % 15 === 0) continue;
				var aj = fj * Math.PI / 180;
				var cj = Math.cos(aj), sj = Math.sin(aj);
				ctx.beginPath();
				ctx.moveTo(CX + (R_JIEQI - 4) * cj, CY - (R_JIEQI - 4) * sj);
				ctx.lineTo(CX + R_JIEQI * cj, CY - R_JIEQI * sj);
				ctx.stroke();
			}
		}
		ctx.restore();
	}

		/** 黄道圈：r250 圈线 + 度刻度（5°/30°/90° 三级）——行星带外缘基准 */
		function drawEclipticRing(ctx, T, opts) {
      ctx.save();
      ctx.strokeStyle = T.border;
      ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(CX, CY, R_ECLIPTIC, 0, Math.PI * 2); ctx.stroke();
      for (var d = 0; d < 360; d += 15) {
        var a = d * Math.PI / 180;
        var c = Math.cos(a), s = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(CX + (R_ECLIPTIC - 6) * c, CY - (R_ECLIPTIC - 6) * s);
        ctx.lineTo(CX + R_ECLIPTIC * c, CY - R_ECLIPTIC * s);
        ctx.strokeStyle = T.border;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
      // 1° 细刻度：r244-250，跳过 15° 刻度位避免重叠
      if (opts.fineTicksEcliptic) {
        ctx.strokeStyle = T.border;
        ctx.lineWidth = 0.4;
        for (var fe = 0; fe < 360; fe += 1) {
          if (fe % 15 === 0) continue;
          var ae = fe * Math.PI / 180;
          var ce = Math.cos(ae), se = Math.sin(ae);
          ctx.beginPath();
          ctx.moveTo(CX + (R_ECLIPTIC - 4) * ce, CY - (R_ECLIPTIC - 4) * se);
          ctx.lineTo(CX + R_ECLIPTIC * ce, CY - R_ECLIPTIC * se);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

		/** 行星轨道同心圆（可选图层——半径带可视化） */
		function drawPlanetOrbits(ctx, T) {
			ctx.save();
			ctx.strokeStyle = T.soft;
			ctx.lineWidth = 0.7;
			for (var k in R_BAND) {
				if (k === '太阳') continue;   // 太阳带=黄道圈本身
				ctx.beginPath(); ctx.arc(CX, CY, R_BAND[k], 0, Math.PI * 2); ctx.stroke();
			}
			ctx.restore();
		}

		/** 时刻输入行：六段（年月日时分秒）分段点击编辑——万年历交互同款（v1.9）
 *  标题态每段数字=按钮；点谁谁变输入框；编辑中点其他段=提交当前+直切；各段钳制 */
function TimeSegments(props) {
	var editSt = useState(null);   // null | 'y'|'m'|'d'|'h'|'mi'|'s'
	var isEdit = editSt[0], setEdit = editSt[1];
	var N = props.now;
	function fmtYearS(y) { return y <= 0 ? 'B' + (1 - y) : String(y); }   // 与万年历同款：公元前 B 前缀
	function parseYearS(str) {   // 输入认 B2000 / -2000 / 2000 三形式
		var s = String(str).trim();
		if (/^[Bb](\d{1,4})$/.test(s)) return -(parseInt(RegExp.$1, 10) - 1);
		var v = parseInt(s, 10);
		return isNaN(v) ? null : v;
	}
	function pad2(x) { return (x < 10 ? '0' : '') + x; }   // 固定两位——等宽不抖（年四位/月日时分秒两位）
	var SEG = [
		['y', fmtYearS(N.getFullYear()), '\u5e74', 56],
		['m', pad2(N.getMonth() + 1), '\u6708', 32],
		['d', pad2(N.getDate()), '\u65e5', 32],
		['h', pad2(N.getHours()), '\u65f6', 32],
		['mi', pad2(N.getMinutes()), '\u5206', 32],
		['s', pad2(N.getSeconds()), '\u79d2', 32]
	];
	var LIMIT = { y: [-7000, 9999], m: [1, 12], d: [1, 31], h: [0, 23], mi: [0, 59], s: [0, 59] };   // 年开放公元前（天文计数：-44=公元前45年）·AE引擎边界对齐
	function stop(e) { e.stopPropagation(); }
	function esc(e) { if (e.key === 'Escape') setEdit(null); }
	function commitSeg(key, raw) {
		var v = key === 'y' ? parseYearS(raw) : parseInt(raw, 10);
		if (v === null) return;
		if (isNaN(v)) return;   // 空/非数字忽略
		v = Math.max(LIMIT[key][0], Math.min(LIMIT[key][1], v));   // 钳制
		props.onSeg(key, v);
	}
	function commitAndSwitch(key, raw, next) { commitSeg(key, raw); setEdit(next); }
	var kids = [];
	for (var i = 0; i < SEG.length; i++) {
		(function (seg) {
			var key = seg[0], val = seg[1], unit = seg[2], w = seg[3];
			if (isEdit === key) {
				kids.push(createElement('input', {
					key: key + '-in', className: 'sky-seg-in', type: 'text',
					style: { width: w + 'px' }, defaultValue: String(val), autoFocus: true,
					onBlur: function (e) { commitSeg(key, e.target.value); setEdit(null); },
					onKeyDown: function (e) { if (e.key === 'Enter') { commitSeg(key, e.target.value); setEdit(null); } esc(e); },
					onMouseDown: stop
				}));
			} else {
				kids.push(createElement('button', {
					key: key + '-btn', type: 'button', className: 'sky-seg',
					onMouseDown: function (e) { e.preventDefault(); e.stopPropagation();
						if (isEdit && isEdit !== key) commitAndSwitch(isEdit, String(SEG.filter(function (s2) { return s2[0] === isEdit; })[0][1]), key);
						else setEdit(key); },
					onClick: function () { setEdit(key); }
				}, String(val)));
			}
			kids.push(createElement('span', { key: key + '-u', className: 'sky-seg-u' }, unit));
		})(SEG[i]);
	}
	return createElement('span', { className: 'sky-seg-row' }, kids);
}

/** 时刻输入行容器：接引擎（onSeg→改对应分量→setNow+HOLD）+回实时按钮 */
function TimeBar(props) {
	return createElement('div', { className: 'sky-timebar' },
		createElement(TimeSegments, { now: props.now, onSeg: props.onSeg }),
		createElement('button', { type: 'button', className: 'sky-btn', title: '\u56de\u5230\u73b0\u5728\u5e76\u6062\u590d\u5b9e\u65f6\u5237\u65b0', onClick: props.onNow }, '\u4eca'));
}

/** 月相 glyph：terminator 弧线分割亮暗面（elong 0=朔 90=上弦 180=望 270=下弦；北半球上弦=右半亮） */
		function drawMoonGlyph(ctx, x, y, r, elong, T) {
      var p = ((elong % 360) + 360) % 360;
      var k = Math.cos(p * Math.PI / 180);
      var illum = (1 - k) / 2;
      var rightLit = p <= 180;
      ctx.save();
      // ① 暗面全圆（底色）
      ctx.fillStyle = T.moonDark;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      // ② 亮面 = arc(月亮边缘) + ellipse(terminator) 连续路径
      //    关键：arc 终点 = ellipse 起点（完美连接——无断点无竖线）
      ctx.fillStyle = T.moonLight;
      ctx.beginPath();
      if (illum < 0.5) {
        // 眉月：两弧同侧反向 → 月牙
        if (rightLit) {
          // 右眉月：外弧 top→right→bottom CW + 内弧 bottom→right→top CCW
          ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, true);
        } else {
          // 左眉月：外弧 bottom→left→top CW + 内弧 top→left→bottom CCW
          ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5, false);
          ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI * 1.5, Math.PI / 2, true);
        }
      } else {
        // 凸月：外弧亮侧 + 内弧穿暗侧（同向 CW）→ 超半圆
        if (rightLit) {
          // 右凸月：外弧 top→right→bottom CW + 内弧 bottom→left→top CW
          ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, Math.PI * 1.5, false);
        } else {
          // 左凸月：外弧 bottom→left→top CW + 内弧 top→right→bottom CW
          ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5, false);
          ctx.ellipse(x, y, Math.abs(k) * r, r, 0, -Math.PI / 2, Math.PI / 2, false);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // ③ 外描边
      ctx.strokeStyle = T.soft;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }

		/** 行星圆点共享绘制（图①②同源）：微光/月亮glyph/功能色圆 + 太阳8线光芒 + 土星倾斜环 */
		function drawPlanetDot(ctx, pos, cn, T, opts, pl) {
			var color = P_COLOR[cn];
			ctx.save();
			if (T.glow && cn !== '月亮') {   // 深色模式微光（月相 glyph 自带层次不加）
				ctx.shadowColor = color;
				ctx.shadowBlur = 7;
			}
			if (cn === '月亮' && opts.moonPhase) {
				drawMoonGlyph(ctx, pos.x, pos.y, P_SIZE[cn], pl.elong, T);
			} else {
				// 纯色平面圆点（行星功能色）
				ctx.fillStyle = color;
				ctx.beginPath(); ctx.arc(pos.x, pos.y, P_SIZE[cn], 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = T.soft; ctx.lineWidth = 1;
				ctx.beginPath(); ctx.arc(pos.x, pos.y, P_SIZE[cn], 0, Math.PI * 2); ctx.stroke();
			}
			ctx.restore();
			// 太阳光芒（8 短线）
			if (cn === '太阳') {
				ctx.save();
				ctx.strokeStyle = color; ctx.lineWidth = 1.2;
				for (var g = 0; g < 8; g++) {
					var ga = g * Math.PI / 4;
					ctx.beginPath();
					ctx.moveTo(pos.x + (P_SIZE[cn] + 3) * Math.cos(ga), pos.y + (P_SIZE[cn] + 3) * Math.sin(ga));
					ctx.lineTo(pos.x + (P_SIZE[cn] + 8) * Math.cos(ga), pos.y + (P_SIZE[cn] + 8) * Math.sin(ga));
					ctx.stroke();
				}
				ctx.restore();
			}
			// 土星环
			if (cn === '土星') {
				ctx.save();
				ctx.strokeStyle = color; ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.ellipse(pos.x, pos.y, P_SIZE[cn] + 5, (P_SIZE[cn] + 5) * 0.38, -0.35, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			}
		}

	    /** 行星族：9 体按黄经画在各自半径带 + 标注（名+宫+顺逆）+ 悬停命中区 */
		function drawPlanets(ctx, T, opts, sky, hitTargets) {
			ctx.save();
			ctx.textBaseline = 'middle';
			for (var i = 0; i < sky.planets.length; i++) {
				var pl = sky.planets[i];
				var cn = pl.cn;
				var pos = projectLon(pl.elon, R_BAND[cn]);
				var isRetro = pl.retro.state === 0;

				// 行星本体+特效（共享函数，图②同源）
				drawPlanetDot(ctx, pos, cn, T, opts, pl);

				hitTargets.push({ x: pos.x, y: pos.y, r: Math.max(P_SIZE[cn] + 5, 11), planet: pl });
			}

			// 标注第二遍绘制（在全部圆点之后）——水平向圆心侧偏移，任何角度不与圆点重叠
			if (opts.planetLabels) {
				for (var j = 0; j < sky.planets.length; j++) {
					var pl = sky.planets[j];
					var cn = pl.cn;
					var pos = projectLon(pl.elon, R_BAND[cn]);
					var color = P_COLOR[cn];
					var isRetro = pl.retro.state === 0;
					// 左半圆（黄经 180-360，屏幕左侧）标注向右；右半圆（黄经 0-180）向左——朝圆心方向
					var toLeft = pl.elon <= 180;
					ctx.textAlign = toLeft ? 'right' : 'left';
					var lx = pos.x + (toLeft ? -1 : 1) * (P_SIZE[cn] + 6);
					ctx.font = '10px ' + FONT_MONO;
					ctx.fillStyle = (cn === '月亮') ? T.moonDark : color;
					var label;
					if (opts.showZodiacLabel) {
						label = cn.charAt(0) + '·' + GONG[Math.floor(pl.elon / 30) % 12];
						if (isRetro && opts.retroMark) label = '℞' + label;
					} else {
						label = cn + (isRetro && opts.retroMark ? ' 逆' : '');
					}
					ctx.fillText(label, lx, pos.y);
					if (isRetro && opts.retroMark) {
						ctx.font = '9px ' + FONT_MONO;
						ctx.fillStyle = '#E5743C';
						ctx.fillText('逆' + pl.retro.days + 'd', lx, pos.y + 11);
					}
				}
			}
			ctx.restore();
		}

		/** 中心信息：地心标（十字+点）+ 时钟 + 日期 + 农历 */
		function drawCenterInfo(ctx, T, opts, now, sky) {
			ctx.save();
			if (opts.centerCross) {
				ctx.strokeStyle = T.secondary; ctx.lineWidth = 1;
				ctx.beginPath(); ctx.moveTo(CX - 11, CY); ctx.lineTo(CX + 11, CY); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(CX, CY - 11); ctx.lineTo(CX, CY + 11); ctx.stroke();
				ctx.fillStyle = T.primary;
				ctx.beginPath(); ctx.arc(CX, CY, 2.2, 0, Math.PI * 2); ctx.fill();
			}
			if (opts.centerInfo) {
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				function pad(x) { return (x < 10 ? '0' : '') + x; }
				var hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
				var moon = sky.planets.find(function (p) { return p.key === 'Moon'; });
				var sun = sky.planets.find(function (p) { return p.key === 'Sun'; });
				ctx.fillStyle = T.primary;
				ctx.font = 'bold 24px ' + FONT_MONO;
				ctx.fillText(hh + ':' + mm + ':' + ss, CX, CY - 60);
				ctx.font = '11px ' + FONT_MONO;
				ctx.fillStyle = T.secondary;
				ctx.fillText(now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()), CX, CY - 38);
				var lt = lunarText(now);
				if (lt) {
					ctx.fillStyle = T.primary;
					ctx.font = '12px ' + FONT_MONO;
					ctx.fillText(lt.replace(/.*年/, ''), CX, CY - 20);
				}
				if (sun && moon) {
					ctx.font = '10px ' + FONT_MONO;
					ctx.fillStyle = T.tertiary;
					var mpt = '月相照亮 ' + Math.round(moon.illum * 100) + '% · 太阳入' + x28n[sun.xiuIdx] + '宿';
					if ('letterSpacing' in ctx) {           // Chrome 99+：native 字间距
						ctx.letterSpacing = '0.5px';
						ctx.fillText(mpt, CX, CY + 36);
						ctx.letterSpacing = '0px';
					} else {                                  // 老引擎兜底：手动插空格
						ctx.fillText(mpt.split('').join(' '), CX, CY + 36);
					}
				}
			}
			ctx.restore();
		}

	// ──  图②天顶图：地平坐标投影（N 上 S 下 E 左 W 右——仰望天图惯例）──
	// 高度→半径：天顶 90°=圆心 r0 / 地平 0°=R_ZENITH；方位角 0°=N 正上，顺时针东=左
	var R_ZENITH = 300;   // 340 时 N/S 标注（R+34）超出 360 半幅被裁 → 视觉偏心；320 全要素（含 R+34 标注）收在画布内
	function projectHor(azDeg, altDeg) {
		var alt = Math.max(altDeg, -30);
    var rMax = R_ZENITH - 12;                          // 映射上限收 12px——圆点半径净空，行星永不压地平圈线
    var r = alt >= 0
      ? (90 - alt) / 90 * rMax                     // 地上：天顶 0 → 地平内缘 rMax
      : rMax + alt / 30 * 30;                     // 地下压缩窄带：0°=贴内缘 / -30°=圈内 30px
		var a = azDeg * Math.PI / 180;
		return { x: CX - r * Math.sin(a), y: CY + r * Math.cos(a) };
	}
	/** 天顶图：地平圈 + N/E/S/W 十字 + 30° 方位刻度 + 晨昏蒙影三虚线圆 + 9 体地平位置 */
	function drawZenithChart(ctx, T, opts, sky, hitTargets, now, position) {
		ctx.save();
		ctx.strokeStyle = T.border;
		ctx.lineWidth = 0.75;
		ctx.beginPath(); ctx.arc(CX, CY, R_ZENITH, 0, Math.PI * 2); ctx.stroke();
		// 晨昏蒙影：太阳高度 -6/-12/-18 对应的等高度圈（虚线——民用/航海/天文）
		var TWI = [['民用', 6], ['航海', 12], ['天文', 18]];
		ctx.setLineDash([6, 5]);
		ctx.lineWidth = T.glow ? 0.8 : 0.5;   // 深色模式加粗——虚线在深底上可见
		for (var w = 0; w < 3; w++) {
			var rw = TWI[w][1] / 90 * R_ZENITH;
			ctx.strokeStyle = T.glow ? T.border : T.soft;   // 深色模式升级 0.55 透明度
			ctx.beginPath(); ctx.arc(CX, CY, R_ZENITH - rw, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = T.tertiary;
			ctx.font = '9px ' + FONT_MONO;
			ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
			ctx.fillText(TWI[w][0] + '蒙影', CX + 4, CY - (R_ZENITH - rw));
		}
		ctx.setLineDash([]);
		// 北/南/东/西十字（引线+字均在圈内——圈外零元素）+ 每 30° 方位刻度 + 度数标注
		var DIRS = [['北', 0], ['东', 90], ['南', 180], ['西', 270]];
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		for (var d = 0; d < 4; d++) {
			var a = DIRS[d][1] * Math.PI / 180;
			var ex = CX - R_ZENITH * Math.sin(a), ey = CY + R_ZENITH * Math.cos(a);
			ctx.strokeStyle = T.secondary; ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(CX - (R_ZENITH - 10) * Math.sin(a), CY + (R_ZENITH - 10) * Math.cos(a));
			ctx.lineTo(ex, ey);
			ctx.stroke();
			ctx.fillStyle = T.primary;
			ctx.font = 'bold 13px ' + FONT_MONO;
			ctx.fillText(DIRS[d][0], CX - (R_ZENITH + 34) * Math.sin(a), CY + (R_ZENITH + 34) * Math.cos(a));
		}
					// 30°主 + 15°中刻度（图①十二辰同规格 0.75px/6px/T.border）；度数标注仅 30° 位
			for (var m = 15; m < 360; m += 15) {
				var am = m * Math.PI / 180;
				ctx.strokeStyle = T.border; ctx.lineWidth = 0.75;
				ctx.beginPath();
				ctx.moveTo(CX - (R_ZENITH - 6) * Math.sin(am), CY + (R_ZENITH - 6) * Math.cos(am));
				ctx.lineTo(CX - R_ZENITH * Math.sin(am), CY + R_ZENITH * Math.cos(am));
				ctx.stroke();
				if (m % 30 === 0) {
					ctx.fillStyle = T.tertiary;
					ctx.font = '9px ' + FONT_MONO;
					ctx.fillText('' + m, CX - (R_ZENITH + 12) * Math.sin(am), CY + (R_ZENITH + 12) * Math.cos(am));
				}
			}
						// 0°（北）数字标注——与 30/60/…/330 同款
			ctx.fillStyle = T.tertiary;
			ctx.font = '9px ' + FONT_MONO;
			ctx.fillText('0', CX, CY + (R_ZENITH + 12) * Math.cos(0));
// 1° 细刻度（图①同款 0.4px/4px/T.border——跳过 15° 倍数位）
			for (var tz = 0; tz < 360; tz++) {
				if (tz % 15 === 0) continue;
				var az2 = tz * Math.PI / 180;
				ctx.strokeStyle = T.border; ctx.lineWidth = 0.4;
				ctx.beginPath();
				ctx.moveTo(CX - (R_ZENITH - 4) * Math.sin(az2), CY + (R_ZENITH - 4) * Math.cos(az2));
				ctx.lineTo(CX - R_ZENITH * Math.sin(az2), CY + R_ZENITH * Math.cos(az2));
				ctx.stroke();
			}
		// 高度圈 30°/60°（淡参考，图①同款 0.5px T.border）
		ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
		[30, 60].forEach(function (alt) {
			ctx.beginPath(); ctx.arc(CX, CY, (90 - alt) / 90 * R_ZENITH, 0, Math.PI * 2); ctx.stroke();
		});
		// 9 体行星（两遍绘制——先全部圆点后全部标注，图①同款）：圆点统一功能色+完整特效（共享函数
		// drawPlanetDot——太阳芒/土星环/月亮glyph/微光与图①完全一致）；地下天体可见性只由标注 × 前缀区分
		ctx.textBaseline = 'middle';
		for (var i = 0; i < sky.planets.length; i++) {
			var pl = sky.planets[i];
			var pos = projectHor(pl.az, pl.alt);
			drawPlanetDot(ctx, pos, pl.cn, T, opts, pl);
			hitTargets.push({ x: pos.x, y: pos.y, r: Math.max(P_SIZE[pl.cn] + 5, 11), planet: pl });
		}
		    // 标注第二遍（与行星图同款：水平朝圆心偏移紧贴行星——无避让机制）
    if (opts.planetLabels) {
      ctx.font = '10px ' + FONT_MONO;
      ctx.textBaseline = 'middle';
      for (var j = 0; j < sky.planets.length; j++) {
        var pl2 = sky.planets[j];
        var pos2 = projectHor(pl2.az, pl2.alt);
        var vis2 = pl2.alt > 0;
        var ztext = pl2.cn + (vis2 ? '' : ' ×') + ' 高' + Math.round(pl2.alt) + '° 方' + Math.round(pl2.az) + '°';
        var zLeft2 = pos2.x >= CX;
        var zlx2 = pos2.x + (zLeft2 ? -1 : 1) * (P_SIZE[pl2.cn] + 6);
        ctx.textAlign = zLeft2 ? 'right' : 'left';
        ctx.fillStyle = (pl2.cn === '月亮') ? T.moonDark : P_COLOR[pl2.cn];
        ctx.fillText(ztext, zlx2, pos2.y);
      }
    }
    // 中心：天顶标
		ctx.strokeStyle = T.secondary; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(CX - 9, CY); ctx.lineTo(CX + 9, CY); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(CX, CY - 9); ctx.lineTo(CX, CY + 9); ctx.stroke();
		ctx.fillStyle = T.primary;
		ctx.font = '10px ' + FONT_MONO;
		ctx.textAlign = 'center';
		ctx.fillText('天顶', CX, CY - 16);
		// 角落状态行（小型）：观测地名称 + 当前时间
		if (now && position) {
			var place = null;
			for (var q = 0; q < POS_PRESETS.length; q++) {
				if (Math.abs(POS_PRESETS[q][1] - position.latitude) < 0.01 && Math.abs(POS_PRESETS[q][2] - position.longitude) < 0.01) place = POS_PRESETS[q][0];
			}
			if (!place) place = position.latitude.toFixed(1) + 'N ' + position.longitude.toFixed(1) + 'E';
			function padz(x) { return (x < 10 ? '0' : '') + x; }
			ctx.fillStyle = T.secondary; ctx.font = '10px ' + FONT_MONO;
			ctx.textAlign = 'left'; ctx.textBaseline = 'top';
			ctx.fillText(place + ' · ' + padz(now.getMonth() + 1) + '-' + padz(now.getDate()) + ' ' + padz(now.getHours()) + ':' + padz(now.getMinutes()), 20, 18);
		}
		ctx.restore();
	}

	/** redraw 统一入口：清屏 → 按 settings 逐层绘制 → 更新悬停命中表 */
	function redraw(ctx, settings, now, sky, hitTargets, view, position) {
		hitTargets.length = 0;
		ctx.clearRect(0, 0, SIZE, SIZE);
		var T = resolveTheme();
		if (view === 'zenith') {
			drawZenithChart(ctx, T, settings, sky, hitTargets, now, position);
			return T;
		}
		drawBackground(ctx, T);
		if (settings.twelveBranches) drawTwelveBranches(ctx, T, settings);
		if (settings.xiuRing) draw28Xiu(ctx, T, settings, sky);
		if (settings.xiangLines) drawXiangLines(ctx, T, sky);
		if (settings.jieqiRing) draw24Jieqi(ctx, T, settings, sky);
		if (settings.eclipticRing) drawEclipticRing(ctx, T, settings);
		if (settings.planetOrbits) drawPlanetOrbits(ctx, T);
		if (settings.aspectLines) drawAspectLines(ctx, T, sky);
		drawPlanets(ctx, T, settings, sky, hitTargets);
		drawCenterInfo(ctx, T, settings, now, sky);
		return T;
	}

		// ════════════════════════════════════════════════════════════════
		// §8 引擎组装：时间控制 / 实时刷新 / 键盘 / 悬停 / 查询面
		// ════════════════════════════════════════════════════════════════
		/**
		 * 引擎工厂：绑定 canvas 组装时间控制/实时刷新/动画播放/图层/悬停/查询面（§8 引擎组装）。
		 * 构造即初始化命名星并完成首帧绘制（有 initialSize 则先就位 backing 再绘制）。
		 * @param {HTMLCanvasElement} canvas 目标画布（720 设计坐标系经 setTransform 映射）
		 * @param {number} [initialSize] 初始显示尺寸（CSS px；缺省 0=先按现尺寸绘制）
		 * @returns {Object} 引擎公开 API 面：
		 *   - paint()：重算天象并重绘一帧
		 *   - resizeTo(displaySize)：设置显示尺寸（backing=显示尺寸×DPR×视图 scale），尺寸未变幂等不重绘
		 *   - makeInterval() / killInterval() / isLive()：实时刷新（1s 节拍）开/关/查；kill 同步终止播放
		 *   - goNow()：回到现在并恢复实时
		 *   - setNow(date)：设定基准时刻（终止实时，verify 冒烟口）
		 *   - shiftMinute(d)/shiftHour(d)/shiftDay(d)/shiftMonth(d)/shiftYear(d)：时间平移（自动暂停；
		 *     月/年跳保持日号，月末/闰二月自动钳制）；handleKeydown(e)：键盘统一入口
		 *   - startPlayback()/stopPlayback()/isPlaying()：动画播放（100ms 节拍虚拟时间推进，与实时互斥）
		 *   - setPlaySpeed(v)/getPlaySpeed()：播放速度（1/100/1000）
		 *   - hitTest(x,y)：悬停命中（720 坐标系），返回最近行星命中区 {x,y,r,planet} 或 null
		 *   - themeChanged()：主题签名变化检测（外部轮询触发重绘）
		 *   - getSettings()/toggleSetting(key)：图层设置读/翻转（翻转即存 localStorage 并重绘）
		 *   - setTimeSpan(v)/getTimeSpan()/setTimeUnit(v)/getTimeUnit()：E/R 时间跨度与单位（日/月/年）
		 *   - getNow()：当前时刻；getInfo()：行星行数组；getLunarText(date)：农历文本
		 *   - project(lon,r)：projectLon 别名；getHitTargets()：悬停命中表（详情卡定位用）
		 *   - setView(v)/getView()：视图切换（'chart' 行星图 / 'zenith' 天顶图）
		 *   - getPosition()/setPosition(lat,lon,alt)：观测地（越界拒绝，持久化 localStorage）
		 *   - getEvents()：未来 30 天天象事件（按日 localStorage 缓存）
		 *   - card(bodyKey)：行星详情卡数据（黄经度分秒/入宿/距离百分比/顺逆/升中落，按日缓存）
		 */
		function createSkyEngine(canvas, initialSize) {
			var ctx = canvas.getContext('2d');
			var now = { value: new Date() };
			var settings = loadSettings();
			var position = loadJSON(LS_POSITION, { s: DEFAULT_POSITION });
			if (!position.s) position = { s: DEFAULT_POSITION };
			var timeSpan = { value: 30 }, timeUnit = { value: '日' };
			var sky = { planets: [], starsLon: [], starsRA: [] };
			var hitTargets = [];
			var intIdx = 0;
			var lastThemeSig = '';
			var view = { value: 'chart' };                 // ：chart=行星图 / zenith=天顶图
			var playIdx = 0, playSpeed = { value: 1 };     // ：动画播放（虚拟时间推进，与实时互斥）

			function saveSettings() { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) { } }

			function paint() {
			sky = computeSky(now.value, position.s);
			try { sky.lunar = lunarText(now.value); } catch (e) { sky.lunar = ''; }
			var T = redraw(ctx, settings.s, now.value, sky, hitTargets, view.value, position.s);
			lastThemeSig = T.sig;
		}

		/** 视图缩放系数：祖先链上 CSS transform 的累计 scale（DSH 视图切换放大时 >1）。
		 *  只取放大态（<1 时按 1 计——缩小态浏览器对更大位图降采样，无需加码 backing）。 */
		function viewScaleOf(el) {
			var s = 1, p = el && el.parentElement;
			while (p) {
				var tr = window.getComputedStyle(p).transform;
				if (tr && tr !== 'none') {
					var m = tr.match(/matrix\(([^)]+)\)/);
					if (m) {
						var a = m[1].split(',');
						var sx = Math.abs(parseFloat(a[0])), sy = a.length > 3 ? Math.abs(parseFloat(a[3])) : 0;
						var v = sx || sy;
						if (v > 0) s *= v;
					} else {
						var m3 = tr.match(/matrix3d\(([^)]+)\)/);
						if (m3) { var b = m3[1].split(','); var v3 = Math.abs(parseFloat(b[0])); if (v3 > 0) s *= v3; }
					}
				}
				p = p.parentElement;
			}
			return s > 1 ? s : 1;
		}

		/** 动态尺寸：显示 displaySize CSS px，backing = displaySize×DPR×视图scale（HiDPI + 视图放大补偿——
		 *  放大态下位图与最终物理像素 1:1，浏览器不再对已渲染位图插值放大）；
		 *  setTransform 把 720 设计坐标系等比映射到设备像素（圆心/半径/字号/线宽全要素同步缩放）——
		 *  原生分辨率渲染，任何侧栏宽度下文字清晰。backing 变更会清空画布，故变更后立即重绘。 */
		function resizeTo(displaySize) {
			if (!(displaySize > 0)) return false;
			var dpr = window.devicePixelRatio || 1;
			var px = Math.max(1, Math.round(displaySize * dpr * viewScaleOf(canvas)));
			canvas.style.width = displaySize + 'px';
			canvas.style.height = displaySize + 'px';
			if (canvas.width === px && canvas.height === px) return false;   // 幂等：尺寸未变不动 backing
			canvas.width = px;
			canvas.height = px;
			var k = px / SIZE;
			ctx.setTransform(k, 0, 0, k, 0, 0);
			paint();
			return true;
		}

			function makeInterval() {
				intIdx = setInterval(function () {
					now.value = new Date();
					paint();
				}, 1000);
				return intIdx;
			}
			function killInterval() {
				if (intIdx > 0) { clearInterval(intIdx); intIdx = 0; }
				stopPlayback();   // 时间操作/实时切换一律终止播放（用户操作自动暂停）
			}
			function isLive() { return intIdx > 0; }
			// ──  动画播放：100ms 节拍虚拟时间推进（1×=每秒1秒 … 1000×=每秒1000秒）──
			/** 停止播放（保留虚拟时刻——时间态不变为暂停 HOLD） */
			function stopPlayback() {
				if (playIdx > 0) { clearInterval(playIdx); playIdx = 0; }
			}
			/** 开始播放（与实时互斥——自动停实时；已播放中幂等） */
			function startPlayback() {
				if (intIdx > 0) { clearInterval(intIdx); intIdx = 0; }   // 播放与实时互斥
				if (playIdx) return;
				playIdx = setInterval(function () {
					now.value = new Date(+now.value + playSpeed.value * 100);
					paint();
				}, 100);
			}
			function isPlaying() { return playIdx > 0; }
			/** 回到现在：时刻重置为当前时钟并恢复 1s 实时刷新 */
			function goNow() {
				killInterval();
				now.value = new Date();
				makeInterval();
				paint();
			}
			/** 日平移（d 可负）；任何时间操作自动终止实时与播放 */
			function shiftDay(d) { killInterval(); now.value.setDate(now.value.getDate() + d); paint(); }
			/** 小时平移（d 可负） */
			function shiftHour(d) { killInterval(); now.value.setHours(now.value.getHours() + d); paint(); }
			/** 分钟平移（d 可负） */
			function shiftMinute(d) { killInterval(); now.value.setMinutes(now.value.getMinutes() + d); paint(); }
			/** 跨度平移（days 天——E/R 快捷键后端） */
			function shiftSpan(days) { killInterval(); now.value.setDate(now.value.getDate() + days); paint(); }
			// setMonth/setFullYear 对超月长日期是"滚动"非"钳制"（1月31日+1月→3月3日）——先归 1 日再跳，日号钳到目标月末
			function shiftClamp(setTarget) {
				var t = now.value, day = t.getDate();
				t.setDate(1);
				setTarget(t);
				t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
			}
			/** 月平移：日号保持·月末自动钳（1.31→2.28） */
			function shiftMonth(d) { killInterval(); shiftClamp(function (t) { t.setMonth(t.getMonth() + d); }); paint(); }
			/** 年平移：月日保持·闰二自动钳（2024.2.29+1年→2025.2.28） */
			function shiftYear(d) { killInterval(); shiftClamp(function (t) { t.setFullYear(t.getFullYear() + d); }); paint(); }
			function spanDays() {
				var v = parseFloat(String(timeSpan.value).replace(/,/g, ''));
				if (isNaN(v)) v = 0;
				if (timeUnit.value === '月') v *= 30;
				if (timeUnit.value === '年') v *= 365.25;
				return v;
			}

			function handleKeydown(event) {
				var k = event.keyCode;
				if (event.ctrlKey || event.altKey || event.metaKey) return;
				switch (k) {
					case 74: shiftDay(-1); break;                    // J 前一日
					case 75: shiftDay(1); break;                     // K 后一日
					case 78: shiftHour(-1); break;                   // N 前一小时
					case 77: shiftHour(1); break;                    // M 后一小时
					case 68: shiftMinute(-1); break;                 // D 前一分钟
					case 70: shiftMinute(1); break;                  // F 后一分钟
					case 37: shiftDay(-1); break;                    // ← 前一日
					case 39: shiftDay(1); break;                     // → 后一日
					case 38: shiftHour(1); break;                    // ↑ 后一小时
					case 40: shiftHour(-1); break;                   // ↓ 前一小时
					case 72: goNow(); break;                         // H 现在+实时
					case 32: if (isPlaying()) { stopPlayback(); paint(); } else if (isLive()) { killInterval(); paint(); } else goNow(); break;  // Space 播放/实时→暂停
					case 69: shiftSpan(-spanDays()); break;          // E 退跨度
					case 82: shiftSpan(spanDays()); break;           // R 进跨度
					default: return;
				}
				// 方向键/空格防页面滚动（已处理的键才拦截）
				if (event.preventDefault) event.preventDefault();
			}

			/** 悬停命中（720 坐标系）：最近行星 within 命中半径 */
			function hitTest(x, y) {
				var best = null, bestD = 1e9;
				for (var i = 0; i < hitTargets.length; i++) {
					var t = hitTargets[i];
					var d = Math.sqrt((t.x - x) * (t.x - x) + (t.y - y) * (t.y - y));
					if (d < t.r && d < bestD) { best = t; bestD = d; }
				}
				return best;
			}

			/** 主题签名（外部轮询：DSH 深浅切换后 HOLD 态触发重绘） */
			function themeChanged() {
				var sig = resolveTheme().sig;
				return sig !== lastThemeSig;
			}

			// ──  详情卡：今日升/中/落按「天体@本地日@观测地」缓存（J/K 跨日/位置变更自动失效重算）──
			var evCache = {};
			function eventsOf(bodyKey, now, position) {
			var day = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
			var ck = bodyKey + '@' + day + '@' + position.latitude.toFixed(2) + ',' + position.longitude.toFixed(2);   // 缓存键含观测地——位置变更自动重算
			if (!(ck in evCache)) evCache[ck] = computeEvents(bodyKey, now, position);
				return evCache[ck];
			}
			/** 行星详情卡数据（：查当前帧行星行 + 今日升/中/落（按「天体@本地日」缓存）。
			 *  @param {string} bodyKey 天体键（'Sun'/'Moon'/'Mercury'…）
			 *  @returns {Object|null} 卡片对象（符号/黄经度分秒/宫/入宿/距离百分比/顺逆天数/时角/月相/升中落） */
			function card(bodyKey) {
				var row = null;
				for (var i = 0; i < sky.planets.length; i++) {
					if (sky.planets[i].key === bodyKey) { row = sky.planets[i]; break; }
				}
				return row ? buildCard(row, eventsOf(bodyKey, now.value, position.s)) : null;
			}

		initStars();
		if (!resizeTo(initialSize || 0)) paint();   // 有初始显示尺寸则先就位 backing 再绘制（一次成型）

			return {
				paint: paint,
				resizeTo: resizeTo,
				makeInterval: makeInterval,
				killInterval: killInterval,
				isLive: isLive,
				goNow: goNow,
				setNow: function (d) { killInterval(); now.value = d; paint(); },   // verify 冒烟口：设定基准时刻
				shiftMinute: shiftMinute,
				shiftHour: shiftHour,
				shiftDay: shiftDay,
				shiftMonth: shiftMonth,
				shiftYear: shiftYear,
				handleKeydown: handleKeydown,
				hitTest: hitTest,
				themeChanged: themeChanged,
				getSettings: function () { return settings.s; },
				toggleSetting: function (key) {
					settings.s[key] = !settings.s[key];
					saveSettings();
					paint();
				},
				setTimeSpan: function (v) { timeSpan.value = v; },
				setTimeUnit: function (v) { timeUnit.value = v; },
				getTimeSpan: function () { return timeSpan.value; },
				getTimeUnit: function () { return timeUnit.value; },
				getNow: function () { return now.value; },
				getInfo: function () { return sky.planets; },
				getLunarText: lunarText,
				project: projectLon,
				getHitTargets: function () { return hitTargets; },
				// ── ：动画播放 / 视图切换 / 观测位置 / 天象事件 ──
				startPlayback: startPlayback,
				stopPlayback: stopPlayback,
				isPlaying: isPlaying,
				setPlaySpeed: function (v) { playSpeed.value = v; },
				getPlaySpeed: function () { return playSpeed.value; },
				setView: function (v) { if (v === 'zenith' || v === 'chart') { view.value = v; paint(); } },
				getView: function () { return view.value; },
				getPosition: function () { return position.s; },
				setPosition: function (lat, lon, alt) {
					lat = +lat; lon = +lon;
					if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;   // 越界拒绝（AE Observer 会抛）
					position.s = { latitude: lat, longitude: lon, altitude: alt != null ? +alt : 0 };
					try { localStorage.setItem(LS_POSITION, JSON.stringify(position)); } catch (e) { }
					paint();
				},
				getEvents: function () { return events30(now.value); },
				card: card   // 详情卡数据（verify 冒烟口）
			};
		}

		// ════════════════════════════════════════════════════════════════
		// §9 React 面板层：工具栏 + 圆图（动态尺寸 DPR 原生渲染适配侧栏）+ 状态行 + 图层面板 + tooltip
		// ════════════════════════════════════════════════════════════════
		// 语义重排（row-major 交错，4 列×5 行）：列1 圈层｜列2 色带+1°刻度｜列3 行星族｜列4 特色功能
		var LAYER_ITEMS = [
			['twelveBranches', '十二辰外圈'],
			['showBranchColors', '十二辰色带'],
			['planetOrbits', '行星轨道圈'],
			['xiangLines', '星官连线'],
			['zodiacNames', '十二辰名'],
			['fineTicksBranches', '十二辰1°刻度'],
			['aspectLines', '行星连线'],
			['xiuWidths', '宿度数字'],
			['xiuRing', '28宿圈'],
			['fineTicksXiu', '28宿1°刻度'],
			['planetLabels', '行星标注'],
			['moonPhase', '月相'],
			['jieqiRing', '24节气圈'],
			['fineTicksJieqi', '节气1°刻度'],
			['showZodiacLabel', '行星星座'],
			['centerInfo', '中心信息'],
			['eclipticRing', '黄道圈'],
			['fineTicksEcliptic', '黄道1°刻度'],
			['retroMark', '逆行标记'],
			['centerCross', '中心地心标'],
		];

		var CSS = ""
			+ ".sky-root{height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;font-size:var(--dsh-content-font-size-secondary,13px);color:var(--dsw-alias-label-primary);outline:none}"
			+ ".sky-toolbar{flex-shrink:0;height:38px;box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));display:flex;align-items:center;gap:2px;padding:0 6px}"
			+ ".sky-btn{height:28px;box-sizing:border-box;border:none;background:0 0;border-radius:var(--dsh-radius-sm,4px);color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;flex:none;font-size:var(--dsh-content-font-size-secondary,13px);line-height:1}"
			+ ".sky-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-secondary,#ccc)}"
			+ ".sky-btn-on,.sky-btn-on:hover{color:var(--dsw-alias-state-business-primary,#5B8DEF)}"
			+ ".sky-spacer{flex:1}"      + ".sky-seg-row{display:inline-flex;align-items:center;gap:2px}"      + ".sky-seg{border:none;background:0 0;color:var(--dsw-alias-label-primary,#ccc);cursor:pointer;padding:2px 3px;border-radius:var(--dsh-radius-sm,4px);font-size:var(--dsh-content-font-size-secondary,13px);text-align:center;flex:none;line-height:1}"      + ".sky-seg:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}"      + ".sky-seg-in{height:28px;box-sizing:border-box;border:1px solid var(--cal-border,var(--dsw-alias-border-l3,rgba(128,128,128,.3)));border-radius:var(--dsw-radius-sm);background:var(--cal-bg,var(--dsw-alias-bg-base,#1a1a1e));color:var(--cal-text,var(--dsw-alias-label-primary,#ccc));font-size:var(--dsh-content-font-size-secondary,13px);padding:4px 4px;outline:none;text-align:center;flex:none;line-height:1.4}"      + ".sky-seg-u{color:var(--dsw-alias-label-primary,#ccc);font-size:var(--dsh-content-font-size-secondary,13px);margin:0 1px 0 0;flex:none}"
			+ ".sky-span-input{width:40px;height:22px;box-sizing:border-box;border:1px solid var(--cal-border,var(--dsw-alias-border-l3,rgba(128,128,128,.3)));border-radius:var(--dsw-radius-sm);background:var(--cal-bg,transparent);color:var(--cal-text,inherit);font-size:11px;padding:2px 2px;flex:none;outline:none}"
			+ ""
			// 自造下拉三件套（对齐 DSH 原生下拉：无边框菜单+外圈阴影+chevron 旋转）
			+ ".sky-drop{position:relative;flex:none}"
			+ ".sky-drop-btn{height:22px;box-sizing:border-box;border:1px solid var(--cal-border,var(--dsw-alias-border-l3,rgba(128,128,128,.3)));border-radius:var(--dsw-radius-sm);color:var(--cal-text,var(--dsw-alias-label-primary,#ccc));font-size:11px;padding:0 5px 0 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;background-color:transparent;flex:none;outline:none;font-family:inherit}"
			+ ".sky-drop-btn:hover{background:var(--cal-hover,var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12)))}"
			+ ".sky-drop-chev{display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary,#888);transition:transform .12s ease;flex:none}"
			+ ".sky-drop-chev.open{transform:rotate(180deg)}"
			+ ".sky-drop-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:10;min-width:100%;box-sizing:border-box;background:var(--cal-bg-card,var(--dsw-alias-bg-layer-2,#fff));border:none;border-radius:var(--dsw-radius-sm);padding:4px 0;box-shadow:0 4px 12px rgba(0,0,0,.12)}.sky-drop-menu-up{top:auto;bottom:calc(100% + 4px)}"
			+ ".sky-drop-item{display:block;width:100%;border:none;background:0 0;text-align:left;color:var(--cal-text,var(--dsw-alias-label-primary,#222));font-size:var(--dsh-content-font-size-secondary,13px);padding:4px 10px;cursor:pointer;white-space:nowrap;font-family:inherit}"
			+ ".sky-drop-item:hover{background:var(--cal-hover,var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12)));color:var(--dsw-alias-label-primary,#222)}"
			+ ".sky-drop-item.on{color:var(--cal-accent,var(--dsw-alias-state-business-primary,#5B8DEF));font-weight:600}"
			+ ".sky-drop-mask{position:fixed;inset:0;z-index:9}"
			// 圆图区：背景=DSH 变量（零自定义底色——深浅主题自动跟随），canvas 按容器宽高较小边显示（backing×DPR 原生分辨率）
			+ ".sky-chart{flex:1;min-height:0;overflow:hidden;box-sizing:border-box;background:var(--dsw-alias-bg-base,transparent);display:flex;align-items:center;justify-content:center;position:relative;padding:0}"
			+ ".sky-canvas{display:block;cursor:crosshair;outline:none;flex:none}"
			// 悬停 tooltip（仪表读数）
			+ ".sky-tip{position:absolute;pointer-events:none;z-index:5;background:var(--dsw-alias-bg-layer-2,rgba(30,30,34,.94));border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.35));border-radius:6px;padding:6px 9px;font-size:10.5px;line-height:1.65;color:var(--dsw-alias-label-primary,#ddd);box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap}"
			+ ".sky-tip b{font-weight:600}"
			// 行星详情卡（——点击行星弹出；DSH 面板风：CSS 变量圆角/边框/背景 + monospace 数值）
			+ ".sky-card{position:absolute;z-index:6;pointer-events:none;width:208px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2,rgba(28,28,32,.96));border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.35));border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.28);overflow:hidden}"
			+ ".sky-card-head{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));font-weight:600;font-size:12px;line-height:1.3;color:var(--dsw-alias-label-primary,#eee)}"
			+ ".sky-card-dot{width:9px;height:9px;border-radius:50%;flex:none;box-shadow:0 0 4px currentColor}"
			+ ".sky-card-lat{margin-left:auto;font-weight:400;font-size:10px;color:var(--dsw-alias-label-tertiary,#888)}"
			+ ".sky-card-body{padding:5px 10px 7px;display:grid;grid-template-columns:38px 1fr;gap:0 8px;font-size:10.5px;line-height:1.7}"
			+ ".sky-card-body span{color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap}"
			+ ".sky-card-body b{font-weight:500;color:var(--dsw-alias-label-primary,#ddd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
			+ ".sky-card-bar{grid-column:1 / 3;height:3px;margin:3px 0 1px;border-radius:2px;background:var(--dsw-alias-border-l2,rgba(128,128,128,.3));overflow:hidden}"
			+ ".sky-card-bar i{display:block;height:100%;border-radius:2px}"
			+ ".sky-card-foot{padding:3px 10px 6px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(128,128,128,.25));font-size:9.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#888)}"
			// 状态行
			+ ".sky-status{flex-shrink:0;height:28px;box-sizing:border-box;border-top:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));display:flex;align-items:center;gap:6px;padding:0 8px;font-size:12px;color:var(--dsw-alias-label-secondary,#aaa);white-space:nowrap;overflow:hidden}"
			+ ".sky-status .sky-live{color:#4CAF7D}"
			+ ".sky-status .sky-hold{color:#E5743C}"
			// 图层面板（可折叠 14 项——checkbox 原生行为，不加 preventDefault）
			+ ".sky-cfg{flex-shrink:0;max-height:0;overflow-y:auto;overflow-x:hidden;transition:max-height .18s ease;border-top:0;background:transparent}"
			+ ".sky-cfg-open{max-height:230px;overflow:visible;border-top:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06))}"
			+ ".sky-cfg-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px 8px;padding:6px 8px 2px 8px}"
			+ ".sky-cfg-item{display:flex;align-items:center;gap:4px;font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.7;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
			+ ".sky-cfg-item input{margin:0;flex:none;accent-color:var(--dsw-alias-state-business-primary,#5B8DEF)}"
			+ ".sky-cfg-item:hover{color:var(--dsw-alias-label-primary,#eee)}"
			// ：速度/视图下拉与工具栏下拉通用（SkyDrop 自造组件——原生 select 已全量替换）
			// 时刻跳转面板（可折叠——年/月/日/时/分六数字框，万年历 NumInput 同款 13px）
			+ ""
			+ ""
			+ ""
			+ ""
			+ ""
			// 天象事件日历（可折叠列表）
			+ ".sky-ev{flex-shrink:0;max-height:0;overflow-y:auto;overflow-x:hidden;transition:max-height .18s ease;border-top:0;background:transparent}"
			+ ".sky-ev-open{max-height:260px;border-top:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06))}"
			+ ".sky-ev-head{padding:5px 10px 2px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#888)}"
			+ ".sky-ev-item{display:flex;gap:8px;align-items:baseline;padding:2px 10px;font-size:11px;line-height:1.7;color:var(--dsw-alias-label-secondary,#aaa);white-space:nowrap}"
			+ ".sky-ev-item .sky-ev-date{font-family:" + FONT_MONO + ";color:var(--dsw-alias-label-primary,#ddd);flex:none}"
			+ ".sky-ev-item .sky-ev-type{flex:none;color:#5B8DEF}"
			+ ".sky-ev-empty{padding:8px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary,#888)}"
			// 观测位置设置面板
			+ ".sky-pos{flex-shrink:0;max-height:0;overflow:hidden;transition:max-height .18s ease;border-top:0;background:transparent}"
			+ ".sky-pos-open{max-height:64px;overflow:visible;border-top:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06))}"
			+ ".sky-pos-row{display:flex;gap:6px;align-items:center;padding:7px 10px;font-size:11px;color:var(--dsw-alias-label-secondary,#aaa);flex-wrap:nowrap}"
			+ ".sky-pos-input{width:64px;height:22px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.3));border-radius:3px;background:transparent;color:inherit;font-size:10.5px;padding:0 4px;flex:none;outline:none}";

		// Lucide 内联图标（MIT lucide.dev——12px 线性 stroke=currentColor）
function lucideIcon(paths, size) {
  return createElement("svg", { width: size || 12, height: size || 12, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    style: { verticalAlign: "-1px", marginRight: "2px", flexShrink: 0 } },
    paths.map(function (d, i) { return createElement("path", { key: i, d: d }); }));
}var ICON_PLAY2 = ["M6 4.5v15l13-7.5z"];
var ICON_PAUSE2 = ["M9 5v14", "M15 5v14"];   // 两条竖线（简约版）
var ICON_RADIO2 = ["M4.9 19.1C1 15.2 1 8.8 4.9 4.9", "M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5", "M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5", "M19.1 4.9C23 8.8 23 15.2 19.1 19.1", "M12 12h.01"];
var ICON_CLOCK2 = ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3.5 2"];

var ICON_PIN = ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"];
var ICON_SPARKLE = ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"];

// DSH 原生下拉同款 chevron（Lucide ChevronDown——内联 SVG，14px，色由 .sky-drop-chev 控制）
function chevronDown() {
  return createElement("svg", { width: 9, height: 9, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "m6 9 6 6 6-6" }));
}

// 自造下拉组件（替代原生 select——形态对齐 DSH：无边框菜单+外圈阴影+chevron 展开旋转+当前项高亮）
// props: value/options([{v,l}])/onChange(v)/title
function SkyDrop(props) {
  var openSt = useState(false), isOpen = openSt[0], setOpen = openSt[1];
  var cur = null;
  for (var i = 0; i < props.options.length; i++) {
    if (String(props.options[i].v) === String(props.value)) cur = props.options[i];
  }
  return createElement("div", { className: "sky-drop" },
    isOpen ? createElement("div", { className: "sky-drop-mask", onClick: function () { setOpen(false); } }) : null,
    createElement("button", { type: "button", className: "sky-drop-btn", title: props.title, onClick: function () { setOpen(!isOpen); } },
      cur ? cur.l : "",
      createElement("span", { className: "sky-drop-chev" + (isOpen ? " open" : "") }, chevronDown())),
    isOpen ? createElement("div", { className: "sky-drop-menu" + (props.dir === 'up' ? " sky-drop-menu-up" : "") },
      props.options.map(function (o) {
        return createElement("button", {
          type: "button", key: o.v,
          className: "sky-drop-item" + (cur === o ? " on" : ""),
          onClick: function () { setOpen(false); props.onChange(o.v); }
        }, o.l);
      })) : null);
}
   // Lucide clock（circle+polyline 转路径）

function PanelBody() {
			var canvasRef = useRef(null);
			var wrapRef = useRef(null);
			var engineRef = useRef(null);
			var liveSt = useState(true), live = liveSt[0], setLive = liveSt[1];
			var cfgSt = useState(false), showCfg = cfgSt[0], setShowCfg = cfgSt[1];
			var tickSt = useState(0), setTick = tickSt[1];
			var tipSt = useState(null), tip = tipSt[0], setTip = tipSt[1];
			var detailSt = useState(null), detail = detailSt[0], setDetail = detailSt[1];   //  详情卡（行星 key / null）
			var sizeSt = useState(320), dispSize = sizeSt[0], setDispSize = sizeSt[1];
			var sizeRef = useRef(320);
			// ：动画播放 / 视图切换 / 事件日历 / 位置面板
			var playSt = useState(false), playing = playSt[0], setPlaying = playSt[1];
			var speedSt = useState(1), speed = speedSt[0], setSpeed = speedSt[1];
			var viewSt = useState('chart'), view = viewSt[0], setView = viewSt[1];
			var evSt = useState(false), showEv = evSt[0], setShowEv = evSt[1];
			var posSt = useState(false), showPos = posSt[0], setShowPos = posSt[1];
			var latRef = useRef(null), lonRef = useRef(null);
			
			

			// canvas 显示尺寸 = 容器宽高较小边（正方形圆图）；backing 随动 = 显示尺寸×DPR（resizeTo）
			function fitSize() {
				var w = wrapRef.current;
				if (!w) return;
				var s = Math.min(w.clientWidth, w.clientHeight);
				if (s > 0) { sizeRef.current = s; setDispSize(s); }
			}

			// 显示尺寸变化 → 先于浏览器绘制重设 backing+transform 并重绘（防拉伸中间帧）
			useLayoutEffect(function () {
				if (engineRef.current) engineRef.current.resizeTo(dispSize);
			}, [dispSize]);

			useEffect(function () {
				if (!canvasRef.current) return;
				fitSize();
				var eng = createSkyEngine(canvasRef.current, sizeRef.current);
				engineRef.current = eng;
				eng.makeInterval();
				setLive(true);
				// HOLD 态下 DSH 主题切换（CSS 变量变化）→ 重绘跟随；顺带自愈浏览器缩放引起的 DPR 变化
				var poll = setInterval(function () {
					eng.resizeTo(sizeRef.current);
					if (eng.themeChanged()) eng.paint();
					setPlaying(eng.isPlaying());   // 键盘自动暂停后播放态同步
					setTick(function (t) { return t + 1; });
				}, 1000);
				var ro = new ResizeObserver(fitSize);
				ro.observe(wrapRef.current);
				return function () {
					clearInterval(poll);
					ro.disconnect();
					eng.killInterval();
					engineRef.current = null;
				};
			}, []);

			function refreshUi() {
				var eng = engineRef.current;
				if (eng) setLive(eng.isLive());
				setTick(function (t) { return t + 1; });
			}
			function holdToggle() {
				var eng = engineRef.current;
				if (!eng) return;
				if (eng.isPlaying()) { eng.stopPlayback(); eng.paint(); }   // 播放中 → 暂停（HOLD）
				else if (eng.isLive()) { eng.killInterval(); eng.paint(); }
				else eng.goNow();
				refreshUi();
			}
			// ：播放/暂停（虚拟时间推进——用户任何时间操作自动暂停）
			function playToggle() {
				var eng = engineRef.current;
				if (!eng) return;
				if (eng.isPlaying()) { eng.stopPlayback(); eng.paint(); }
				else { eng.setPlaySpeed(speed); eng.startPlayback(); }
				setPlaying(eng.isPlaying());
				refreshUi();
			}
			
			
			
			function onSpeedChange(v) {
				var n = parseInt(v, 10);
				var eng = engineRef.current;
				setSpeed(n);
				if (eng) eng.setPlaySpeed(n);
			}
			function onViewChange(v) {
				var eng = engineRef.current;
				setView(v);
				if (eng) eng.setView(v);
			}
			function onPresetPos(v) {
				var eng = engineRef.current;
				var idx = parseInt(v, 10);
				if (isNaN(idx) || !eng) return;
				var p = POS_PRESETS[idx];
				eng.setPosition(p[1], p[2], p[3]);
				setPresetSel(v);   // 保留选中——按钮显示城市名（可感知反馈）
				if (latRef.current) latRef.current.value = '' + p[1];
				if (lonRef.current) lonRef.current.value = '' + p[2];
			}
			function applyPos() {
				var eng = engineRef.current;
				if (!eng || !latRef.current || !lonRef.current) return;
				var lat = parseFloat(latRef.current.value), lon = parseFloat(lonRef.current.value);
				if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
				eng.setPosition(lat, lon, 0);
				}


			function shiftTime(fn, d) {
				var eng = engineRef.current;
				if (!eng) return;
				fn.call(eng, d);   // 引擎 shift* 内部含 killInterval（时间操作自动暂停）
				refreshUi();
			}
			function onKey(e) {
				var eng = engineRef.current;
				if (!eng) return;
				eng.handleKeydown(e);
				refreshUi();
			}
			var unitSt = useState("\u65e5"), unit = unitSt[0], setUnit = unitSt[1];   // \u00b1\u6309\u94ae\u6b65\u957f\u5355\u4f4d\uff08\u5206/\u65f6/\u65e5/\u6708/\u5e74\uff09
			var spanUnitSt = useState("\u65e5"), spanUnit = spanUnitSt[0], setSpanUnit = spanUnitSt[1];   // E/R 跨度单位（SkyDrop 受控）
			var presetSelSt = useState(""), presetSel = presetSelSt[0], setPresetSel = presetSelSt[1];   // 城市预设（SkyDrop 受控——选择即回 ""）
			function stepUnit(dir) {
				var eng = engineRef.current;
				if (!eng) return;
				var fn2 = unit === '\u5206' ? eng.shiftMinute : unit === '\u65f6' ? eng.shiftHour : unit === '\u65e5' ? eng.shiftDay : unit === '\u6708' ? eng.shiftMonth : eng.shiftYear;
				shiftTime(fn2, dir);
			}
			function toggleCfg() { setShowCfg(function (v) { if (!v) { setShowEv(false); setShowPos(false); } return !v; }); }
			function toggleEv() { setShowEv(function (v) { if (!v) { setShowCfg(false); setShowPos(false); } return !v; }); }
			function togglePos() { setShowPos(function (v) { if (!v) { setShowCfg(false); setShowEv(false); } return !v; }); }
			function toggleSetting(k) {
				var eng = engineRef.current;
				if (!eng) return;
				eng.toggleSetting(k);
				setTick(function (t) { return t + 1; });
			}
			function onSpanChange(e) {
				var eng = engineRef.current;
				var v = parseFloat(e.target.value);
				if (eng && !isNaN(v)) eng.setTimeSpan(v);
			}
			function onUnitChange(v) {
				var eng = engineRef.current;
				setSpanUnit(v);
				if (eng) eng.setTimeUnit(v);
			}

			// 悬停：CSS px → 720 坐标 → hitTest
			function dmsShort(v) {   // 度分格式（天顶图 tooltip 用）：45°30′ / -12°05′
				var s = v < 0 ? '-' : '';
				v = Math.abs(v);
				var d = Math.floor(v), m = Math.round((v - d) * 60);
				if (m === 60) { d++; m = 0; }
				return s + d + '°' + (m < 10 ? '0' : '') + m + '′';
			}
			function onMove(e) {
				var eng = engineRef.current;
				var c = canvasRef.current;
				if (!eng || !c) return;
				var rect = c.getBoundingClientRect();
				if (!rect.width) return;
				var x = (e.clientX - rect.left) * SIZE / rect.width;
				var y = (e.clientY - rect.top) * SIZE / rect.height;
				var hit = eng.hitTest(x, y);
				if (hit) {
					var p = hit.planet;
					var retroTxt = p.retro.state === 0 ? ('逆行第 ' + p.retro.days + ' 天') : '顺行';
					var lines;
					if (eng.getView() === 'zenith') {
						// 天顶图 tooltip：地平读数为主（度分）+ 可见性 + 升落时刻
						var zc = eng.card(p.key);
						lines = [
							['名称', p.cn + ' ' + P_LATIN[p.cn]],
							['高度', dmsShort(p.alt)],
							['方位', dmsShort(p.az)],
							['可见性', p.alt > 0 ? '地平线上 · 可见' : (p.alt > -10 ? '地平线下 · 快升起' : '地平线下 · 不可见')],
							['升起', zc && zc.rise ? zc.rise : '—'],
							['降下', zc && zc.set ? zc.set : '—']
						];
					} else {
						lines = [
							['名称', p.cn + ' ' + P_LATIN[p.cn]],
							['黄经', lonDMS(p.elon) + '（' + GONG[Math.floor(p.elon / 30) % 12] + '宫）'],
							['入宿', x28n[p.xiuIdx] + '宿 ' + p.du + '度 · ' + p.xiang],
							['黄纬', (p.elat >= 0 ? '+' : '') + p.elat.toFixed(2) + '°'],
							['距离', p.dist.toFixed(3) + ' AU'],
							['星等', p.mag != null ? p.mag.toFixed(1) : '—'],
							['运动', retroTxt + ' · 时角 ' + p.timeAngle],
							['地平', '高度 ' + p.alt.toFixed(1) + '° · 方位 ' + p.az.toFixed(1) + '°']
						];
					}
					if (p.elong != null) lines.push(['月相', '距日 ' + p.elong.toFixed(1) + '° · 照亮 ' + Math.round(p.illum * 100) + '%']);
					// tooltip 跟随鼠标（canvas 坐标系内定位，翻转防出界）
					var tx = e.clientX - rect.left + 12, ty = e.clientY - rect.top + 12;
					if (tx > rect.width - 190) tx -= 200;
					if (ty > rect.height - 120) ty -= 130;
					setTip({ x: tx, y: ty, lines: lines, color: P_COLOR[p.cn] });
				} else if (tip) {
					setTip(null);
				}
			}
			function onLeave() { setTip(null); }

			// ：点击行星 → 弹出详情卡；点击空白 → 关闭
			function onClick(e) {
				var eng = engineRef.current;
				var c = canvasRef.current;
				if (!eng || !c) return;
				var rect = c.getBoundingClientRect();
				if (!rect.width) return;
				var x = (e.clientX - rect.left) * SIZE / rect.width;
				var y = (e.clientY - rect.top) * SIZE / rect.height;
				var hit = eng.hitTest(x, y);
				setDetail(hit ? hit.planet.key : null);
			}

			var eng = engineRef.current;
			var s = eng ? eng.getSettings() : null;
			var info = eng ? eng.getInfo() : [];
				var nowD = eng ? eng.getNow() : new Date();
					function pad(x) { return (x < 10 ? '0' : '') + x; }
			var clock = nowD.getFullYear() + '-' + pad(nowD.getMonth() + 1) + '-' + pad(nowD.getDate()) + ' ' + pad(nowD.getHours()) + ':' + pad(nowD.getMinutes()) + ':' + pad(nowD.getSeconds());
			var sunRow = null, moonRow = null, jupRow = null;
			for (var r = 0; r < info.length; r++) {
				if (info[r].key === 'Sun') sunRow = info[r];
				else if (info[r].key === 'Moon') moonRow = info[r];
				else if (info[r].key === 'Jupiter') jupRow = info[r];
			}
			var lunarStr = eng ? String(eng.getLunarText(nowD)).replace(/.*年/, '') : '';

			var cfgPanel;
			if (showCfg) {
				var items = [];
				for (var i = 0; i < LAYER_ITEMS.length; i++) {
					(function (it) {
						items.push(createElement("label", {
							key: it[0], className: "sky-cfg-item", title: it[1]
						},
							createElement("input", {
								type: "checkbox",
								checked: !!(s && s[it[0]]),
								onChange: function () { toggleSetting(it[0]); }
							}),
							it[1]));
					})(LAYER_ITEMS[i]);
				}
				cfgPanel = createElement("div", { className: "sky-cfg sky-cfg-open" },
					createElement("div", { className: "sky-cfg-grid" }, items),
					createElement("div", { className: "sky-cfg-item", style: { gridTemplateColumns: "none", paddingLeft: "6px", overflow: "visible", paddingTop: "8px", paddingBottom: "6px" } },
						"E/R 跨度按键:",
						createElement("input", {
							className: "sky-span-input", type: "number", defaultValue: "30",
							onChange: onSpanChange, title: "快捷键 E(退)/R(进) 的跨度值"
						}),
						createElement(SkyDrop, { value: spanUnit, onChange: onUnitChange, title: "E/R 跨度单位", dir: "up",
							options: [{ v: "年", l: "年" }, { v: "月", l: "月" }, { v: "日", l: "日" }] })));
			} else {
				cfgPanel = createElement("div", { className: "sky-cfg" });
			}

			// ：天象事件日历（可折叠——未来 30 天，localStorage 按日缓存）
			var evPanel;
			if (showEv) {
				var evList = eng ? eng.getEvents() : [];
				var evItems = evList.map(function (ev, i) {
					return createElement("div", { className: "sky-ev-item", key: i },
						createElement("span", { className: "sky-ev-date" }, ev.when),
						createElement("span", { className: "sky-ev-type" }, ev.type),
						createElement("span", null, ev.text));
				});
				evPanel = createElement("div", { className: "sky-ev sky-ev-open" },
					createElement("div", { className: "sky-ev-head" }, "未来 30 天天象（日月食 / 行星合 / 冲日 / 大距 · 当日缓存）"),
					evItems.length ? evItems : createElement("div", { className: "sky-ev-empty" }, "未来 30 天无重大天象"));
			} else {
				evPanel = createElement("div", { className: "sky-ev" });
			}

			// ：观测位置设置（图②天顶图与悬停地平读数共用）
			var posPanel;
			if (showPos) {
				var curPos = eng ? eng.getPosition() : DEFAULT_POSITION;
				var presetOpts = [{ v: "", l: "城市预设" }];
				for (var pi = 0; pi < POS_PRESETS.length; pi++) {
					(function (pp, idx) {
						presetOpts.push({ v: '' + idx, l: pp[0] });
					})(POS_PRESETS[pi], pi);
				}
				posPanel = createElement("div", { className: "sky-pos sky-pos-open" },
					createElement("div", { className: "sky-pos-row" },
						"纬度", createElement("input", { ref: latRef, className: "sky-pos-input", type: "number", step: "0.1", defaultValue: curPos.latitude, title: "-90 ~ 90" }),
						"经度", createElement("input", { ref: lonRef, className: "sky-pos-input", type: "number", step: "0.1", defaultValue: curPos.longitude, title: "-180 ~ 180" }),
						createElement("button", { type: "button", className: "sky-btn", title: "应用经纬度（重绘天顶图）", onClick: applyPos }, "应用"),
						createElement(SkyDrop, { value: presetSel, onChange: onPresetPos, options: presetOpts, dir: "up" })));
			} else {
				posPanel = createElement("div", { className: "sky-pos" });
			}

			// 时刻跳转面板（六数字框 + 跳转/今——与图层/事件/位置同款折叠体系）
			

			var tipEl = null;
			if (tip) {
				var rows = tip.lines.map(function (ln, i2) {
					return createElement("div", { key: i2 },
						createElement("span", { style: { color: "var(--dsw-alias-label-tertiary,#888)" } }, ln[0] + " "),
						createElement("b", { style: { color: i2 === 0 ? tip.color : "inherit" } }, ln[1]));
				});
				tipEl = createElement("div", {
					className: "sky-tip",
					style: { left: tip.x + "px", top: tip.y + "px" }
				}, rows);
			}

			// 行星详情卡（）：位置跟随行星（每秒重渲染），数据取引擎 card()（升/中/落按日缓存）
			var cardEl = null;
			if (detail && eng) {
				var cd = eng.card(detail);
				var tpos = null;
				var htg = eng.getHitTargets();
				for (var hi = 0; hi < htg.length; hi++) {
					if (htg[hi].planet.key === detail) { tpos = htg[hi]; break; }
				}
				if (cd && tpos) {
					var cxp = tpos.x * dispSize / SIZE, cyp = tpos.y * dispSize / SIZE;
					var left = cxp > dispSize / 2 ? cxp - 222 : cxp + 14;   // 行星在右半 → 卡片放左侧
					if (left > dispSize - 212) left = dispSize - 212;   // 右限先于左限（极小面板防负坐标）
					if (left < 4) left = 4;
					var top = cyp - 16;
					if (top > dispSize - 208) top = dispSize - 208;
					if (top < 4) top = 4;
					var compact = dispSize < 380;   // 小面板裁次要行
					function crow(key, label, value) {
						return [createElement("span", { key: key + 'l' }, label), createElement("b", { key: key + 'v' }, value)];
					}
					var crows = [].concat(
						crow('elon', '黄经', cd.elonDMS + ' · ' + cd.gong + '宫'),
						crow('xiu', '入宿', cd.xiu + '宿 ' + cd.du + '度 · ' + cd.xiang));
					if (!compact) crows = crows.concat(
						crow('elat', '黄纬', (cd.elat >= 0 ? '+' : '') + cd.elat.toFixed(2) + '°'),
						crow('mag', '星等', cd.mag != null ? cd.mag.toFixed(1) : '—'));
					crows = crows.concat(
						crow('dist', '距离', cd.dist.toFixed(3) + ' AU · ' + cd.distPct + '%'),
						createElement("div", { className: "sky-card-bar", key: "bar" },
							createElement("i", { style: { width: cd.distPct + "%", background: cd.color } })),
						crow('move', '运动', cd.retro ? '逆行第 ' + cd.retroDays + ' 天' : '顺行'));
					if (!compact) crows = crows.concat(crow('ha', '时角', cd.timeAngle));
					if (cd.elong != null) crows = crows.concat(crow('mp', '月相', '距日 ' + cd.elong.toFixed(1) + '° · 照亮 ' + Math.round(cd.illum * 100) + '%'));
					crows = crows.concat(
						crow('rise', '升起', cd.rise || '—'),
						crow('tran', '中天', cd.transit || '—'),
						crow('set', '降下', cd.set || '—'));
					cardEl = createElement("div", { className: "sky-card", style: { left: left + "px", top: top + "px" } },
						createElement("div", { className: "sky-card-head" },
							createElement("i", { className: "sky-card-dot", style: { background: cd.color, color: cd.color } }),
							cd.cn + ' ' + cd.symbol,
							createElement("span", { className: "sky-card-lat" }, cd.latin)),
						createElement("div", { className: "sky-card-body" }, crows),
						createElement("div", { className: "sky-card-foot" }, "点击空白关闭 · 升/中/落观测地：" + (eng && eng.getPosition ? (eng.getPosition().latitude.toFixed(1) + 'N ' + eng.getPosition().longitude.toFixed(1) + 'E') : '位置面板') + "（今日）"));
				}
			}

			return createElement("div", { className: "sky-root" },
				createElement("div", { className: "sky-toolbar" },
					createElement("button", { type: "button", className: "sky-btn", title: "\u524d\u4e00\u4e2a\u6240\u9009\u5355\u4f4d\uff08\u5206D \u65f6N \u65e5J\uff09", onClick: function () { stepUnit(-1); } }, "\u2212"),
					createElement(SkyDrop, { value: unit, onChange: function (v) { setUnit(v); }, title: "\u00b1\u6309\u94ae\u7684\u6b65\u957f\u5355\u4f4d",
						options: [
							{ v: "\u5206", l: "\u5206" }, { v: "\u65f6", l: "\u65f6" }, { v: "\u65e5", l: "\u65e5" },
							{ v: "\u6708", l: "\u6708" }, { v: "\u5e74", l: "\u5e74" }] }),
					createElement("button", { type: "button", className: "sky-btn", title: "\u540e\u4e00\u4e2a\u6240\u9009\u5355\u4f4d\uff08\u5206F \u65f6M \u65e5K\uff09", onClick: function () { stepUnit(1); } }, "\uff0b"),
					createElement("button", { type: "button", className: "sky-btn", title: live ? "暂停（Space）" : "回到现在+实时（H）", onClick: holdToggle }, [lucideIcon(live ? ICON_PAUSE2 : ICON_RADIO2, 13), live ? "暂停" : "实时"]),
					createElement("button", { type: "button", className: "sky-btn" + (live ? " sky-btn-on" : ""), title: "回到现在（H）", onClick: function () { var e2 = engineRef.current; if (e2) { e2.goNow(); refreshUi(); } } }, [lucideIcon(ICON_CLOCK2, 13), "现在"]),
					createElement(TimeSegments, { now: nowD, onSeg: function (key, v) {
						var eng = engineRef.current;
						if (!eng) return;
						var t = new Date(eng.getNow().getTime());
						if (key === 'y') t.setFullYear(v);
						else if (key === 'm') t.setMonth(v - 1);
						else if (key === 'd') t.setDate(v);
						else if (key === 'h') t.setHours(v);
						else if (key === 'mi') t.setMinutes(v);
						else if (key === 's') t.setSeconds(v);
						eng.setNow(t);
						refreshUi();
					} }),
					
					createElement("span", { className: "sky-spacer" }),
					createElement("button", { type: "button", className: "sky-btn" + (playing ? " sky-btn-on" : ""), title: playing ? "暂停播放（Space）" : "播放：虚拟时间推进（1×/100×/1000×，任意时间操作自动暂停）", onClick: playToggle }, playing ? [lucideIcon(ICON_PAUSE2, 13), "播放中"] : [lucideIcon(ICON_PLAY2, 13), "播放"]),
					createElement(SkyDrop, { value: speed, onChange: onSpeedChange, title: "播放速度（每秒推进的虚拟秒数）",
						options: [{ v: 1, l: "1×" }, { v: 100, l: "100×" }, { v: 1000, l: "1000×" }] }),
					createElement(SkyDrop, { value: view, onChange: onViewChange, title: "视图：①行星图（黄经圆图）/ ②天顶图（地平坐标投影）",
						options: [{ v: "chart", l: "行星图" }, { v: "zenith", l: "天顶图" }] }),
					createElement("button", { type: "button", className: "sky-btn" + (showPos ? " sky-btn-on" : ""), title: "观测位置（天顶图/地平读数）", onClick: togglePos }, [lucideIcon(ICON_PIN), "位置"]),
					createElement("button", { type: "button", className: "sky-btn" + (showEv ? " sky-btn-on" : ""), title: "未来 30 天天象事件（日月食/行星合/冲日/大距）", onClick: toggleEv }, [lucideIcon(ICON_SPARKLE), "事件"]),
					createElement("button", { type: "button", className: "sky-btn" + (showCfg ? " sky-btn-on" : ""), title: "图层开关（12 项）", onClick: toggleCfg }, "☰ 图层")),
				
				createElement("div", { className: "sky-chart", ref: wrapRef },
					createElement("canvas", {
						ref: canvasRef,
						className: "sky-canvas",
						tabIndex: 0,
						style: { width: dispSize + "px", height: dispSize + "px" },
						onKeyDown: onKey,
						onMouseMove: onMove,
						onMouseLeave: onLeave,
						onClick: onClick,
						onMouseDown: function () { if (canvasRef.current && canvasRef.current.focus) canvasRef.current.focus(); }
					}),
					tipEl,
					cardEl),
				evPanel,
				posPanel,
				cfgPanel,
				createElement("div", { className: "sky-status" },
						createElement("span", { className: playing ? "sky-live" : (live ? "sky-live" : "sky-hold") },
							playing ? ("▶ 播放中 " + speed + "×") : (live ? "● 实时刷新中" : "⏸ 已暂停")),
					createElement("span", null, clock),
					createElement("span", null, "|"),
					sunRow ? createElement("span", null, "太阳在" + x28n[sunRow.xiuIdx] + "宿") : null,
					moonRow ? createElement("span", null, "月亮在" + x28n[moonRow.xiuIdx] + "宿") : null,
					jupRow ? createElement("span", null, "木星在" + x28n[jupRow.xiuIdx] + "宿") : null,
					lunarStr ? createElement("span", null, "农历" + lunarStr) : null,
					eng && eng.getView() === 'zenith' ? createElement("span", null, "②天顶图 " + (eng ? eng.getPosition().latitude.toFixed(1) + 'N ' + eng.getPosition().longitude.toFixed(1) + 'E' : '')) : null),
				);
		}

		// ════════════════════════════════════════════════════════════════
		// §10 注册（两段式——DSH 公开面：sidebarRightTabs + slots）
		// ════════════════════════════════════════════════════════════════
		var inject = ["slots", "sidebarRightTabs"];

		function apply(ctx) {
			ctx.effect(function () {
				return ctx.sidebarRightTabs.register({
					id: PANEL_ID,
					kind: KIND,
					priority: "extension",
					title: function () { return "星图"; },
					guide: [{
						order: 930,
						title: function () { return "星图"; },
						description: function () { return "天文仪器圆图：七曜+28宿+节气+月相+四象星官连线（AE 引擎·原创 UI）；点击行星弹出详情卡；点击画布后可用快捷键"; }
					}]
				});
			}, "dsh-sky-panel: tab type");

			ctx.effect(function () {
				var styleEl = document.createElement("style");
				styleEl.setAttribute("data-plugin", PANEL_ID);
				styleEl.textContent = CSS;
				document.head.appendChild(styleEl);
				return function () { styleEl.remove(); };
			}, "dsh-sky-panel: style");

			ctx.effect(function () {
				return ctx.slots.inject("sidebar.right.pane.tab", function () {
					return ctx.slots.register({
						name: "sidebar.right.pane.tab",
						key: PANEL_ID
					}, PanelBody);
				});
			}, "dsh-sky-panel: tab body");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.createEngine = createSkyEngine;   // 离线 verify 冒烟口（绘制链全跑）
		exports.findAspects = findAspects;        // 相位连线纯函数（verify 可测）
			exports.ASPECT_COLOR = ASPECT_COLOR;      // 相位语义色映射（verify 断言）
			exports.computeEvents30 = computeEvents30;   //  天象事件纯函数（verify 可测）
			exports.projectHor = projectHor;             //  天顶图投影纯函数（verify 几何锚）
			return module.exports;
	}
});
