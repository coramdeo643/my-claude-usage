/**
 * 툴팁용 ring/pie 차트 SVG(data URI) 생성.
 * 상태바 아이콘은 단색 폰트 글리프지만, 툴팁은 HTML <img>를 허용하므로 트랙/채움을 2색으로 그립니다.
 * percent는 사용량(used) 기준이며 채움 비율도 사용량입니다.
 */

const VIEWBOX = 32;
const CENTER = 16;
const TRACK_COLOR = '#404040';
const RING_RADIUS = 11.5;
const RING_STROKE = 3.5;
const PIE_RADIUS = 12;

export const WARNING_PERCENT = 70;
export const DANGER_PERCENT = 90;

function usageColor(percent: number): string {
  if (percent >= DANGER_PERCENT) return '#f44336';
  if (percent >= WARNING_PERCENT) return '#ff9800';
  return '#4caf50';
}

function polarToCartesian(r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

/** 12시 방향 시작점과, 거기서 시계 방향으로 angleDeg까지 그리는 호 명령 */
function arcFromTop(r: number, angleDeg: number): { start: string; arc: string } {
  const start = polarToCartesian(r, 0);
  const end = polarToCartesian(r, angleDeg);
  const largeArc = angleDeg > 180 ? 1 : 0;
  return {
    start: `${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    arc: `A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  };
}

function toDataUri(content: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">${content}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

export function ringSvgUri(percent: number): string {
  const pct = clampPercent(percent);
  const color = usageColor(pct);
  let content = `<circle cx="${CENTER}" cy="${CENTER}" r="${RING_RADIUS}" fill="none" stroke="${TRACK_COLOR}" stroke-width="${RING_STROKE}"/>`;
  if (pct >= 100) {
    content += `<circle cx="${CENTER}" cy="${CENTER}" r="${RING_RADIUS}" fill="none" stroke="${color}" stroke-width="${RING_STROKE}"/>`;
  } else if (pct > 0) {
    const { start, arc } = arcFromTop(RING_RADIUS, (pct / 100) * 360);
    content += `<path d="M ${start} ${arc}" fill="none" stroke="${color}" stroke-width="${RING_STROKE}" stroke-linecap="round"/>`;
  }
  return toDataUri(content);
}

export function pieSvgUri(percent: number): string {
  const pct = clampPercent(percent);
  const color = usageColor(pct);
  let content = `<circle cx="${CENTER}" cy="${CENTER}" r="${PIE_RADIUS}" fill="${TRACK_COLOR}"/>`;
  if (pct >= 100) {
    content += `<circle cx="${CENTER}" cy="${CENTER}" r="${PIE_RADIUS}" fill="${color}"/>`;
  } else if (pct > 0) {
    const { start, arc } = arcFromTop(PIE_RADIUS, (pct / 100) * 360);
    content += `<path d="M ${CENTER} ${CENTER} L ${start} ${arc} Z" fill="${color}"/>`;
  }
  return toDataUri(content);
}
