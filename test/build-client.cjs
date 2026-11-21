// build-client.cjs — 拼接脚本：vendor AE UMD + knowledge/28xiu-stars.js + lib\src\ui.js → lib\client.js（GENERATED 产物）
// 用法：node test\build-client.cjs（改 UI 源 / vendor / knowledge 后重跑；产物入 git 勿手编）
// 装载机制：client.js 由 DSH ModuleLoader 以 classic <script> 执行（浏览器全局作用域，
// 顶层无 module/exports/define）——AE UMD 走 g.Astronomy = f() 分支挂 window.Astronomy，
// 知识层 module.exports 行改写为 window.__sky_knowledge__，UI 工厂内取全局（同 UMD 全局挂载模式）。
// ui.js 内容（REDESIGN v1.6 Phase 2b · 原创模块化绘制层）：命名星补丁+宿度差值法+顺逆行回溯+内置 AE 农历
// （引擎段保留）+ 模块化绘制函数族（drawBackground/drawTwelveBranches(六方位色带环)/draw28Xiu/drawXiangLines(四象
// 星官连线)/draw24Jieqi/drawEclipticRing/drawAspectLines(相位语义分色)/drawPlanets(径向渐变圆球)/drawMoonGlyph/
// drawCenterInfo + redraw 统一入口）+ 行星详情卡（点击弹出：黄经度分秒/入宿/距离百分比/顺逆/升中落——北京默认）+
// React 面板（动态尺寸 DPR 原生渲染圆图 + 图层 14 项 + 悬停 tooltip + 详情卡 + 键盘 + 实时 1s/暂停恢复 + DSH CSS 变量双主题）。
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");

const banner = "// dsh-sky-panel client bundle\n";

// 1) AE UMD 全文（IIFE 自执行——classic script 下挂 window.Astronomy）
const ae = fs.readFileSync(path.join(ROOT, "lib", "vendor", "astronomy.browser.js"), "utf8");

// 2) 知识层：module.exports → window.__sky_knowledge__（包 IIFE 防泄漏，常量在函数作用域内）
const knRaw = fs.readFileSync(path.join(ROOT, "knowledge", "28xiu-stars.js"), "utf8");
const kn = knRaw.replace(/^module\.exports\s*=\s*\{.*$/m,
	"window.__sky_knowledge__ = { X28_STARS: X28_STARS, BRIGHT_STARS: BRIGHT_STARS, PLANET_DIST: PLANET_DIST, X28_NAMES: X28_NAMES, X28_BOUNDS: X28_BOUNDS, YEAR_365_25: YEAR_365_25, computeBounds: computeBounds };");
if (kn === knRaw) throw new Error("knowledge/28xiu-stars.js 中未找到 module.exports 行——改写失败，请检查文件格式");
const knBlock = "(function(){\n" + kn + "\n})();\n";

// 3) UI 源（两段式注册 + 原创模块化绘制函数族 + React 面板——ModuleLoader 工厂）
const ui = fs.readFileSync(path.join(ROOT, "lib", "src", "ui.js"), "utf8");

fs.writeFileSync(path.join(ROOT, "lib", "client.js"), banner + ae + "\n;\n" + knBlock + "\n" + ui, "utf8");
console.log("✅ client.js 生成：" + (banner.length + ae.length + knBlock.length + ui.length) + " 字符（ae=" + ae.length + " + knowledge=" + knBlock.length + " + ui=" + ui.length + "）");
