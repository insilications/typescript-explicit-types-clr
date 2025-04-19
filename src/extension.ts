import {
  commands,
  DocumentFilter,
  ExtensionContext,
  languages,
  workspace,
  window,
  OverviewRulerLane,
  extensions,
} from 'vscode';
import type {
  LogOutputChannel,
  TextEditorDecorationType,
  Uri,
  Disposable,
  TextEditor,
  // Extension,
} from 'vscode';
import { GenereateTypeProvider } from './actionProvider';
import { commandHandler, commandId, toogleQuotesCommandId, toggleQuotes } from './command';
import type { GitExtension, API as GitAPI, Repository } from './types/git';
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

const repositoryStateListeners = new Map<Uri, Disposable>();

function enableGitExtensionFunctionality(context: ExtensionContext) {
  try {
    const gitExtension: GitExtension | undefined =
      extensions.getExtension<GitExtension>('vscode.git')?.exports;

    if (!gitExtension) {
      outputChannel!.warn('Git extension "vscode.git" not found.');
      return;
    }
    if (!gitExtension.enabled) {
      outputChannel!.warn('Git extension is not enabled. Waiting for enablement...');
      return;
    }

    const gitApi: GitAPI = gitExtension.getAPI(1);
    outputChannel!.info(
      `Git API version 1 obtained. Found ${gitApi.repositories.length} initial repositories.`,
    );

    // Function to subscribe to a repository's state changes
    const subscribeToRepositoryState = (repository: Repository) => {
      const repoUri = repository.rootUri;
      outputChannel!.info(`Subscribing to state changes for repository: ${repoUri.fsPath}`);

      // Check if already subscribed (should not happen with proper cleanup, but good practice)
      if (repositoryStateListeners.has(repoUri)) {
        outputChannel!.warn(
          `Already subscribed to repository: ${repoUri.fsPath}. Disposing old listener.`,
        );
        repositoryStateListeners.get(repoUri)?.dispose();
      }

      const stateChangeListener = repository.state.onDidChange(() => {
        outputChannel!.info(`Repository state changed for: ${repoUri.fsPath}`);

        const currentHead = repository.state.HEAD?.name;
        outputChannel!.info(`Current HEAD: ${currentHead ?? 'detached'}`);

        // use .map()
        const visibleEditorsWithFiles: TextEditor[] = window.visibleTextEditors.filter(
          (editor: TextEditor) => editor.document.uri.scheme === 'file',
        );
      });

      // Store the disposable listener
      repositoryStateListeners.set(repoUri, stateChangeListener);
      // Also add to context.subscriptions for automatic cleanup on extension deactivation
      context.subscriptions.push(stateChangeListener);
    };

    // Function to unsubscribe from a repository's state changes
    const unsubscribeFromRepositoryState = (repository: Repository) => {
      const repoUri = repository.rootUri;
      const listener = repositoryStateListeners.get(repoUri);
      if (listener) {
        outputChannel!.info(`Unsubscribing from state changes for repository: ${repoUri.fsPath}`);
        listener.dispose();
        repositoryStateListeners.delete(repoUri);
      }
    };

    // 1. Subscribe to initially open repositories
    gitApi.repositories.forEach(subscribeToRepositoryState);

    // 2. Subscribe to repositories opened *after* activation
    const openRepoListener = gitApi.onDidOpenRepository(subscribeToRepositoryState);
    context.subscriptions.push(openRepoListener); // Add listener disposable to context

    // 3. Unsubscribe when repositories are closed
    const closeRepoListener = gitApi.onDidCloseRepository(unsubscribeFromRepositoryState);
    context.subscriptions.push(closeRepoListener); // Add listener disposable to context

    outputChannel!.info('Successfully subscribed to Git repository state changes.');
  } catch (error) {
    outputChannel!.error('Error activating extension or interacting with Git API:', error);
  }
}

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
  }, 4000);

  setTimeout(() => {
    enableGitExtensionFunctionality(context);
  }, 4000);

  outputChannel.appendLine('Extension activated.'); // Initial activation log
}

export function deactivate() {
  repositoryStateListeners.forEach((disposable: Disposable): any => disposable.dispose());
  repositoryStateListeners.clear();

  if (outputChannel) {
    outputChannel.appendLine('Extension deactivated.'); // Clean up logs
    outputChannel.dispose(); // Dispose to free resources
  }
}
