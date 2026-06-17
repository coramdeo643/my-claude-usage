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

  update(snapshot: UsageSnapshot): void {
    if (!snapshot.isConnected) {
      this.item.text = 'Claude: No Auth';
      this.item.tooltip = snapshot.errorMessage || 'Failed to fetch usage';
      this.item.color = new vscode.ThemeColor('errorForeground');
      return;
    }

    // 5h (session) 사용량을 기본값으로 사용. 없으면 0% 처리
    const percent = snapshot.session?.percent ?? 0;

    // 아이콘 없이 텍스트로만 표시 (사용한 양)
    this.item.text = `Claude 5h: ${percent}%`;

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

  dispose(): void {
    this.item.dispose();
  }
}
