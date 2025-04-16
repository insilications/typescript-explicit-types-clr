import { commands, DocumentFilter, ExtensionContext, languages, extensions, window } from 'vscode';
import type { LogOutputChannel } from 'vscode';
import { GenereateTypeProvider } from './actionProvider';
import { commandHandler, commandId, toogleQuotesCommandId, toggleQuotes } from './command';
import type { GitExtension, API as GitAPI } from './types/git';
import { updateDecorations } from './blameLineHighlight';

export let outputChannel: LogOutputChannel | undefined;

export async function activate(context: ExtensionContext) {
  const selector: DocumentFilter[] = [];
  for (const language of ['typescript', 'typescriptreact', 'svelte']) {
    selector.push({ language, scheme: 'file' });
    selector.push({ language, scheme: 'untitled' });
  }

  const command = commands.registerCommand(commandId, commandHandler);
  const codeActionProvider = languages.registerCodeActionsProvider(
    selector,
    new GenereateTypeProvider(),
    GenereateTypeProvider.metadata,
  );

  const toggleQuotesCommand = commands.registerCommand(toogleQuotesCommandId, toggleQuotes);

  context.subscriptions.push(command);
  context.subscriptions.push(codeActionProvider);
  context.subscriptions.push(toggleQuotesCommand);

  outputChannel = window.createOutputChannel('typescript-explicit-types', { log: true }); // Create a custom channel

  const gitExtension = extensions.getExtension<GitExtension>('vscode.git')?.exports;
  if (!gitExtension) {
    window.showErrorMessage('typescript-explicit-types: vscode.git extension is not available.');
    return;
  }
  const gitApi: GitAPI = gitExtension.getAPI(1);

  // Example: Register listeners
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await updateDecorations(editor, gitApi);
      }
    }),
  );

  // Initial update for the currently active editor
  if (window.activeTextEditor) {
    await updateDecorations(window.activeTextEditor, gitApi);
  }

  // Optional: Listen for Git state changes to update decorations
  // gitApi.onDidOpenRepository(repo => { /* ... */ });
  // repo.state.onDidChange(() => { /* ... update for relevant editor ... */ });

  outputChannel.appendLine('Extension activated.'); // Initial activation log
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('Extension deactivated.'); // Clean up logs
    outputChannel.dispose(); // Dispose to free resources
  }
}
