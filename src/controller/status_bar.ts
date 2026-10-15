import * as vscode from 'vscode';
import { UsageSnapshot } from '../shared/types';
import { DANGER_PERCENT, WARNING_PERCENT, pieSvgUri, ringSvgUri } from './chart_svg';

/** package.json contributes.icons의 글리프 단위 (scripts/build_icons.js STEP_PERCENT와 동일) */
const ICON_STEP_PERCENT = 5;

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    // 99는 우선순위 (오른쪽에 배치)
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.item.command = 'myClaudeUsage.refresh';
    this.item.text = 'Claude: Loading...';
    this.item.show();
  }

  /** 수동 새로고침을 눌렀을 때의 즉각적인 UI 피드백 */
  showPending(): void {
    this.item.text = 'Claude: Loading...';
  }

  update(snapshot: UsageSnapshot): void {
    if (!snapshot.isConnected) {
      this.item.text = this.errorText(snapshot);
      this.item.tooltip = this.buildErrorTooltip(snapshot);
      // 대기 상태는 오류가 아니므로 빨갛게 물들이지 않습니다.
      this.item.color = snapshot.errorKind === 'pending'
        ? undefined
        : new vscode.ThemeColor('errorForeground');
      return;
    }

    // 사용량(used) 기준. 윈도우 값이 없으면 0% 처리
    const sessionPercent = snapshot.session?.percent ?? 0;
    const weeklyPercent = snapshot.weekly?.percent ?? 0;

    // 5h는 링, 7d는 파이. ~는 갱신이 밀린 값이라는 표시
    this.item.text = `Claude ${this.chartIcon('ring', sessionPercent)} ${sessionPercent}% `
      + `${this.chartIcon('pie', weeklyPercent)} ${weeklyPercent}%${snapshot.isStale ? '~' : ''}`;

    // 둘 중 하나라도 한도에 가까우면 경고. 5h만 보면 7d 소진을 놓칩니다.
    const worstPercent = Math.max(sessionPercent, weeklyPercent);
    if (worstPercent >= DANGER_PERCENT) {
      this.item.color = new vscode.ThemeColor('errorForeground');
    } else if (worstPercent >= WARNING_PERCENT) {
      this.item.color = new vscode.ThemeColor('editorWarning.foreground');
    } else {
      this.item.color = undefined; // 기본 색상
    }

    this.item.tooltip = this.buildTooltip(snapshot);
  }

  /** 실패 원인별 문구. 원인이 다른데 같은 말이 뜨면 디버깅이 불가능해집니다. */
  private errorText(s: UsageSnapshot): string {
    switch (s.errorKind) {
      case 'no_auth': return 'Claude: No Auth';
      case 'rate_limited': return 'Claude: Rate limited';
      case 'network': return 'Claude: Offline';
      case 'pending': return 'Claude: Loading...';
      default: return 'Claude: Error';
    }
  }

  private buildErrorTooltip(s: UsageSnapshot): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;

    const lines: string[] = [s.errorMessage || 'Failed to fetch usage'];
    if (s.retryAt) {
      lines.push(`retry in ${this.formatHoursMinutes(s.retryAt)}`);
    }
    tooltip.appendMarkdown(lines.join('  \n'));

    return tooltip;
  }

  private buildTooltip(s: UsageSnapshot): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = true; // 차트 <img> 렌더링용

    // 꼭 필요한 정보만: 윈도우(5h/7d) · 차트 · 사용% · 남은 시간
    const lines: string[] = [];
    if (s.session) {
      const ring = this.chartImage(ringSvgUri(s.session.percent));
      lines.push(`**5h** ${ring} ${s.session.percent}% ${this.formatHoursMinutes(s.session.resetAt)}`);
    }
    if (s.weekly) {
      const pie = this.chartImage(pieSvgUri(s.weekly.percent));
      lines.push(`**7d** ${pie} ${s.weekly.percent}% ${this.formatDaysHours(s.weekly.resetAt)}`);
    }
    if (s.isStale) {
      const age = this.formatAge(s.fetchedAt);
      lines.push(s.retryAt
        ? `_${age} 전 값 · ${s.errorMessage || 'retry'} · retry in ${this.formatHoursMinutes(s.retryAt)}_`
        : `_${age} 전 값_`);
    }
    tooltip.appendMarkdown(lines.join('  \n')); // 두 칸 + 개행 = 소프트 줄바꿈

    return tooltip;
  }

  /** 상태바용 폰트 아이콘. 글리프가 5% 단위라 가장 가까운 단계로 반올림합니다. */
  private chartIcon(type: 'ring' | 'pie', percent: number): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const step = Math.round(clamped / ICON_STEP_PERCENT) * ICON_STEP_PERCENT;
    return `$(myclaude-${type}-${step})`;
  }

  private chartImage(dataUri: string): string {
    return `<img src="${dataUri}" width="14" height="14" align="absmiddle" />`;
  }

  /** 리셋까지 남은 시간(ms). 알 수 없으면 null */
  private remainingMs(resetAtMs: number): number | null {
    if (!resetAtMs) return null;
    return Math.max(0, resetAtMs - Date.now());
  }

  /** 5h 윈도우·retry용: 항상 `Xh Ym` */
  private formatHoursMinutes(resetAtMs: number): string {
    const diff = this.remainingMs(resetAtMs);
    if (diff === null) return 'Unknown';
    if (diff === 0) return 'now';

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  }

  /** 7d 윈도우용: 항상 `Xd Yh` */
  private formatDaysHours(resetAtMs: number): string {
    const diff = this.remainingMs(resetAtMs);
    if (diff === null) return 'Unknown';
    if (diff === 0) return 'now';

    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    return `${Math.floor(totalHours / 24)}d ${totalHours % 24}h`;
  }

  private formatAge(fetchedAtMs: number): string {
    const diff = Math.max(0, Date.now() - fetchedAtMs);
    const m = Math.floor(diff / (1000 * 60));
    if (m < 1) return '방금';
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
