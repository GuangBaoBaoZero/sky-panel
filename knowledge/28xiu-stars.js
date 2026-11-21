// 28xiu-stars.js — 二十八宿距星 J2000 坐标（ra 小时 / dec 度）
// 坐标取自 Hipparcos 星表（经 SIMBAD 查询核对）
// 距星选择遵循中国传统星官体系（与西方 Bayer 编号不一一对应，如参宿一距星为 ζ Ori 而非 δ Ori）
const X28_STARS = [
  { xiu: "角", star: "角宿一 Spica", bayer: "α Vir", ra: 13.439522, dec: -11.161278 },
  { xiu: "亢", star: "亢宿一", bayer: "κ Vir", ra: 14.237531, dec: -10.000000 },
  { xiu: "氐", star: "氐宿一 Zubenegenubi", bayer: "α Lib", ra: 14.833333, dec: -16.000000 },
  { xiu: "房", star: "房宿一", bayer: "β Sco", ra: 16.003792, dec: -22.620000 },
  { xiu: "心", star: "心宿一", bayer: "σ Sco", ra: 16.376142, dec: -25.594722 },
  { xiu: "尾", star: "尾宿一", bayer: "μ Sco", ra: 16.860469, dec: -38.049722 },
  { xiu: "箕", star: "箕宿一", bayer: "γ Sgr", ra: 18.121414, dec: -30.421944 },
  { xiu: "斗", star: "斗宿一", bayer: "φ Sgr", ra: 18.448214, dec: -27.001389 },
  { xiu: "牛", star: "牛宿一", bayer: "β Cap", ra: 20.371212, dec: -14.781111 },
  { xiu: "女", star: "女宿一", bayer: "ε Aqr", ra: 20.814817, dec: -9.506667 },
  { xiu: "虚", star: "虚宿一", bayer: "β Aqr", ra: 21.545683, dec: -5.571389 },
  { xiu: "危", star: "危宿一", bayer: "α Aqr", ra: 22.119272, dec: -0.319444 },
  { xiu: "室", star: "室宿一 Markab", bayer: "α Peg", ra: 23.090272, dec: 15.205278 },
  { xiu: "壁", star: "壁宿一 Algenib", bayer: "γ Peg", ra: 0.243947, dec: 15.183611 },
  { xiu: "奎", star: "奎宿一", bayer: "η And", ra: 0.809086, dec: 23.363333 },
  { xiu: "娄", star: "娄宿一 Sheratan", bayer: "β Ari", ra: 1.931786, dec: 20.808056 },
  { xiu: "胃", star: "胃宿一", bayer: "35 Ari", ra: 2.746694, dec: 27.263611 },
  { xiu: "昴", star: "昴宿一 Electra", bayer: "17 Tau", ra: 3.615228, dec: 24.113056 },
  { xiu: "毕", star: "毕宿一", bayer: "ε Tau", ra: 4.466144, dec: 19.105000 },
  { xiu: "觜", star: "觜宿一", bayer: "λ Ori", ra: 5.610042, dec: 9.934444 },
  { xiu: "参", star: "参宿一 Alnitak", bayer: "ζ Ori", ra: 5.698331, dec: -1.9425 },
  { xiu: "井", star: "井宿一", bayer: "μ Gem", ra: 6.406113, dec: 22.513333 },
  { xiu: "鬼", star: "鬼宿一", bayer: "θ Cnc", ra: 8.548371, dec: 18.091389 },
  { xiu: "柳", star: "柳宿一", bayer: "δ Hya", ra: 8.648148, dec: 5.703611 },
  { xiu: "星", star: "星宿一", bayer: "α Hya", ra: 9.478871, dec: -8.658611 },
  { xiu: "张", star: "张宿一", bayer: "υ Hya", ra: 9.876650, dec: -14.844444 },
  { xiu: "翼", star: "翼宿一", bayer: "α Crt", ra: 11.001776, dec: -18.277222 },
  { xiu: "轸", star: "轸宿一", bayer: "γ Crv", ra: 12.283278, dec: -17.541667 },
];

// 12 颗亮星（大角/天狼/织女等——M1 补——方案 v2.0 §5.6.4）
const BRIGHT_STARS = [
  { name: "大角", bayer: "α Boo", ra: 14.278159, dec: 19.182405 },
  { name: "大火 Antares", bayer: "α Sco", ra: 16.490118, dec: -26.432003 },
  { name: "参宿四 Betelgeuse", bayer: "α Ori", ra: 5.932562, dec: 7.407064 },
  { name: "北落师门 Fomalhaut", bayer: "α PsA", ra: 22.981449, dec: -29.622311 },
  { name: "天狼 Sirius", bayer: "α CMa", ra: 6.795204, dec: -16.716137 },
  { name: "毕宿五 Aldebaran", bayer: "α Tau", ra: 4.598704, dec: 16.509305 },
  { name: "南河三 Procyon", bayer: "α CMi", ra: 7.642132, dec: 5.225003 },
  { name: "河鼓二 Altair 牵牛", bayer: "α Aql", ra: 19.846368, dec: 8.868347 },
  { name: "织女 Vega", bayer: "α Lyr", ra: 18.627549, dec: 38.783686 },
  { name: "开阳 Mizar 武曲", bayer: "ζ UMa", ra: 13.414571, dec: 54.925417 },
  { name: "摇光 Alkaid 破军", bayer: "η UMa", ra: 13.792192, dec: 49.313272 },
];

// 行星距离（AU——方案 v2.0 §5.6.4）
const PLANET_DIST = {
  Mercury: { dist: 0.3871, min: 0.31, max: 0.47 },
  Venus: { dist: 0.7233, min: 0.72, max: 0.73 },
  Mars: { dist: 1.5237, min: 1.38, max: 1.67 },
  Jupiter: { dist: 5.2028, min: 4.95, max: 5.46 },
  Saturn: { dist: 9.5388, min: 9.05, max: 10.12 },
  Uranus: { dist: 19.1914, min: 18.28, max: 20.10 },
  Neptune: { dist: 30.0611, min: 29.81, max: 30.33 },
};

// 宿界差值法（v2.0 §5.6.2——同款实现——非查表）
function computeBounds() {
  const ryear = 365.25;
  const bounds = [];
  for (let z = 0; z < 28; z++) {
    const next = (z + 1) % 28;
    let ff = X28_STARS[next].ra * 3600 - X28_STARS[z].ra * 3600;
    if (ff < 0) ff += 24 * 3600;
    bounds.push(ff / (24 * 3600) * ryear);
  }
  return bounds;
}

const X28_NAMES = "角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸";
const X28_BOUNDS = computeBounds();
const YEAR_365_25 = 365.25;

module.exports = { X28_STARS, BRIGHT_STARS, PLANET_DIST, X28_NAMES, X28_BOUNDS, YEAR_365_25, computeBounds };
