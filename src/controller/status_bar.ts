import * as vscode from 'vscode';
import { UsageSnapshot } from '../shared/types';

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

    // 5h (session) 사용량을 기본값으로 사용. 없으면 0% 처리
    const percent = snapshot.session?.percent ?? 0;

    // 아이콘 없이 텍스트로만 표시 (사용한 양). ~는 갱신이 밀린 값이라는 표시
    this.item.text = `Claude 5h: ${percent}%${snapshot.isStale ? '~' : ''}`;

    // 색상 적용 (사용량이 높을수록 경고/에러)
    if (percent >= 90) {
      this.item.color = new vscode.ThemeColor('errorForeground');
    } else if (percent >= 70) {
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
      lines.push(`retry in ${this.formatCountdown(s.retryAt)}`);
    }
    tooltip.appendMarkdown(lines.join('  \n'));

    return tooltip;
  }

  private buildTooltip(s: UsageSnapshot): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;

    // 꼭 필요한 정보만: 윈도우(5h/7d) · 사용% · 남은 시간
    const lines: string[] = [];
    if (s.session) {
      lines.push(`**5h** ${s.session.percent}% · ${this.formatCountdown(s.session.resetAt)}`);
    }
    if (s.weekly) {
      lines.push(`**7d** ${s.weekly.percent}% · ${this.formatCountdown(s.weekly.resetAt)}`);
    }
    if (s.isStale) {
      const age = this.formatAge(s.fetchedAt);
      lines.push(s.retryAt
        ? `_${age} 전 값 · ${s.errorMessage || 'retry'} · retry in ${this.formatCountdown(s.retryAt)}_`
        : `_${age} 전 값_`);
    }
    tooltip.appendMarkdown(lines.join('  \n')); // 두 칸 + 개행 = 소프트 줄바꿈

    return tooltip;
  }

  private formatCountdown(resetAtMs: number): string {
    if (!resetAtMs) return 'Unknown';

    const diff = resetAtMs - Date.now();
    if (diff <= 0) return 'now';

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (h > 24) {
      const d = Math.floor(h / 24);
      const remainingH = h % 24;
      return `${d}d ${remainingH}h`;
    }

    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
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
