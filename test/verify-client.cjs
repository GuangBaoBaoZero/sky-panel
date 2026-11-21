// verify-client.cjs — client.js 离线验证（REDESIGN v1.6 Phase 2b 断言体系）
// 环境：classic script（同 DSH ModuleLoader 的 <script> 语义）
// 断言组：
//   1) AE UMD 挂载  2) 知识层  3) 工厂注册面  4) 引擎冒烟（构造即 paint 全链真实 AE 计算）
//   5) 布局断言（Proxy ctx 记录 arc 半径 340/310/280/250 三圈+黄道圈）
//   6) 行星功能色（#FFB300 太阳 / #EF5350 火星 / #42A5F5 海王星 落入 fillStyle）
//   7) 命名星补丁（28 宿距星 EclipticLongitude vs Rotation_EQJ_ECT 手算链 全 28 星 <0.01°）
//   8) 黄经锚点（2026-10-31 太阳 217.9°；2020-12-21 木土大合相 300.3° 互差 <0.2°）
//   9) 宿界不等分（黄经口径：觜最窄 <2.5° / 井最宽 >25°）
//  10) 月相（elong 与 AE Illumination phase_fraction 一致；terminator 椭圆弧调用存在）
//  11) 图层 14 项逐一翻转 + paint 重跑不炸  12) 键盘（J/K/N/M/D/F/H/Space/E/R + 方向键）
//  13) 悬停命中 hitTest  14) 几何锚（冬至 270°=正下 / 夏至 90°=正上）
//  15) 农历 golden 对照（内置 AE 农历 vs 万年历寿星历 golden 2020-2030）
//  16) 动态尺寸+DPR（resizeTo：backing=显示尺寸×dpr / setTransform 等比映射 / 幂等不重绘）
//  17) Phase 2b 四象星官连线（r284 弧 + 四色 + 28 距星点 + 组内黄经单调）
//  18) Phase 2b 十二辰色带环（六方位色锚 #5C7CFA…#B197FC 全落 fillStyle + 环带 r318）
//  19) 行星纯色平面圆点（零 createRadialGradient + 功能色 fillStyle + 无高光点）
//  20) Phase 2b 相位连线语义分色（findAspects 纯函数：合/冲/三合 + 木土大合相 golden + 语义色映射）
//  21) Phase 2b 行星详情卡（card()：符号/度分秒/入宿/距离百分比/升中落 vs AE 直算一致 + 日缓存）
// 用法：node test\verify-client.cjs
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");

// classic <script> 语义：全局作用域、无 module/exports/define —— UMD 走 g.Astronomy=f() 分支
globalThis.window = globalThis;
let reg = null;
window.__ModuleLoader__ = { load: function (r) { reg = r; } };

// localStorage stub（引擎构造/开关持久化用）
const lsStore = {};
globalThis.localStorage = {
	getItem: function (k) { return k in lsStore ? lsStore[k] : null; },
	setItem: function (k, v) { lsStore[k] = String(v); },
};

vm.runInThisContext(fs.readFileSync(path.join(ROOT, "lib", "client.js"), "utf8"), { filename: "client.js" });

let pass = 0, fail = 0;
function ok(cond, msg) {
	if (cond) { pass++; console.log("  ✓ " + msg); }
	else { fail++; console.log("  ✗ FAIL: " + msg); }
}

// canvas 2D ctx stub：吸收 2D 调用 + 记录 arc 半径 / ellipse 半轴 / fillStyle / strokeStyle / 渐变 / setTransform（布局与色彩断言用）
function makeCtx() {
	const calls = { arc: [], ellipse: [], fillStyle: [], setTransform: [], strokeStyle: [], radial: [], fillText: [], moveTo: [], lineTo: [], lineWidth: [] };
	const store = {
		__calls: calls,
		canvas: {},
		measureText: function (t) { return { width: String(t == null ? "" : t).length * 8 + 4 }; },
		arc: function (x, y, r) { calls.arc.push(r); },
		fillText: function (t, x, y) { calls.fillText.push(String(t)); },
		ellipse: function (x, y, rx, ry) { calls.ellipse.push([rx, ry]); },
		moveTo: function (x, y) { calls.moveTo.push([x, y]); },
		lineTo: function (x, y) { calls.lineTo.push([x, y]); },
		setTransform: function (a, b, c, d, e, f) { calls.setTransform.push([a, b, c, d, e, f]); },
		createRadialGradient: function (x1, y1, r1, x2, y2, r2) {
			calls.radial.push([x1, y1, r1, x2, y2, r2]);
			return { addColorStop: function () {} };
		},
	};
	return new Proxy(store, {
		get: function (t, k) { if (k in t) return t[k]; const fn = function () {}; t[k] = fn; return fn; },
		set: function (t, k, v) {
			if (k === "fillStyle") calls.fillStyle.push(v);
			if (k === "strokeStyle") calls.strokeStyle.push(v);
			if (k === "lineWidth") calls.lineWidth.push(v);
			t[k] = v; return true;
		}
	});
}
function makeCanvas() {
	const ctx = makeCtx();
	return {
		width: 720, height: 720, style: {},
		getContext: function () { return ctx; },
		__ctx: ctx,
		addEventListener: function () {}, focus: function () {}
	};
}

console.log("== 1) UMD 兼容（classic script → window.Astronomy）==");
ok(!!window.Astronomy, "window.Astronomy 已挂载");
ok(typeof window.Astronomy.GeoVector === "function", "Astronomy.GeoVector 可用");
ok(typeof window.Astronomy.Ecliptic === "function", "Astronomy.Ecliptic 可用");
ok(typeof window.Astronomy.DefineStar === "function", "Astronomy.DefineStar 可用");
ok(typeof window.Astronomy.SearchMoonPhase === "function", "Astronomy.SearchMoonPhase 可用（农历朔搜）");
ok(typeof window.Astronomy.SearchSunLongitude === "function", "Astronomy.SearchSunLongitude 可用（农历中气）");
ok(typeof window.Astronomy.PairLongitude === "function", "Astronomy.PairLongitude 可用（月相距角）");

console.log("== 2) 知识层（window.__sky_knowledge__）==");
const K = window.__sky_knowledge__;
ok(!!K && K.X28_STARS.length === 28, "28 宿距星 28 条");
ok(K.BRIGHT_STARS.length === 11, "亮星 11 条");
ok(K.X28_NAMES === "角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸", "X28_NAMES 28 宿名");

console.log("== 3) 工厂实例化（React stub）==");
const React = {
	createElement: function () { return null; },
	useState: function (v) { return [typeof v === "function" ? v() : v, function () {}]; },
	useEffect: function () {},
	useRef: function () { return { current: null }; }
};
const mod = reg.factory(function (name) { if (name === "react") return React; throw new Error("unexpected require: " + name); });
ok(!!mod && typeof mod.apply === "function", "exports.apply 函数");
ok(JSON.stringify(mod.inject) === JSON.stringify(["slots", "sidebarRightTabs"]), "exports.inject = [slots, sidebarRightTabs]（公开面）");
ok(typeof mod.createEngine === "function", "exports.createEngine 冒烟口可用");

console.log("== 4) 引擎冒烟（构造即 paint 全链——真实 AE 计算 + ctx stub）==");
const canvas = makeCanvas();
const eng = mod.createEngine(canvas);
const calls = canvas.__ctx.__calls;
ok(calls.arc.length > 20, "绘制链已跑（arc 调用 " + calls.arc.length + " 次）");
const rows = eng.getInfo();
ok(rows.length === 9, "行星数据 9 行（七曜+天王+海王）");
const structOK = rows.every(function (r) {
	return typeof r.elon === "number" && typeof r.elat === "number" && typeof r.dist === "number"
		&& typeof r.xiuIdx === "number" && !!r.xiang && typeof r.du !== "undefined"
		&& r.retro && typeof r.alt === "number" && typeof r.az === "number" && !!r.timeAngle;
});
ok(structOK, "行星行结构完整（黄经/黄纬/距离/宿度/四象/顺逆/地平/时角）");
const s0 = Object.assign({}, eng.getSettings());   // 快照（getSettings 返回内部引用——防翻转后对比失效）
ok(Object.keys(s0).length === 20, "图层 settings 20 项（Phase 2b +星官连线 +行星连线 +十二辰色带 +四圈1°细刻度 +行星星座）");
ok(s0.showZodiacLabel === true, "showZodiacLabel 默认开（行星标注含星座名）");
ok(s0.showBranchColors === true, "showBranchColors 默认开（十二辰色带）");
ok(s0.fineTicksBranches === true, "fineTicksBranches 默认开（十二辰 1° 细刻度）");
ok(s0.fineTicksXiu === false && s0.fineTicksJieqi === false && s0.fineTicksEcliptic === false,
	"fineTicksXiu/Jieqi/Ecliptic 默认关（28宿/节气/黄道 1° 细刻度）");
ok(s0.twelveBranches === true && s0.xiuRing === true && s0.jieqiRing === true && s0.moonPhase === true
	&& s0.xiangLines === true && s0.aspectLines === true
	&& s0.xiuWidths === false && s0.planetOrbits === false, "图层默认值正确（三圈+月相+星官连线+行星连线开 / 宽数+轨道关）");

console.log("== 5) 布局断言（720 圆图三圈 + 黄道圈半径）==");
function hasArc(r) { return calls.arc.some(function (v) { return Math.abs(v - r) < 0.6; }); }
ok(hasArc(340), "十二辰外圈 r=340");
ok(hasArc(310), "28 宿圈 r=310");
ok(hasArc(280), "24 节气圈 r=280");
ok(hasArc(250), "黄道圈 r=250");
// 行星带参考虚线已删（v1.6——与月亮轨道/黄道圈实线重叠）——行星带断言由轨道图层覆盖

console.log("== 6) 行星功能色（固定 RGB）==");
ok(calls.fillStyle.indexOf("#FFB300") >= 0, "太阳 #FFB300");
ok(calls.fillStyle.indexOf("#EF5350") >= 0, "火星 #EF5350");
ok(calls.fillStyle.indexOf("#42A5F5") >= 0, "海王星 #42A5F5");
ok(calls.fillStyle.indexOf("#E0E0E0") >= 0, "月亮亮面 #E0E0E0");

console.log("== 7) 命名星补丁（28 宿距星黄经 vs 手算 ECT 链）==");
const A = window.Astronomy;
const DATE = new Date("2026-10-31T12:00:00Z");
const time = A.MakeTime(DATE);
function uiChain(raHours, decDeg) {
	const ra = raHours * Math.PI / 12, dec = decDeg * Math.PI / 180;
	const v = new A.Vector(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), time);
	const r = A.RotateVector(A.Rotation_EQJ_ECT(time), v);
	return ((Math.atan2(r.y, r.x) * 180 / Math.PI) % 360 + 360) % 360;
}
let worst7 = 0, worstName = "";
for (let i = 0; i < 28; i++) {
	const aeLon = A.EclipticLongitude("Star" + (i + 1), DATE);   // 经命名星补丁（轮转占用 Star1-8 槽）
	const uiLon = uiChain(K.X28_STARS[i].ra, K.X28_STARS[i].dec);
	let d = Math.abs(aeLon - uiLon); if (d > 180) d = 360 - d;
	if (d > worst7) { worst7 = d; worstName = K.X28_STARS[i].xiu; }
}
ok(worst7 < 0.01, "全 28 星最大偏差 " + worst7.toFixed(5) + "°（" + worstName + "）< 0.01°（补丁定义+查询原子）");

console.log("== 8) 黄经锚点 ==");
const sunLon = A.Ecliptic(A.GeoVector(A.Body.Sun, DATE, true)).elon;
ok(Math.abs(sunLon - 217.9) < 0.8, "2026-10-31 太阳黄经 " + sunLon.toFixed(3) + "°（期望 217.9±0.8 天蝎宫）");
const GDATE = new Date("2020-12-21T18:22:00Z");
const jLon = A.Ecliptic(A.GeoVector(A.Body.Jupiter, GDATE, true)).elon;
const sLon = A.Ecliptic(A.GeoVector(A.Body.Saturn, GDATE, true)).elon;
ok(Math.abs(jLon - 300.3) < 0.5 && Math.abs(sLon - 300.3) < 0.5,
	"2020-12-21 木土大合相 木 " + jLon.toFixed(2) + "° / 土 " + sLon.toFixed(2) + "°（≈300.3°）");
ok(Math.abs(jLon - sLon) < 0.2, "合相互差 " + Math.abs(jLon - sLon).toFixed(3) + "° < 0.2°");

console.log("== 9) 宿界不等分（黄经口径）==");
const xiuLon = K.X28_STARS.map(function (s) { return uiChain(s.ra, s.dec); });
function width(i) { let d = xiuLon[(i + 1) % 28] - xiuLon[i]; if (d <= 0) d += 360; return d; }
ok(width(19) < 2.5, "觜宿宽 " + width(19).toFixed(2) + "° < 2.5°（最窄）");
ok(width(21) > 25, "井宿宽 " + width(21).toFixed(2) + "° > 25°（最宽）");

console.log("== 10) 月相（elong 口径 + terminator 椭圆弧）==");
const moonRow = rows.find(function (r) { return r.key === "Moon"; });
ok(moonRow && typeof moonRow.elong === "number" && typeof moonRow.illum === "number",
	"月亮行含 elong/illum（当前照亮 " + Math.round(moonRow.illum * 100) + "%）");
let illOK = true;
try {
	const aeIll = A.Illumination(A.Body.Moon, new Date()).phase_fraction;
	illOK = Math.abs(aeIll - moonRow.illum) < 0.02;
} catch (e) { illOK = false; }
ok(illOK, "illum 与 AE Illumination.phase_fraction 一致（<0.02）");
const fullMoon = A.SearchMoonPhase(180, new Date("2026-01-01T00:00:00Z"), 40);
const elongFull = A.PairLongitude("Moon", "Sun", fullMoon.date);
ok(Math.abs(elongFull - 180) < 0.5, "2026 首个满月时刻 elong=" + elongFull.toFixed(2) + "°≈180°");
ok(calls.ellipse.length > 0, "月相 terminator 椭圆弧已绘制（ellipse " + calls.ellipse.length + " 次）");
// glyph 几何自洽：k=cos(elong) —— 朔 k=1（terminator 全贴）、上弦 k=0（直线）、望 k=-1（满圆）
const kShuo = Math.cos(0), kXian = Math.cos(90 * Math.PI / 180), kWang = Math.cos(Math.PI);
ok(kShuo === 1 && Math.abs(kXian) < 1e-12 && kWang === -1, "terminator 系数 k=cos(elong)：朔 1 / 弦 0 / 望 -1");

console.log("== 11) 图层 20 项逐一翻转（paint 全链重跑）==");
const LAYER_KEYS = ["twelveBranches", "showBranchColors", "fineTicksBranches", "fineTicksXiu", "fineTicksJieqi", "fineTicksEcliptic", "zodiacNames", "xiuRing", "xiangLines", "xiuWidths", "jieqiRing", "eclipticRing",
	"planetOrbits", "aspectLines", "planetLabels", "showZodiacLabel", "retroMark", "moonPhase", "centerInfo", "centerCross"];
let layerOK = true;
for (const k of LAYER_KEYS) {
	try {
		eng.toggleSetting(k);              // 翻转（关）
		if (eng.getSettings()[k] !== !s0[k]) layerOK = false;
		eng.toggleSetting(k);              // 翻转（开）
	} catch (e) { layerOK = false; console.log("    " + k + " 异常: " + e); }
}
ok(layerOK, "20 项开关翻转+paint 重跑不炸且状态正确");

console.log("== 12) 键盘映射 ==");
function press(code) {
	eng.handleKeydown({ keyCode: code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false });
}
function timeMs() { return eng.getNow().getTime(); }
let keyOK = true;
try {
	let t0 = timeMs(); press(75); keyOK = keyOK && Math.abs(timeMs() - t0 - 86400e3) < 2000;   // K +1日
	t0 = timeMs(); press(74); keyOK = keyOK && Math.abs(timeMs() - t0 + 86400e3) < 2000;       // J -1日
	t0 = timeMs(); press(77); keyOK = keyOK && Math.abs(timeMs() - t0 - 3600e3) < 2000;        // M +1时
	t0 = timeMs(); press(78); keyOK = keyOK && Math.abs(timeMs() - t0 + 3600e3) < 2000;        // N -1时
	t0 = timeMs(); press(70); keyOK = keyOK && Math.abs(timeMs() - t0 - 60e3) < 2000;          // F +1分
	t0 = timeMs(); press(68); keyOK = keyOK && Math.abs(timeMs() - t0 + 60e3) < 2000;          // D -1分
	t0 = timeMs(); press(82); keyOK = keyOK && Math.abs(timeMs() - t0 - 30 * 86400e3) < 2000;  // R 进 30 日（默认跨度）
	t0 = timeMs(); press(69); keyOK = keyOK && Math.abs(timeMs() - t0 + 30 * 86400e3) < 2000;  // E 退 30 日
	t0 = timeMs(); press(39); keyOK = keyOK && Math.abs(timeMs() - t0 - 86400e3) < 2000;       // → +1日
	t0 = timeMs(); press(37); keyOK = keyOK && Math.abs(timeMs() - t0 + 86400e3) < 2000;       // ← -1日
	keyOK = keyOK && eng.isLive() === false;  // 时间操作后自动暂停（HOLD 模态）
	press(32); keyOK = keyOK && eng.isLive() === true;   // Space 恢复实时
	press(32); keyOK = keyOK && eng.isLive() === false;  // Space 再暂停
	press(72); keyOK = keyOK && eng.isLive() === true;   // H 现在+实时
	eng.killInterval();                                   // 清定时器（防 verify 进程不退）
	keyOK = keyOK && Math.abs(timeMs() - Date.now()) < 3000;  // H 已回到当前时刻
} catch (e) { keyOK = false; console.log("    键盘异常: " + e); }
ok(keyOK, "J/K/N/M/D/F/E/R/←→ 时间控制 + Space 暂停恢复 + H 回到现在（全部生效）");

console.log("== 12b) 月/年跳转（shiftMonth/shiftYear——日号·月日保持 + 月末/闰二自动钳）==");
let myOK = true;
try {
	// 1月31日 +1月 → 2月28日（日号保持，月末钳）
	eng.setNow(new Date(2023, 0, 31, 12, 0, 0));
	eng.shiftMonth(1);
	let n = eng.getNow();
	myOK = myOK && n.getFullYear() === 2023 && n.getMonth() === 1 && n.getDate() === 28;
	// 3月31日 -1月 → 2月28日（反向同钳）
	eng.setNow(new Date(2023, 2, 31, 12, 0, 0));
	eng.shiftMonth(-1);
	n = eng.getNow();
	myOK = myOK && n.getFullYear() === 2023 && n.getMonth() === 1 && n.getDate() === 28;
	// 普通月跳转日号保持（5月15日 +1月 → 6月15日）
	eng.setNow(new Date(2023, 4, 15, 12, 0, 0));
	eng.shiftMonth(1);
	n = eng.getNow();
	myOK = myOK && n.getMonth() === 5 && n.getDate() === 15;
	// 2024年2月29日 +1年 → 2025年2月28日（闰二钳）
	eng.setNow(new Date(2024, 1, 29, 12, 0, 0));
	eng.shiftYear(1);
	n = eng.getNow();
	myOK = myOK && n.getFullYear() === 2025 && n.getMonth() === 1 && n.getDate() === 28;
	// 年跳月日保持（2023年6月10日 -1年 → 2022年6月10日）
	eng.setNow(new Date(2023, 5, 10, 12, 0, 0));
	eng.shiftYear(-1);
	n = eng.getNow();
	myOK = myOK && n.getFullYear() === 2022 && n.getMonth() === 5 && n.getDate() === 10;
	// 闰年目标：2023年2月29日不存在，setNow 被 Date 规整为 3月1日，+1年 → 2024年3月1日（月日保持）
	eng.setNow(new Date(2023, 1, 29, 12, 0, 0));
	eng.shiftYear(1);
	n = eng.getNow();
	myOK = myOK && n.getFullYear() === 2024 && n.getMonth() === 2 && n.getDate() === 1;
	myOK = myOK && eng.isLive() === false;   // 跳转后自动暂停（HOLD）
} catch (e) { myOK = false; console.log("    月/年跳转异常: " + e); }
ok(myOK, "shiftMonth 日号保持+月末钳（1.31→2.28）·shiftYear 月日保持+闰二钳（2024.2.29+1年→2025.2.28）·跳转后自动暂停");

console.log("== 13) 悬停命中（hitTest）==");
const targets = eng.getHitTargets();
ok(targets.length === 9, "悬停命中区 9 个（9 体行星）");
const jup = targets.find(function (t) { return t.planet.key === "Jupiter"; });
ok(!!jup && !!eng.hitTest(jup.x, jup.y) && eng.hitTest(jup.x, jup.y).planet.key === "Jupiter",
	"hitTest 命中木星自身坐标");
ok(eng.hitTest(360, 8) === null || eng.hitTest(360, 8) === undefined || !eng.hitTest(360, 8),
	"hitTest 空白区不命中（图顶边缘）");

console.log("== 14) 几何锚（黄经→屏幕：冬至正下 / 夏至正上 / 春分正右）==");
const p1 = eng.project(270, 100), p2 = eng.project(90, 100), p3 = eng.project(0, 100);
ok(Math.abs(p1.x - 360) < 1e-9 && Math.abs(p1.y - 460) < 1e-9, "冬至 270° → (360, 460) 正下");
ok(Math.abs(p2.x - 360) < 1e-9 && Math.abs(p2.y - 260) < 1e-9, "夏至 90° → (360, 260) 正上");
ok(Math.abs(p3.x - 460) < 1e-9 && Math.abs(p3.y - 360) < 1e-9, "春分 0° → (460, 360) 正右");

console.log("== 15) 农历 golden 对照（内置 AE 农历 vs 万年历寿星历 golden 2020-2030）==");
const GOLDEN = path.resolve(ROOT, "test", "golden", "near-2020-2030.json"); // 仓内 golden（独立发布仓自持，2026-11-21）
let gdata = null;
try { gdata = JSON.parse(fs.readFileSync(GOLDEN, "utf8")); } catch (e) { console.log("    golden 不可读: " + e.message); }
if (!gdata) {
	ok(false, "万年历 golden 文件可读（" + path.basename(GOLDEN) + "）");
} else {
	// 月名口径=6tail（冬/腊）vs golden=寿星历（十一/十二）——等价映射后比对
	function myLunar(y, m, d) {
		const s = eng.getLunarText(new Date(Date.UTC(y, m - 1, d, 4))).replace(/.*年/, "");
		return s.replace("冬月", "十一月").replace("腊月", "十二月");
	}
	let checked = 0, lunarFail = 0;
	const failures = [];
	for (const mk of Object.keys(gdata)) {
		for (const day of gdata[mk].days) {
			const isSample = day.d === 1 || day.d === 15;
			const inLeapZone = /^(2023-0[234]|2025-0[678])/.test(mk);   // 2023 闰二月 / 2025 闰六月逐日
			if (!isSample && !inLeapZone) continue;
			const got = myLunar(+mk.slice(0, 4), +mk.slice(5, 7), day.d);
			const expect = (day.Lleap ? "闰" : "") + day.Lmc + "月" + day.Ldc;
			if (got !== expect) { lunarFail++; if (failures.length < 8) failures.push(mk + "-" + day.d + " got=" + got + " expect=" + expect); }
			checked++;
		}
	}
	ok(checked > 300, "对照样本量 " + checked + "（每月 1/15 日 + 闰月区逐日）");
	ok(lunarFail === 0, "农历全对（错 " + lunarFail + "/" + checked + "）" + (lunarFail ? "——首错: " + failures.join(" ; ") : ""));
}

console.log("== 16) 动态尺寸 + DPR 补偿（resizeTo）==");
const c2 = makeCanvas();
const eng2 = mod.createEngine(c2, 340);
ok(c2.width === 340 && c2.height === 340, "构造 initialSize=340 → backing 340×340（dpr=1）");
ok(c2.style.width === "340px" && c2.style.height === "340px", "CSS 显示尺寸 340px");
ok(eng2.getHitTargets().length === 9, "resize 后绘制链完整（9 命中区）");
const tf = c2.__ctx.__calls.setTransform;
ok(tf.length > 0 && Math.abs(tf[tf.length - 1][0] - 340 / 720) < 1e-9
	&& tf[tf.length - 1][1] === 0 && tf[tf.length - 1][2] === 0 && tf[tf.length - 1][3] === tf[tf.length - 1][0],
	"setTransform k=340/720 等比映射（无错切/平移）");
globalThis.devicePixelRatio = 2;
eng2.resizeTo(340);
ok(c2.width === 680 && c2.height === 680, "dpr=2 → backing 680×680（HiDPI 补偿）");
ok(Math.abs(c2.__ctx.__calls.setTransform[c2.__ctx.__calls.setTransform.length - 1][0] - 680 / 720) < 1e-9,
	"transform k=680/720（设备像素级）");
const arcBefore = c2.__ctx.__calls.arc.length;
eng2.resizeTo(340);
ok(c2.width === 680 && c2.__ctx.__calls.arc.length === arcBefore, "尺寸未变时 resizeTo 幂等（不动 backing 不重绘）");
delete globalThis.devicePixelRatio;

console.log("== 17) Phase 2b：四象星官连线（弧线 r284 + 四色 + 28 距星点 + 组内单调）==");
const c3 = makeCanvas();
const eng3 = mod.createEngine(c3);
const calls3 = c3.__ctx.__calls;
function hasArc3(r) { return calls3.arc.some(function (v) { return Math.abs(v - r) < 0.6; }); }
ok(hasArc3(284), "四象连线弧 r=284（宿名同层走廊——节气圈 280 与宿名字域 287-299 之间零压字）");
ok(["#4FA79A", "#7288BE", "#C8B888", "#C99A8B"].every(function (c) { return calls3.strokeStyle.indexOf(c) >= 0; }),
	"四象四色 strokeStyle：苍龙青绿#4FA79A / 玄武深蓝#7288BE / 白虎金白#C8B888 / 朱雀红橙#C99A8B（35% 饱和）");
ok(calls3.arc.filter(function (v) { return Math.abs(v - 1.7) < 0.05; }).length === 28, "28 距星锚点（r=1.7 圆点 ×28）");
let mono = true, segMax = 0;
for (let g = 0; g < 4; g++) {
	for (let i = g * 7; i < g * 7 + 6; i++) {   // 组内 6 段连线相邻星
		let d = xiuLon[i + 1] - xiuLon[i];
		if (d > 180) d -= 360;   // ±180° 折叠（玄武组室→壁跨黄经 0° 环绕）
		if (d < -180) d += 360;
		if (d <= 0) mono = false;
		if (Math.abs(d) > segMax) segMax = Math.abs(d);
	}
}
ok(mono, "四象组内距星黄经单调增（折叠口径——室→壁跨 0° 环绕由 lonB+=360 保险正确覆盖）");
ok(segMax < 45, "组内最大段弧 " + segMax.toFixed(1) + "° < 45°（一象一笔短弧扫——无长回扫）");

console.log("== 18) Phase 2b：十二辰色带环（六方位色锚 v1.6）==");
ok(["#5C7CFA", "#51CF66", "#66D9E8", "#FF6B6B", "#FFD43B", "#B197FC"].every(function (c) { return calls3.fillStyle.indexOf(c) >= 0; }),
	"六方位色带全落 fillStyle（子丑深蓝/寅卯绿/辰巳青/午未红/申酉金/戌亥紫）");
ok(hasArc3(318), "色带环内缘 r=318（外缘=十二辰圈 340，带宽 22）");
const bandSegs = calls3.fillStyle.filter(function (v) { return ["#5C7CFA", "#51CF66", "#66D9E8", "#FF6B6B", "#FFD43B", "#B197FC"].indexOf(v) >= 0; });
ok(bandSegs.length === 12, "十二辰色带 12 段（每辰 30°，两辰同色成 6 方位带）");
// 开关翻转：预置 localStorage showBranchColors=false → 色带消失，圈线/辰名/刻度仍在
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { showBranchColors: false } });
const c3b = makeCanvas();
const eng3b = mod.createEngine(c3b);
const calls3b = c3b.__ctx.__calls;
const BAND6 = ["#5C7CFA", "#51CF66", "#66D9E8", "#FF6B6B", "#FFD43B", "#B197FC"];
ok(BAND6.every(function (c) { return calls3b.fillStyle.indexOf(c) < 0; }),
	"showBranchColors=false → 六方位色带零绘制（fillStyle 无色带锚色）");
ok(calls3b.arc.some(function (v) { return Math.abs(v - 340) < 0.6; }), "关色带后十二辰圈线 r=340 仍绘制");
const ZHI12 = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
ok(ZHI12.every(function (z) { return calls3b.fillText.indexOf(z) >= 0; }), "关色带后十二辰名仍显示（fillText 12 支全落）");
ok(eng3b.getSettings().showBranchColors === false, "showBranchColors 状态正确读取为 false");
eng3b.toggleSetting("showBranchColors");
ok(eng3b.getSettings().showBranchColors === true && BAND6.every(function (c) { return c3b.__ctx.__calls.fillStyle.indexOf(c) >= 0; }),
	"再开启 → 色带恢复绘制（重跑 paint 色带锚色回归）");
eng3b.killInterval();
delete lsStore["dsh-sky-panel-settings"];

console.log("== 18b) 1° 细刻度（十二辰外圈内侧 r336-340，lineWidth 0.4，色统一 T.border）==");
function fineTickCount(cc) {
	return cc.moveTo.filter(function (p) {
		return Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - 336) < 0.6;
	}).length;
}
ok(calls3.lineWidth.indexOf(0.4) >= 0, "lineWidth 0.4 已落（比节气刻度 0.5 更细）");
ok(calls3.strokeStyle.indexOf("rgba(128,128,128,0.55)") >= 0, "十二辰圈全部刻度线色统一 T.border rgba(128,128,128,0.55)（不透明实色 fallback，细刻度 1° + 30° 主刻度同色，层级仅靠线宽/长度区分）");
ok(fineTickCount(calls3) === 336, "细刻度 336 条（360 度 − 24 个 15°/30° 主刻度位）——实际 " + fineTickCount(calls3));
ok(calls3.moveTo.every(function (p, i) {
	return Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - 336) > 0.6
		|| (calls3.lineTo[i] && Math.abs(Math.hypot(calls3.lineTo[i][0] - 360, calls3.lineTo[i][1] - 360) - 340) < 0.6);
}), "几何口径：细刻度起点 r=336 → 终点 r=340（长 4px）");
// 开关翻转：预置 fineTicksBranches=false → 细刻度消失，15°/30° 主刻度仍显示
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { fineTicksBranches: false } });
const c3c = makeCanvas();
const eng3c = mod.createEngine(c3c);
const calls3c = c3c.__ctx.__calls;
ok(fineTickCount(calls3c) === 0, "fineTicksBranches=false → r336 细刻度零绘制");
ok(calls3c.lineWidth.indexOf(0.4) < 0, "fineTicksBranches=false → lineWidth 0.4 不再出现");
ok(calls3c.arc.some(function (v) { return Math.abs(v - 340) < 0.6; }), "关闭后十二辰圈线 r=340 主刻度层仍绘制");
ok(calls3c.moveTo.some(function (p) { return Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - 334) < 0.6; }),
	"关闭后 30° 主刻度（r334-340）仍显示");
ok(eng3c.getSettings().fineTicksBranches === false, "fineTicksBranches 状态正确读取为 false");
eng3c.toggleSetting("fineTicksBranches");
ok(eng3c.getSettings().fineTicksBranches === true && fineTickCount(c3c.__ctx.__calls) === 336,
	"再开启 → 细刻度恢复 336 条（重跑 paint 回归）");
eng3c.killInterval();
delete lsStore["dsh-sky-panel-settings"];

console.log("== 18b2) 四圈独立 1° 细刻度开关（28宿 r306-310 / 节气 r276-280 / 黄道 r246-250，lineWidth 0.4）==");
function ringFineCount(cc, r0, exclude15) {   // r0=内起半径；只计整数度（细刻度口径）——宿界距星刻度为分数角度不计；exclude15 再排除 15° 倍数位（该位恒有 0.75 主刻度）
	return cc.moveTo.filter(function (p, i) {
		if (!(Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - r0) < 0.6)) return false;
		if (!(cc.lineTo[i] && Math.abs(Math.hypot(cc.lineTo[i][0] - 360, cc.lineTo[i][1] - 360) - (r0 + 4)) < 0.6)) return false;
		var ang = Math.atan2(360 - p[1], p[0] - 360) * 180 / Math.PI;
		var deg = ((90 - ang) % 360 + 360) % 360;
		var rnd = Math.round(deg);
		if (Math.abs(deg - rnd) >= 0.05) return false;
		return !exclude15 || rnd % 15 !== 0;
	}).length;
}
const xiuBase = ringFineCount(calls3, 306, false);   // 基线：恰落整数度的宿界距星刻度条数（不可几何区分，用增量法）
ok(ringFineCount(calls3, 276, true) === 0, "默认关 → 节气圈 r276 细刻度零绘制——实际 " + ringFineCount(calls3, 276, true));
ok(ringFineCount(calls3, 246, true) === 0, "默认关 → 黄道圈 r246 细刻度零绘制——实际 " + ringFineCount(calls3, 246, true));
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { fineTicksXiu: true, fineTicksJieqi: true, fineTicksEcliptic: true } });
const c3f = makeCanvas();
const eng3f = mod.createEngine(c3f);
const calls3f = c3f.__ctx.__calls;
const xiuDelta = ringFineCount(calls3f, 306, false) - xiuBase;
ok(xiuDelta >= 304 && xiuDelta <= 332, "fineTicksXiu=true → 28宿圈 1° 细刻度增量 " + xiuDelta + " 条（360 − 每宿界 ±1° 遮蔽 28~56 位）");
ok(ringFineCount(calls3f, 276, true) === 336, "fineTicksJieqi=true → 节气圈 1° 细刻度 336 条（跳 24 个 15° 位）——实际 " + ringFineCount(calls3f, 276, true));
ok(ringFineCount(calls3f, 246, true) === 336, "fineTicksEcliptic=true → 黄道圈 1° 细刻度 336 条（跳 24 个 15° 位）——实际 " + ringFineCount(calls3f, 246, true));
ok(fineTickCount(calls3f) === 336, "十二辰细刻度不受其他三圈开关影响（仍 336）");
eng3f.killInterval();
// 独立性：只关节气（paint 调用记录跨 toggle 累积，改用新引擎预置验证）
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { fineTicksXiu: true, fineTicksJieqi: false, fineTicksEcliptic: true } });
const c3g = makeCanvas();
const eng3g = mod.createEngine(c3g);
const calls3g = c3g.__ctx.__calls;
ok(eng3g.getSettings().fineTicksJieqi === false && ringFineCount(calls3g, 276, true) === 0,
	"关闭节气 1° 开关 → r276 细刻度消失");
ok(ringFineCount(calls3g, 246, true) === 336 && ringFineCount(calls3g, 306, false) - xiuBase === xiuDelta,
	"关节气后黄道/28宿细刻度仍在（四开关互独立）");
eng3g.killInterval();
delete lsStore["dsh-sky-panel-settings"];

console.log("== 18c) 15° 中刻度（r334-340，长 6px，lineWidth 0.75，色 T.border，共 12 条）==");
function midTickCount(cc) {
	return cc.moveTo.filter(function (p, i) {
		if (!(Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - 334) < 0.6)) return false;
		if (!(cc.lineTo[i] && Math.abs(Math.hypot(cc.lineTo[i][0] - 360, cc.lineTo[i][1] - 360) - 340) < 0.6)) return false;
		var ang = Math.atan2(360 - p[1], p[0] - 360) * 180 / Math.PI;
		var deg = ((90 - ang) % 360 + 360) % 360; // 黄经口径（冬至270=正下）
		var m30 = ((deg % 30) + 30) % 30;
		return Math.abs(m30 - 15) < 0.6; // 只计 15° 奇数位（中刻度）
	}).length;
}
const midAngles = calls3.moveTo.map(function (p, i) {
	if (Math.abs(Math.hypot(p[0] - 360, p[1] - 360) - 333) > 0.6) return null;
	const q = calls3.lineTo[i];
	return (Math.atan2(360 - q[1], q[0] - 360) * 180 / Math.PI + 360) % 360;
}).filter(function (a) { return a !== null; });
ok(midTickCount(calls3) === 12, "15° 中刻度 12 条（15/45/75/…/345，跳过 30° 倍数位）——实际 " + midTickCount(calls3));
ok(midAngles.every(function (a) { return Math.abs(a % 30 - 15) < 0.01; }),
	"中刻度角度全落 15° 奇数位（mod 30 === 15）");
ok(calls3.lineWidth.indexOf(0.75) >= 0 && calls3.strokeStyle.indexOf("rgba(128,128,128,0.55)") >= 0,
	"中刻度线宽 0.75/色 T.border 与主刻度同级");
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { fineTicksBranches: false } });
const c3d = makeCanvas();
mod.createEngine(c3d).killInterval();
ok(midTickCount(c3d.__ctx.__calls) === 12, "fineTicksBranches=false 时中刻度仍 12 条（中刻度无条件层）");
delete lsStore["dsh-sky-panel-settings"];

console.log("== 18d) 行星星座开关（showZodiacLabel——关=标注只显示名称+逆行）==");
const GONG12 = ["白羊", "金牛", "双子", "巨蟹", "狮子", "室女", "天秤", "天蝎", "人马", "摩羯", "宝瓶", "双鱼"];
const PLANET_CN = ["太阳", "月亮", "水星", "金星", "火星", "木星", "土星", "天王星", "海王星"];
function zodiacLabels(cl) {   // '·星座'式标注（含 ℞ 逆行前缀变体）
	return cl.fillText.filter(function (t) { return /^[℞]?.·/.test(t) && GONG12.indexOf(t.replace(/^℞?./, "").slice(1)) >= 0; });
}
function bareLabels(cl) {      // 纯名称 / 名称+逆（关星座后形态）
	return cl.fillText.filter(function (t) { return PLANET_CN.some(function (n) { return t === n || t === n + " 逆"; }); });
}
ok(zodiacLabels(calls3).length >= 9, "默认开 → 9 行星标注含星座名（·式）——实际 " + zodiacLabels(calls3).length);
lsStore["dsh-sky-panel-settings"] = JSON.stringify({ s: { showZodiacLabel: false } });
const c3e = makeCanvas();
const eng3e = mod.createEngine(c3e);
const calls3e = c3e.__ctx.__calls;
ok(zodiacLabels(calls3e).length === 0, "showZodiacLabel=false → 星座名零绘制（无 ·星座式标注）");
ok(calls3e.fillText.indexOf("℞") < 0 && !calls3e.fillText.some(function (t) { return t.charAt(0) === "℞"; }),
	"关闭后无 ℞ 前缀（逆行改'名称 逆'内联形态）");
ok(bareLabels(calls3e).length >= 9, "关闭后 9 行星纯名称/名称+逆 标注全落——实际 " + bareLabels(calls3e).length);
ok(eng3e.getSettings().showZodiacLabel === false, "showZodiacLabel 状态正确读取为 false");
eng3e.toggleSetting("showZodiacLabel");
ok(eng3e.getSettings().showZodiacLabel === true && zodiacLabels(c3e.__ctx.__calls).length >= 9,
	"再开启 → 星座名标注恢复（重跑 paint ·式回归）");
eng3e.killInterval();
delete lsStore["dsh-sky-panel-settings"];


console.log("== 19) 行星纯色平面圆点（渐变球已回退）==");
ok(calls3.radial.length === 0, "零 createRadialGradient（渐变球已移除）——实际 " + calls3.radial.length);
ok(calls3.fillStyle.indexOf("rgba(255,255,255,0.5)") < 0, "无白色高光点");
["#FFB300", "#9E9E9E", "#FFD54F", "#EF5350", "#FF8A65", "#FFCA28", "#4DD0E1", "#42A5F5"].forEach(function (c) {
	ok(calls3.fillStyle.indexOf(c) >= 0, "行星功能色落 fillStyle（纯色圆点）：" + c);
});

console.log("== 20) Phase 2b：行星相位连线语义分色（findAspects）==");
const syn = mod.findAspects([{ key: "A", elon: 10 }, { key: "B", elon: 12 }, { key: "C", elon: 190 }, { key: "D", elon: 130 }]);
ok(syn.length === 5, "合成天象 5 组相位（A-B 合 2° / A-C 冲 180° / B-C 冲 178° / A-D 三合 120° / B-D 三合 118°）——实际 " + syn.length);
ok(syn.some(function (a) { return a.type === "合" && a.a === "A" && a.b === "B" && Math.abs(a.sep - 2) < 0.01; }), "合相位识别（sep 2°≤3° 容许度）");
ok(syn.filter(function (a) { return a.type === "冲"; }).length === 2, "冲相位识别（180°±3° 含镜像邻近 B-C 178°）");
ok(syn.filter(function (a) { return a.type === "三合"; }).length === 2, "三合相位识别（120°±3° 含 B-D 118° 邻近）");
const aspJS = mod.findAspects([{ key: "Jupiter", elon: jLon }, { key: "Saturn", elon: sLon }]);
ok(aspJS.length === 1 && aspJS[0].type === "合", "2020-12-21 木土大合相 golden：findAspects=合（sep " + aspJS[0].sep.toFixed(3) + "°）");
ok(mod.ASPECT_COLOR["合"] === "#FFD43B" && mod.ASPECT_COLOR["冲"] === "#FF6B6B" && mod.ASPECT_COLOR["三合"] === "#51CF66",
	"语义分色映射：合=金#FFD43B / 冲=红#FF6B6B / 三合=绿#51CF66");

console.log("== 21) Phase 2b：行星详情卡数据（card()——北京默认观测地）==");
const cd = eng3.card("Mars");
ok(!!cd && cd.cn === "火星" && cd.symbol === "♂" && cd.latin === "Mars", "card('Mars') 名称+符号 ♂+拉丁名");
ok(/^\d+°\d{2}′\d{2}″$/.test(cd.elonDMS) && !!cd.gong, "黄经度分秒 " + cd.elonDMS + " + 所在宫 " + cd.gong);
ok(cd.xiu.length === 1 && !isNaN(+cd.du) && !!cd.xiang, "所在宿 " + cd.xiu + "宿 " + cd.du + "度 · " + cd.xiang);
ok(cd.dist > 0 && cd.distPct >= 0 && cd.distPct <= 100, "距离 " + cd.dist.toFixed(3) + " AU + 近↔远百分比 " + cd.distPct + "%");
ok(typeof cd.retro === "boolean" && /^\d{2}:\d{2}:\d{2}/.test(cd.timeAngle), "顺逆行 " + (cd.retro ? "逆行" : "顺行") + " + 时角 " + cd.timeAngle);
ok(/^\d{2}:\d{2}$/.test(cd.rise) && /^\d{2}:\d{2}$/.test(cd.transit) && /^\d{2}:\d{2}$/.test(cd.set),
	"今日升/中/落 " + cd.rise + " / " + cd.transit + " / " + cd.set + "（HH:MM）");
// 独立复核：AE 直算（北京默认观测地）对照
function hhmm(d) { function p(x) { return (x < 10 ? "0" : "") + x; } return p(d.getHours()) + ":" + p(d.getMinutes()); }
const mid = new Date(); mid.setHours(0, 0, 0, 0);
const obsBJ = new A.Observer(39.90, 116.40, 44);
const probeRise = A.SearchRiseSet(A.Body.Mars, obsBJ, +1, mid, 2);
const probeTr = A.SearchHourAngle(A.Body.Mars, obsBJ, 0, mid);
ok(cd.rise === hhmm(probeRise.date) && cd.transit === hhmm(probeTr.time.date),
	"升/中天与 AE 直算一致（观测地北京 39.90N/116.40E 默认）");
ok(eng3.card("Mars").rise === cd.rise, "事件按「天体@本地日」缓存（同日重复调用稳定）");
const cdSun = eng3.card("Sun");
ok(!!cdSun && /^\d{2}:\d{2}$/.test(cdSun.transit || ""), "card('Sun') 中天时刻可用（" + cdSun.transit + "）");
const cdMoon = eng3.card("Moon");
ok(!!cdMoon && typeof cdMoon.elong === "number" && typeof cdMoon.illum === "number", "card('Moon') 含距角/照亮比（月相行）");

// ═══ Phase 2c：动画播放 / 天象事件日历 / 图②天顶图 / 观测位置（22-25——播放含真实定时器须异步）═══
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
(async function () {
	console.log("== 22) Phase 2c：动画播放（▶ 虚拟时间推进 / 速度可调 / 操作自动暂停）==");
	let playOK = true;
	try {
		const cp = makeCanvas();
		const engP = mod.createEngine(cp);
		engP.setNow(new Date("2026-10-31T12:00:00Z"));
		engP.makeInterval();
		ok(engP.isLive() === true && engP.isPlaying() === false, "初始态：实时开 / 未播放");
		engP.setPlaySpeed(100);
		engP.startPlayback();
		playOK = playOK && engP.isPlaying() === true && engP.isLive() === false;   // 播放与实时互斥
		const tA = engP.getNow().getTime();
		await sleep(450);   // 4-5 帧 × 100×0.1s = 40-50 虚拟秒
		const dv = engP.getNow().getTime() - tA;
		playOK = playOK && dv > 2000 && dv < 80000;   // 100× 推进约 40±s（容差防慢机）
		engP.setPlaySpeed(1000);
		const tB = engP.getNow().getTime();
		await sleep(350);
		const dv2 = engP.getNow().getTime() - tB;
		playOK = playOK && dv2 > dv / 2;   // 1000× 比 100× 推进快 ≥ 一个量级的一半
		// 键盘操作自动暂停
		press2(engP, 75);
		playOK = playOK && engP.isPlaying() === false && engP.isLive() === false;   // K 前进一日 → 播放停（HOLD）
		engP.startPlayback();
		press2(engP, 72);
		playOK = playOK && engP.isPlaying() === false && engP.isLive() === true;    // H 现在 → 播放停+回实时
		engP.startPlayback();
		press2(engP, 32);
		playOK = playOK && engP.isPlaying() === false;                              // Space → 暂停播放
		ok(playOK, "播放推进 " + (dv / 1000).toFixed(1) + "s@100× / " + (dv2 / 1000).toFixed(1) + "s@1000× + 互斥 + K/H/Space 自动暂停全过");
		engP.killInterval();
	} catch (e) { ok(false, "播放异常: " + e); }

	console.log("== 23) Phase 2c：天象事件日历（未来 30 天 + 排序 + 当日缓存）==");
	const evs = mod.computeEvents30(new Date("2026-10-31T12:00:00Z"));
	ok(evs.length > 0 && evs.every(function (e) { return typeof e.ms === "number" && e.type && e.text && /^\d{2}-\d{2} \d{2}:\d{2}$/.test(e.when); }),
		"事件结构完整（" + evs.length + " 条：日期 HH:MM / 类型 / 描述）");
	ok(evs.every(function (e, i) { return i === 0 || evs[i - 1].ms <= e.ms; }), "按日期时间升序");
	const t0e = +new Date("2026-10-31T12:00:00Z");
	ok(evs.every(function (e) { return e.ms > t0e && e.ms < t0e + 30 * 86400e3 + 86400e3; }), "全部落在未来 30 天窗口");
	ok(evs.some(function (e) { return e.type === "行星合" && e.text.indexOf("火星合木星") >= 0 && e.when === "11-16 14:22"; }),
		"golden：2026-10-31 起火星合木星 11-16 14:22");
	ok(evs.some(function (e) { return e.type === "冲日" && e.text.indexOf("天王星") >= 0 && e.when === "11-26 06:25"; }),
		"golden：2026-10-31 起天王星冲日 11-26 06:25（另：水星西大距 11-21）");
	// AE 直算复核：火星合木星时刻黄经差 ≈ 0
	const conjE = evs.find(function (e) { return e.text.indexOf("火星合木星") >= 0; });
	const conjSep = Math.abs(A.PairLongitude("Mars", "Jupiter", new Date(conjE.ms)));
	ok(conjSep < 0.05, "合相时刻黄经差直算 " + conjSep.toFixed(4) + "° < 0.05°（二分细化正确）");
	const oppE = evs.find(function (e) { return e.text.indexOf("天王星冲日") >= 0; });
	let oppSep = A.PairLongitude("Uranus", "Sun", new Date(oppE.ms)) % 360;
	ok(Math.abs(oppSep - 180) < 0.1, "冲日时刻天王-太阳黄经差 " + oppSep.toFixed(3) + "° ≈ 180°");
	// 当日缓存：getEvents 两次 → localStorage 落盘且第二次直接命中
	delete lsStore["dsh-sky-panel-events"];
	const cEv = makeCanvas();
	const engEv = mod.createEngine(cEv);
	const l1 = engEv.getEvents();
	const evsToday = mod.computeEvents30(new Date());   // 引擎按实时日期取事件，对比基准须同日（固定 golden 日期会随时间漂移）
	ok(Array.isArray(l1) && l1.length === evsToday.length, "engine.getEvents() 与纯函数同量（" + l1.length + " 条）");
	ok(!!lsStore["dsh-sky-panel-events"], "事件列表已按日缓存 localStorage");
	ok(engEv.getEvents().length === l1.length && JSON.parse(lsStore["dsh-sky-panel-events"]).list.length === l1.length, "同日重复调用走缓存（不重算）");
	engEv.killInterval();

	console.log("== 24) Phase 2c：图②天顶图（地平坐标投影 + 可见性着色 + 方位十字 + 晨昏蒙影）==");
	// 投影几何锚：中国传统方位 上南下北左东右西（v1.8）
	ok(Math.abs(mod.projectHor(0, 90).x - 360) < 1e-9 && Math.abs(mod.projectHor(0, 90).y - 360) < 1e-9, "方位 0° 高度 90° → 圆心（天顶）");
	ok(Math.abs(mod.projectHor(0, 0).x - 360) < 1e-9 && Math.abs(mod.projectHor(0, 0).y - 648) < 1e-9, "北（方位 0° 高度 0°）→ (360,680) 正下地平圈（上南）");
	ok(Math.abs(mod.projectHor(90, 0).x - 72) < 1e-9 && Math.abs(mod.projectHor(90, 0).y - 360) < 1e-9, "E（方位 90°）→ (40,360) 正左（仰望天图 E 左惯例）");
	ok(Math.abs(mod.projectHor(180, 0).y - 72) < 1e-9 && Math.abs(mod.projectHor(270, 0).x - 648) < 1e-9, "南正上 / 西正右（上南下北左东右西）");
	const cz = makeCanvas();
	const engZ = mod.createEngine(cz);
	engZ.setNow(new Date("2026-10-31T20:00:00+08:00"));   // 晚间北京——保证部分行星地上
	engZ.setView("zenith");
	const czc = cz.__ctx.__calls;
	ok(engZ.getView() === "zenith", "setView('zenith') 生效");
	ok(["北", "南", "东", "西", "天顶"].every(function (t) { return czc.fillText.indexOf(t) >= 0; }), "北/南/东/西十字 + 天顶标（中文方位）");
	ok(["30", "60", "120", "330"].every(function (t) { return czc.fillText.indexOf(t) >= 0; }), "方位角每 30° 刻度标注");
	ok(["民用蒙影", "航海蒙影", "天文蒙影"].every(function (t) { return czc.fillText.indexOf(t) >= 0; }), "晨昏蒙影三虚线圆（-6°/-12°/-18°）标注");
	ok(czc.arc.some(function (v) { return Math.abs(v - 300) < 0.6; }), "地平圈 r=300（N/S 标注 R+34 收在画布内——居中修复）");
	const zs = engZ.getInfo();
	// v2：全 9 体绘制（地下压缩圈内窄带——无裁剪）
	ok(engZ.getHitTargets().length === 9, "全 9 体绘制含深地下（命中区 " + engZ.getHitTargets().length + "）");
	// 品质升级锚：标注含高度+方位（'高…° 方…°'）、角落状态行（观测地+时间）
	ok(czc.fillText.some(function (t) { return typeof t === "string" && /高-?\d+° 方\d+°/.test(t); }), "行星标注=名称+高度角+方位角（高…° 方…°）");
	ok(czc.fillText.some(function (t) { return typeof t === "string" && /^北京 · /.test(t); }), "角落状态行：观测地+当前时间");
	const above = zs.filter(function (r) { return r.alt > 0; }), below = zs.filter(function (r) { return r.alt <= 0; });
	ok(above.length > 0 && below.length > 0, "晚间 20:00 存在地上+地下天体（可见性分层可验：" + above.length + " 上/" + below.length + " 下）");
	// 完全复刻图①（共享函数 drawPlanetDot）：地下天体圆点=功能色（可见性只由标注 × 前缀区分），灰色梯度淘汰
	const ZP_COLOR = { '太阳': '#FFB300', '月亮': '#E0E0E0', '水星': '#9E9E9E', '金星': '#FFD54F',
		'火星': '#EF5350', '木星': '#FF8A65', '土星': '#FFCA28', '天王星': '#4DD0E1', '海王星': '#42A5F5' };
	ok(below.filter(function (r) { return r.cn !== "月亮"; }).every(function (r) { return czc.fillStyle.indexOf(ZP_COLOR[r.cn]) >= 0; }),
		"地下天体圆点=P_COLOR 功能色（完全复刻图①）");
	ok(czc.fillStyle.indexOf("#8F8F8F") < 0 && czc.fillStyle.indexOf("#5F5F5F") < 0, "灰色梯度 #8F8F8F/#5F5F5F 零残留");
	ok(czc.fillText.some(function (t) { return typeof t === "string" && / × 高-?\d+°/.test(t); }), "地下天体标注 × 前缀（可见性标注层）");
	ok(czc.fillStyle.indexOf("#FFB300") >= 0 || above.length === 0, "太阳圆点功能色（地上地下同色）");
	// 太阳芒/土星环两图通用（共享函数）：图②也有 8 线光芒（r=17 端点）+ 倾斜椭圆环（rx=12/ry=4.56）
	const zSun = zs.find(function (r) { return r.cn === "太阳"; });
	const zSunPos = mod.projectHor(zSun.az, zSun.alt);
	const rayEnds = czc.lineTo.filter(function (p) { return Math.abs(Math.hypot(p[0] - zSunPos.x, p[1] - zSunPos.y) - 17) < 0.6; }).length;
	ok(rayEnds === 8, "图②太阳 8 线光芒（外端 r=P_SIZE+8=17，共 " + rayEnds + " 端点）");
	ok(czc.ellipse.some(function (e) { return Math.abs(e[0] - 12) < 0.01 && Math.abs(e[1] - 12 * 0.38) < 0.01; }),
		"图②土星倾斜环（rx=P_SIZE+5=12, ry=0.38rx——与图①同款）");
	// 投影一致性：已绘天体屏幕坐标 vs projectHor(az,alt)（逐命中区校验）
	ok(engZ.getHitTargets().every(function (t) {
		const pj2 = mod.projectHor(t.planet.az, t.planet.alt);
		return Math.abs(t.x - pj2.x) < 1e-6 && Math.abs(t.y - pj2.y) < 1e-6;
	}), "已绘天体屏幕坐标与 projectHor(az,alt) 全量一致");
	engZ.setView("chart");
	ok(engZ.getView() === "chart" && czc.fillText.indexOf("冬至") >= 0, "切回①行星图（黄经圆图恢复）");
	engZ.killInterval();

	console.log("== 26) Phase 3：旧复刻版死代码零残留（十月历/十二月历/decan）==");
	{
		const uiSrc = fs.readFileSync(path.join(ROOT, "lib", "src", "ui.js"), "utf8");
		["showDouJian", "showYueJian", "show10Yueli", "decan", "十月历", "十二月历", "BEIJING_OBS"].forEach(function (kw) {
			ok(uiSrc.indexOf(kw) < 0, "ui.js 无「" + kw + "」");
		});
	}


	console.log("== 25) Phase 2c：观测位置设置（图②/地平读数共用 + 持久化）==");
	const cpos = makeCanvas();
	const engPos = mod.createEngine(cpos);
	const dp = engPos.getPosition();
	ok(Math.abs(dp.latitude - 39.9) < 0.01 && Math.abs(dp.longitude - 116.4) < 0.01, "默认观测地北京 39.9N/116.4E");
	const moonAltBefore = engPos.getInfo().find(function (r) { return r.key === "Moon"; }).alt;
	const moonSetBJ = engPos.card("Moon").set;   // v1.9：升/中/落观测地=getPosition（北京）
	engPos.setPosition(31.23, 121.47, 10);   // 上海
	const dp2 = engPos.getPosition();
	ok(Math.abs(dp2.latitude - 31.23) < 1e-9 && Math.abs(dp2.longitude - 121.47) < 1e-9, "setPosition(上海) 生效");
	const moonSetSH = engPos.card("Moon").set;
	ok(/^\d{2}:\d{2}$/.test(moonSetBJ || "") && moonSetSH && moonSetSH !== moonSetBJ,
		"升落时刻跟随位置面板重算（北京降下 " + moonSetBJ + " → 上海 " + moonSetSH + "）");
	const moonAltAfter = engPos.getInfo().find(function (r) { return r.key === "Moon"; }).alt;
	ok(Math.abs(moonAltAfter - moonAltBefore) > 1e-6, "位置变化 → 地平坐标重算（月亮高度 " + moonAltBefore.toFixed(2) + "°→" + moonAltAfter.toFixed(2) + "°）");
	const savedPos = JSON.parse(lsStore["dsh-sky-panel-position"]);
	ok(Math.abs(savedPos.s.latitude - 31.23) < 1e-9, "观测位置已持久化 localStorage");
	// 越界拒绝（引擎层防 AE Observer 抛异常）
	engPos.setPosition(95, 200, 0);
	ok(engPos.getPosition().latitude === 31.23, "越界经纬度（95/200）被引擎拒绝（位置保持上海）");
	engPos.killInterval();

	console.log("== 27) 下拉组件自造化（原生 select 零残留 + DSH 同款 chevron）==");
	{
		const uiSrc = fs.readFileSync(path.join(ROOT, "lib", "src", "ui.js"), "utf8");
		ok(uiSrc.indexOf('createElement("select"') < 0, "ui.js 无原生 createElement(\"select\")");
		ok(uiSrc.indexOf("function SkyDrop") >= 0, "SkyDrop 组件已定义");
		const uses = uiSrc.split("createElement(SkyDrop").length - 1;
		ok(uses === 5, "SkyDrop 使用 5 处（跨度单位/步长单位/速度/视图/城市预设）——实际 " + uses);
		ok(uiSrc.indexOf('d: "m6 9 6 6 6-6"') >= 0, "DSH 同款 Lucide ChevronDown path（m6 9 6 6 6-6）");
		ok(/width: 9, height: 9, viewBox: "0 0 24 24"/.test(uiSrc), "chevron 9px 描边1.6（视觉定稿）");
		[".sky-drop-btn", ".sky-drop-menu", ".sky-drop-item", ".sky-drop-mask", ".sky-drop-chev"].forEach(function (cls) {
			ok(uiSrc.indexOf(cls + "{") >= 0, "CSS 含 " + cls);
		});
		ok(uiSrc.indexOf(".sky-drop-chev.open{transform:rotate(180deg)}") >= 0, "chevron 展开旋转 180deg（.12s 过渡）");
		ok(uiSrc.indexOf("box-shadow:0 4px 12px rgba(0,0,0,.12)") >= 0, "菜单外圈阴影（调淡 .12 定稿）");
		ok(/\.sky-drop-menu\{[^}]*border:none/.test(uiSrc), "菜单无边框");
		ok(uiSrc.indexOf(".sky-drop-item.on{") >= 0, "当前选中项高亮（.on）");
		ok(uiSrc.indexOf("background-image:url('data:image/svg+xml") < 0, "无 CSS background SVG 箭头残留");
	}

	console.log(fail === 0 ? "== 全部通过（" + pass + " 项）==" : "== 失败 " + fail + " 项 ==");
	process.exit(fail === 0 ? 0 : 1);
})();

function press2(eng, code) {
	eng.handleKeydown({ keyCode: code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false });
}
