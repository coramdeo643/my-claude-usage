import * as vscode from 'vscode';
import { Reactor } from './engine/reactor';
import { StatusBar } from './controller/status_bar';

let reactor: Reactor;
let statusBar: StatusBar;

export async function activate(context: vscode.ExtensionContext) {
  statusBar = new StatusBar();
  reactor = new Reactor();

  // Reactor → StatusBar 파이프라인 연결
  reactor.onSnapshot(snapshot => statusBar.update(snapshot));

  // 설정에서 새로고침 간격(초) 읽기
  const config = vscode.workspace.getConfiguration('myClaudeUsage');
  const intervalSec = config.get<number>('refreshInterval', 120);

  // 주기적 폴링 시작 (밀리초 단위)
  await reactor.start(intervalSec * 1000);

  // 리소스 정리 및 수동 새로고침 커맨드 등록
  context.subscriptions.push(
    vscode.commands.registerCommand('myClaudeUsage.refresh', () => {
      statusBar.showPending();
      reactor.sync(true); // 수동 요청이므로 캐시 신선도는 무시
    }),
    statusBar,
    { dispose: () => reactor.shutdown() }
  );
}

export function deactivate() {
  reactor?.shutdown();
  statusBar?.dispose();
}
