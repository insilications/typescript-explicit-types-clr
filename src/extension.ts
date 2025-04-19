import {
  commands,
  DocumentFilter,
  ExtensionContext,
  languages,
  // extensions,
  window,
  // workspace,
  OverviewRulerLane,
} from 'vscode';
import type { LogOutputChannel, TextEditorDecorationType } from 'vscode';
import { GenereateTypeProvider } from './actionProvider';
import { commandHandler, commandId, toogleQuotesCommandId, toggleQuotes } from './command';
// import type { GitExtension, API as GitAPI } from './types/git';
import { triggerUpdateDecorations } from './blameLineHighlight';

export let outputChannel: LogOutputChannel | undefined;

export const textEditorHighlightStyles: { latestHighlight: TextEditorDecorationType } = {
  latestHighlight: window.createTextEditorDecorationType({
    // backgroundColor: 'rgba(0, 255, 21, 0.2)',
    // isWholeLine: true,
    overviewRulerLane: OverviewRulerLane.Left,
    overviewRulerColor: 'rgba(43, 255, 0, 1)',
    borderWidth: '1px 1px 1px 1px',
    borderStyle: 'solid',
    borderSpacing: '6px',
    borderRadius: '6px',
    borderColor: 'rgb(255, 0, 0)',
  }),
};

export function activate(context: ExtensionContext) {
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
  context.subscriptions.push(textEditorHighlightStyles.latestHighlight);

  outputChannel = window.createOutputChannel('typescript-explicit-types', { log: true }); // Create a custom channel

  // --- Event Listeners ---
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        triggerUpdateDecorations(editor);
      }
    }),
  );

  // context.subscriptions.push(
  //   workspace.onDidChangeTextDocument((event) => {
  //     // Trigger update if the changed document is the active one
  //     if (window.activeTextEditor && event.document === window.activeTextEditor.document) {
  //       triggerUpdateDecorations(window.activeTextEditor);
  //     }
  //   }),
  // );

  for (const visibleEditor of window.visibleTextEditors) {
    triggerUpdateDecorations(visibleEditor);
  }

  // const activeEditor = window.activeTextEditor;

  // if (activeEditor) {
  // triggerUpdateDecorations(activeEditor); // Initial update for the active editor
  // }

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
