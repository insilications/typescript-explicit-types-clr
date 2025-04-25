import { Range, window } from 'vscode';
import type { TextEditor, TextDocument, ExtensionContext, Disposable } from 'vscode';
import {
  outputChannel,
  textEditorHighlightStyles,
  BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING,
} from './extension';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import {
  LanguageClient,
  TransportKind, // We'll likely use stdio
  // RevealOutputChannelOn,
} from 'vscode-languageclient/node';
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

class LanguageClientCustom extends LanguageClient {
  protected override fillInitializeParams(params: InitializeParams): void {
    params.capabilities.experimental = {
      diff: true,
    };
    super.fillInitializeParams(params);
  }
}

let client: LanguageClientCustom | undefined;

export function startLSP(subscriptions: Disposable[]): LanguageClientCustom | undefined {
  // --- Server Options ---
  // Define how to LAUNCH the external executable
  const serverOptions: ServerOptions = {
    command: LSP_BINARY_NAME, // The command (path to executable)
    args: LSP_ARGS, // Arguments to pass to the command
    transport: TransportKind.stdio, // Use standard input/output for communication
    // options: {
    //    env: { ... } // Optional: Set environment variables for the server process
    // }
  };

  // --- Client Options ---
  // These define how the client behaves and what it expects from the server.
  // const clientOptions: LanguageClientOptions = {
  // They remain largely the same regardless of the server's implementation language.
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

  // --- Create and Start the Client ---
  try {
    client = new LanguageClientCustom(
      'DifftasticLspClient', // Unique ID for the client instance
      'Difftastic LSP Client', // Name shown in VS Code's Output panel
      serverOptions,
      clientOptions,
    );

    // Start the client. This will execute the `serverCommandPath` process.
    console.log(`Starting LSP Server: ${LSP_BINARY_NAME} ${LSP_ARGS.join(' ')}`);
    client
      .start()
      .then(() => {
        console.log('Difftastic LSP Client started successfully.');
        // Optional: Add listener for configuration changes after the client is ready
        // (Same as before, if needed)
      })
      .catch((error) => {
        // Provide more specific feedback if possible
        window.showErrorMessage(
          `Failed to start Difftastic LSP Server: ${error}. Ensure the executable exists, has execute permissions, and starts correctly.`,
        );
        console.error('Failed to start Difftastic LSP Client:', error);
      });
  } catch (error) {
    window.showErrorMessage(`Error creating Difftastic LSP Server: ${error}`);
    console.error('Error creating Difftastic LSP Client:', error);
  }

  // Ensure the client is stopped when the extension is deactivated
  subscriptions.push({
    dispose: () => {
      deactivate();
    },
  });

  console.log('Difftastic LSP Client extension activation finished.');
  return client;
}

export function deactivate(): Thenable<void> | undefined {
  console.log('Deactivating Difftastic LSP Client...');
  if (!client) {
    console.log('Difftastic LSP Client not active.');
    return undefined;
  }
  // client.stop() will send 'shutdown' and 'exit' notifications to the server
  // and terminate the process if it doesn't exit gracefully.
  const stopPromise = client.stop();
  client = undefined; // Clear the reference
  console.log('Difftastic LSP Client stopping...');
  return stopPromise
    .then(() => {
      console.log('Difftastic LSP Client stopped.');
    })
    .catch((err) => {
      console.error('Error stopping Difftastic LSP Client:', err);
    });
}
