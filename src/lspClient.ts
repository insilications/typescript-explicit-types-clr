import type { Disposable } from 'vscode';
import { outputChannel } from './extension';
// import { spawn } from 'node:child_process';
// import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

import type {
  LanguageClientOptions,
  ServerOptions,
  InitializeParams,
} from 'vscode-languageclient/node';

const LSP_BINARY_NAME = '/usr/bin/difft';
const LSP_ARGS: string[] = [
  '--context=0',
  '--display=json2',
  '--parse-error-limit=10',
  '--graph-limit=9999999',
  '--lsp',
];

export class LanguageClientCustom extends LanguageClient {
  protected override fillInitializeParams(params: InitializeParams): void {
    params.capabilities.experimental = {
      diff: true,
    };
    super.fillInitializeParams(params);
  }
}

let client: LanguageClientCustom | undefined;

export async function startLSP(
  subscriptions: Disposable[],
): Promise<LanguageClientCustom | undefined> {
  const serverOptions: ServerOptions = {
    command: LSP_BINARY_NAME, // The command (path to executable)
    args: LSP_ARGS, // Arguments to pass to the command
    transport: TransportKind.stdio, // Use standard input/output for communication
    options: {
      // cwd: undefined, // Current working directory for the server process
      detached: false, // Whether to run the server in a detached process
      shell: false, // Whether to use a shell to execute the command
      //    env: { ... } // Optional: Set environment variables for the server process
    },
  };

  const clientOptions: LanguageClientOptions = {
    // Register the server for 'mylang' documents
    // documentSelector: [{ scheme: 'file', language: 'mylang' }],
    documentSelector: [{ scheme: 'file' }],

    // Synchronize workspace settings under the 'mylang' section
    // synchronize: {
    // configurationSection: 'mylang',
    // Notify the server about file changes to specific file types if needed
    // fileEvents: workspace.createFileSystemWatcher('**/.mylang_config')
    // },

    // revealOutputChannelOn: RevealOutputChannelOn.Info, // Or Never, Warn, Error

    // You might need to set initializationOptions if your Rust server
    // expects specific custom parameters during the 'initialize' request.
    // initializationOptions: {
    //    someCustomSetting: "value"
    // }

    // middleware: {
    //   didOpen: async (document, next) => {
    //     outputChannel!.debug(`0 - middleware didOpen - document.fileName: ${document.fileName}`);
    //     for (const visibleEditor of window.visibleTextEditors) {
    //       const visibleEditorDocument = visibleEditor.document;
    //       outputChannel!.debug(
    //         `1 - middleware didOpen - visibleEditorDocument.fileName: ${visibleEditorDocument.fileName}`,
    //       );
    //       if (visibleEditorDocument.uri.scheme === 'file') {
    //         outputChannel!.debug(
    //           `2 - middleware didOpen - visibleEditorDocument.fileName: ${visibleEditorDocument.fileName}`,
    //         );
    //         if (document.fileName == visibleEditorDocument.fileName) {
    //           outputChannel!.debug(`3 - middleware didOpen - send: ${document.fileName}`);
    //           return next(document);
    //         }
    //       }
    //     }
    //     return;
    //   },
    // },
    // textSynchronization: { delayOpenNotifications: true },
  };

  try {
    client = new LanguageClientCustom(
      'DifftasticLspClient', // Unique ID for the client instance
      'Difftastic LSP Client', // Name shown in VS Code's Output panel
      serverOptions,
      clientOptions,
    );

    // Start the client. This will execute the `serverCommandPath` process.
    outputChannel!.info(`Starting LSP Server: ${LSP_BINARY_NAME} ${LSP_ARGS.join(' ')}`);
    await client.start();

    // Ensure the client is stopped when the extension is deactivated
    subscriptions.push({
      dispose: () => {
        deactivate();
      },
    });

    outputChannel!.info('Difftastic LSP Client started successfully.');
    return client;
  } catch (error) {
    outputChannel!.error(
      'Failed to start Difftastic LSP Client. Ensure the `difft` executable exists, has execute permissions, and starts correctly.:',
      error,
    );
    return undefined;
  }
}

export function deactivate(): Thenable<void> | undefined {
  outputChannel!.info('Deactivating Difftastic LSP Client...');
  if (!client) {
    outputChannel!.info('Difftastic LSP Client not active.');
    return undefined;
  }
  // client.stop() will send 'shutdown' and 'exit' notifications to the server
  // and terminate the process if it doesn't exit gracefully.
  const stopPromise = client.stop();
  client = undefined; // Clear the reference
  outputChannel!.info('Difftastic LSP Client stopping...');
  return stopPromise
    .then(() => {
      outputChannel!.info('Difftastic LSP Client stopped.');
    })
    .catch((err: unknown) => {
      outputChannel!.error('Error stopping Difftastic LSP Client:', err);
    });
}
