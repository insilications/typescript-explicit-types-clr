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
  RevealOutputChannelOn,
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

export function startLSP(subscriptions: Disposable[]) {
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
  // They remain largely the same regardless of the server's implementation language.
  const clientOptions: LanguageClientOptions = {
    // Register the server for 'mylang' documents
    // documentSelector: [{ scheme: 'file', language: 'mylang' }],

    // Synchronize workspace settings under the 'mylang' section
    // synchronize: {
    // configurationSection: 'mylang',
    // Notify the server about file changes to specific file types if needed
    // fileEvents: workspace.createFileSystemWatcher('**/.mylang_config')
    // },

    revealOutputChannelOn: RevealOutputChannelOn.Info, // Or Never, Warn, Error

    // You might need to set initializationOptions if your Rust server
    // expects specific custom parameters during the 'initialize' request.
    // initializationOptions: {
    //    someCustomSetting: "value"
    // }
  };

  // --- Create and Start the Client ---
  try {
    client = new LanguageClientCustom(
      'mylangLanguageServerRust', // Unique ID for the client instance
      'MyLang Language Server (Rust)', // Name shown in VS Code's Output panel
      serverOptions,
      clientOptions,
    );

    // Start the client. This will execute the `serverCommandPath` process.
    console.log(`Starting LSP Server: ${LSP_BINARY_NAME} ${LSP_ARGS.join(' ')}`);
    client
      .start()
      .then(() => {
        console.log('MyLang language client (Rust Server) started successfully.');
        // Optional: Add listener for configuration changes after the client is ready
        // (Same as before, if needed)
      })
      .catch((error) => {
        // Provide more specific feedback if possible
        window.showErrorMessage(
          `Failed to start MyLang language client (Rust Server): ${error}. Ensure the executable exists, has execute permissions, and starts correctly.`,
        );
        console.error('Failed to start MyLang language client:', error);
      });
  } catch (error) {
    window.showErrorMessage(`Error creating MyLang language client (Rust Server): ${error}`);
    console.error('Error creating MyLang language client:', error);
  }

  // Ensure the client is stopped when the extension is deactivated
  subscriptions.push({
    dispose: () => {
      deactivate();
    },
  });

  console.log('MyLang extension activation finished.');
}

export function deactivate(): Thenable<void> | undefined {
  console.log('Deactivating MyLang extension (Rust Server)...');
  if (!client) {
    console.log('MyLang client not active.');
    return undefined;
  }
  // client.stop() will send 'shutdown' and 'exit' notifications to the server
  // and terminate the process if it doesn't exit gracefully.
  const stopPromise = client.stop();
  client = undefined; // Clear the reference
  console.log('MyLang client stopping...');
  return stopPromise
    .then(() => {
      console.log('MyLang client stopped.');
    })
    .catch((err) => {
      console.error('Error stopping MyLang client:', err);
    });
}
