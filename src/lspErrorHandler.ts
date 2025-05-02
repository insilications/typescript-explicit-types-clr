import { window, WorkspaceConfiguration } from 'vscode';
import { Message } from 'vscode-jsonrpc';
import {
  CloseAction,
  ErrorAction,
  ErrorHandler,
  CloseHandlerResult,
  ErrorHandlerResult,
} from 'vscode-languageclient';
import { outputChannel } from './extension';
import type { TypescriptExplicitTypesSettings } from './types/types';

export class LspErrorHandler implements ErrorHandler {
  constructor(readonly config: WorkspaceConfiguration & TypescriptExplicitTypesSettings) {}

  public error(
    error: Error,
    message: Message | undefined,
    count: number | undefined,
  ): ErrorHandlerResult | Promise<ErrorHandlerResult> {
    outputChannel!.error(
      `Difftastic LSP error (count ${count}): ${message?.jsonrpc} - Error: ${error.message}`,
    );
    return { action: ErrorAction.Continue };
  }

  public closed(): CloseHandlerResult | Promise<CloseHandlerResult> {
    outputChannel!.info(`Difftastic LSP Server connection was closed.`);
    // const notifyOnCrash = this.config.get('launch.notifyOnCrash');
    // const restart = this.config.get('launch.autoRestart');

    window.showInformationMessage('Difftastic LSP has crashed. Restarting it...');
    return { action: CloseAction.Restart };

    // if (notifyOnCrash) {
    //   window.showInformationMessage(
    //     restart
    //       ? 'Difftastic LSP has crashed; it has been restarted.'
    //       : 'Difftastic LSP has crashed; it has not been restarted.',
    //   );
    // }

    // if (restart) {
    // return { action: CloseAction.Restart };
    // }
    // return { action: CloseAction.DoNotRestart };
  }
}
