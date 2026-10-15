// 확장 아이콘(images/logo.png)을 생성합니다.
// 구성: 투명 배경 / 링 안쪽 흰 원 / 검은 CD 이니셜 / 사용량 링(트랙 + 70% 주황 호)
// Marketplace 아이콘은 PNG만 허용되므로 SVG를 그려 resvg로 래스터화합니다.
// 사용: npm run build:logo
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const rootDir = path.join(__dirname, '..');
const INITIALS_SOURCE = path.join(rootDir, 'dev.coramdeo_profile.png');
const OUTPUT = path.join(rootDir, 'images', 'logo.png');

const SIZE = 512;
const CENTER = SIZE / 2;
const RING_RADIUS = 200;
const RING_STROKE = 40;
const FILL_RATIO = 0.7;
const TRACK_COLOR = '#555555';
const FILL_COLOR = '#4caf50';
const DISC_COLOR = '#ffffff';

// 원본 이니셜 이미지(512px, 글자 폭 약 400px)를 링 안쪽에 들어가도록 축소 배치
const INITIALS_SIZE = 360;
const INITIALS_X = 76;
const INITIALS_Y = 83;

// 흰 원이 링 안쪽 가장자리 밑으로 살짝 들어가게 해 경계에 틈이 생기지 않게 합니다.
const discRadius = RING_RADIUS - RING_STROKE / 2 + 4;
const circumference = 2 * Math.PI * RING_RADIUS;
const fillLength = circumference * FILL_RATIO;

const initialsBase64 = fs.readFileSync(INITIALS_SOURCE).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <clipPath id="disc"><circle cx="${CENTER}" cy="${CENTER}" r="${discRadius}"/></clipPath>
  </defs>
  <circle cx="${CENTER}" cy="${CENTER}" r="${discRadius}" fill="${DISC_COLOR}"/>
  <image href="data:image/png;base64,${initialsBase64}" x="${INITIALS_X}" y="${INITIALS_Y}" width="${INITIALS_SIZE}" height="${INITIALS_SIZE}" clip-path="url(#disc)"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${RING_RADIUS}" fill="none" stroke="${TRACK_COLOR}" stroke-width="${RING_STROKE}"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${RING_RADIUS}" fill="none" stroke="${FILL_COLOR}" stroke-width="${RING_STROKE}"
    stroke-linecap="round" stroke-dasharray="${fillLength.toFixed(2)} ${circumference.toFixed(2)}"
    transform="rotate(-90 ${CENTER} ${CENTER})"/>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
fs.writeFileSync(OUTPUT, png);

console.log(`[OK] ${path.relative(rootDir, OUTPUT)} (${png.length} bytes)`);
