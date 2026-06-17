import * as vscode from 'vscode';
import { readCredential } from './credential_reader';
import { fetchUsage } from './usage_api';
import { UsageSnapshot } from '../shared/types';

export class Reactor {
  private timer?: NodeJS.Timeout;
  private emitter = new vscode.EventEmitter<UsageSnapshot>();
  public readonly onSnapshot = this.emitter.event;

  async start(intervalMs: number): Promise<void> {
    await this.sync(); // 즉시 1회 실행
    this.timer = setInterval(() => this.sync(), intervalMs);
  }

  async sync(): Promise<void> {
    const token = await readCredential();
    
    if (!token) {
      this.emitter.fire({
        session: null,
        weekly: null,
        fetchedAt: Date.now(),
        isConnected: false,
        errorMessage: 'No auth (Claude Code)',
      });
      return;
    }

    const snapshot = await fetchUsage(token);
    this.emitter.fire(snapshot);
  }

  shutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.emitter.dispose();
  }
}
