import { Range } from 'vscode';
import type { TextEditor, TextDocument } from 'vscode';
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
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

const LSP_BINARY_NAME = 'difft';
const LSP_ARGS: string[] = [
  '--context=0',
  '--display=json2',
  '--parse-error-limit=10',
  '--graph-limit=9999999',
  '--lsp',
];

export function startLSP() {
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
}
