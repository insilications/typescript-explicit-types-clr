import {
  commands,
  DocumentFilter,
  ExtensionContext,
  languages,
  workspace,
  window,
  OverviewRulerLane,
} from 'vscode';
import type { LogOutputChannel, TextEditorDecorationType } from 'vscode';
import { GenereateTypeProvider } from './actionProvider';
import { commandHandler, commandId, toogleQuotesCommandId, toggleQuotes } from './command';
// import type { GitExtension, API as GitAPI } from './types/git';
import {
  triggerUpdateDecorationsNow,
  triggerUpdateDecorationsDebounce,
} from './blameLineHighlight';

export let outputChannel: LogOutputChannel | undefined;

export const textEditorHighlightStyles: { latestHighlight: TextEditorDecorationType } = {
  latestHighlight: window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 21, 0.2)',
    // isWholeLine: true,
    overviewRulerLane: OverviewRulerLane.Left,
    overviewRulerColor: 'rgba(43, 255, 0, 1)',
    // borderWidth: '1px 1px 1px 1px',
    // borderStyle: 'solid',
    // borderSpacing: '6px',
    // borderRadius: '6px',
    // borderColor: 'rgb(255, 0, 0)',
  }),
};

export function activate(context: ExtensionContext) {
  // Create a custom channel for logging
  outputChannel = window.createOutputChannel('typescriptExplicitTypes', { log: true });

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

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await triggerUpdateDecorationsNow(editor);
      }
    }),
  );

  context.subscriptions.push(
    workspace.onDidChangeTextDocument((event) => {
      const eventDocumentUri = event.document.uri;
      if (eventDocumentUri.scheme === 'file') {
        const editorsWithDocument = window.visibleTextEditors.filter(
          (editor) => editor.document.uri.toString() === eventDocumentUri.toString(),
        );

        if (editorsWithDocument.length > 0) {
          outputChannel!.debug(
            `0 - onDidChangeTextDocument - editorsWithDocument[0].document.fileName: ${editorsWithDocument[0].document.fileName}`,
          );
          // Only use the first editor for this document
          triggerUpdateDecorationsDebounce(editorsWithDocument[0]);
        }
      }
    }),
  );

  setTimeout(() => {
    for (const visibleEditor of window.visibleTextEditors) {
      if (visibleEditor.document.uri.scheme === 'file') {
        outputChannel!.debug(
          `0 - triggerUpdateDecorations(visibleEditor) - visibleEditor: ${visibleEditor.document.fileName}`,
        );
        void triggerUpdateDecorationsNow(visibleEditor);
      }
    }
  }, 6000);

  outputChannel.appendLine('Extension activated.'); // Initial activation log
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('Extension deactivated.'); // Clean up logs
    outputChannel.dispose(); // Dispose to free resources
  }
}
