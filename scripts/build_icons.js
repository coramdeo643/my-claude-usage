// 상태바용 ring/pie 아이콘 폰트를 생성하고 package.json contributes.icons를 갱신합니다.
// 상태바 text는 $(icon) 글리프만 렌더링하므로 차트를 폰트로 만들어야 합니다.
// 사용: npm run build:icons
const fs = require('fs');
const path = require('path');
const svg2ttf = require('svg2ttf');
const ttf2woff = require('ttf2woff');

const rootDir = path.join(__dirname, '..');
const resourcesDir = path.join(rootDir, 'resources');

// VS Code는 같은 경로의 폰트를 캐시하므로 글리프가 바뀌면 파일명 버전을 올립니다.
const FONT_FILE_NAME = 'myclaude-icons-v1.woff';
const FONT_PATH = `./resources/${FONT_FILE_NAME}`;

// 폰트 좌표계(1000 units/em, Y축 위로 증가) 기준 글리프 세로 중심.
// 값이 작을수록 아이콘이 아래로 내려갑니다. 16px 기준 약 62 units = 1px.
const FONT_CENTER_Y = 430;
const CENTER_X = 500;
const OUTER_RADIUS = 350;
const RING_INNER_RADIUS = 230;
const EMPTY_OUTLINE_WIDTH = 50;
const STEP_PERCENT = 5;

const RING_CODE_START = 0xe901;
const PIE_CODE_START = 0xea00;

function polarToFont(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

function circlePath(cx, cy, r, counterClockwise = false) {
  const sweep = counterClockwise ? 0 : 1;
  return `M ${cx} ${cy + r} A ${r} ${r} 0 1 ${sweep} ${cx} ${cy - r} A ${r} ${r} 0 1 ${sweep} ${cx} ${cy + r} Z`;
}

// 0%는 얇은 외곽선으로 그려 아이콘 자리가 비어 보이지 않게 합니다.
function emptyOutlinePath(cx, cy, r) {
  return `${circlePath(cx, cy, r)} ${circlePath(cx, cy, r - EMPTY_OUTLINE_WIDTH, true)}`;
}

function ringPath(cx, cy, rOuter, rInner, pct) {
  if (pct <= 0) return emptyOutlinePath(cx, cy, rOuter);
  if (pct >= 100) return `${circlePath(cx, cy, rOuter)} ${circlePath(cx, cy, rInner, true)}`;

  const endAngle = (pct / 100) * 360;
  const startOuter = polarToFont(cx, cy, rOuter, 0);
  const endOuter = polarToFont(cx, cy, rOuter, endAngle);
  const endInner = polarToFont(cx, cy, rInner, endAngle);
  const startInner = polarToFont(cx, cy, rInner, 0);
  const largeArc = endAngle > 180 ? 1 : 0;

  // 폰트 좌표계(Y up)에서 시계 방향 호는 sweep=0
  return `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)} ` +
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)} ` +
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)} ` +
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)} Z`;
}

function piePath(cx, cy, r, pct) {
  if (pct <= 0) return emptyOutlinePath(cx, cy, r);
  if (pct >= 100) return circlePath(cx, cy, r);

  const endAngle = (pct / 100) * 360;
  const start = polarToFont(cx, cy, r, 0);
  const end = polarToFont(cx, cy, r, endAngle);
  const largeArc = endAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} ` +
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

const glyphs = [];
const iconsConfig = {};

function addChartGlyphs(type, label, codeStart, buildPath) {
  let code = codeStart;
  for (let pct = 0; pct <= 100; pct += STEP_PERCENT) {
    glyphs.push(`<glyph glyph-name="${type}-${pct}" unicode="&#x${code.toString(16)};" horiz-adv-x="1000" d="${buildPath(pct)}" />`);
    iconsConfig[`myclaude-${type}-${pct}`] = {
      description: `${label} ${pct}%`,
      default: { fontPath: FONT_PATH, fontCharacter: `\\${code.toString(16)}` },
    };
    code++;
  }
}

addChartGlyphs('ring', 'Ring Chart', RING_CODE_START,
  pct => ringPath(CENTER_X, FONT_CENTER_Y, OUTER_RADIUS, RING_INNER_RADIUS, pct));
addChartGlyphs('pie', 'Pie Chart', PIE_CODE_START,
  pct => piePath(CENTER_X, FONT_CENTER_Y, OUTER_RADIUS, pct));

const svgFont = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
  <font id="myclaude-icons" horiz-adv-x="1000">
    <font-face units-per-em="1000" ascent="800" descent="-200" />
    <missing-glyph horiz-adv-x="500" />
    ${glyphs.join('\n    ')}
  </font>
</defs>
</svg>`;

const ttf = svg2ttf(svgFont, {});
const woff = ttf2woff(new Uint8Array(ttf.buffer));

fs.mkdirSync(resourcesDir, { recursive: true });
fs.writeFileSync(path.join(resourcesDir, FONT_FILE_NAME), Buffer.from(woff.buffer));

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.contributes.icons = iconsConfig;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`[OK] ${FONT_PATH} (${glyphs.length} glyphs), package.json contributes.icons updated`);
