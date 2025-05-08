import {
  commands,
  DocumentFilter,
  ExtensionContext,
  languages,
  workspace,
  window,
  OverviewRulerLane,
  extensions,
  StatusBarAlignment,
} from 'vscode';
import type {
  LogOutputChannel,
  TextEditorDecorationType,
  Uri,
  Disposable,
  TextEditor,
  TextDocument,
  StatusBarItem,
  WorkspaceConfiguration,
  // Extension,
} from 'vscode';
import { GenereateTypeProvider } from './actionProvider';
import { commandHandler, commandId, toogleQuotesCommandId, toggleQuotes } from './command';
import type { GitExtension, API as GitAPI, Repository } from './types/git';
import {
  updateDecorations2,
  triggerUpdateDecorationsDebounce,
  getCommitSubject,
} from './blameLineHighlight';
import type { TypescriptExplicitTypesSettings } from './types/types';
import { didOpenTextDocumentCustomRequestType } from './types/lspTypes';
import { inspect } from 'node:util';
import { startLSP } from './lspClient';
import type { LanguageClientCustom } from './lspClient';

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
export let BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING = 'HEAD~1';

const repositoryStateListeners = new Map<Uri, Disposable>();
let myStatusBarItem: StatusBarItem;
export let typescriptExplicitTypesSettings: WorkspaceConfiguration &
  TypescriptExplicitTypesSettings;

export async function activate({ subscriptions }: ExtensionContext): Promise<void> {
  // Create a custom channel for logging
  outputChannel = window.createOutputChannel('Difftastic', { log: true });
  getAllTypescriptExplicitTypesSetting();

  // subscriptions.push(
  //   workspace.onDidOpenTextDocument((event: TextDocument) => {
  //     // if (event.uri.scheme === 'file') {
  //     const eventFileName = event.fileName;
  //     outputChannel!.debug(`0 - onDidOpenTextDocument - eventFileName: ${eventFileName}`);
  //     // }
  //   }),
  // );

  // workspace.onDidOpenTextDocument(
  //   (event: TextDocument) => {
  //     if (event.uri.scheme === 'file') {
  //       const eventFileName = event.fileName;
  //       outputChannel!.debug(`0 - onDidOpenTextDocument - eventFileName: ${eventFileName}`);
  //     }
  //   },
  //   null,
  //   subscriptions,
  // );

  // window.onDidChangeActiveTextEditor(
  //   (editor) => {
  //     if (editor) {
  //       outputChannel!.debug(
  //         `0 - onDidChangeActiveTextEditor - eventFileName: ${editor.document.fileName}`,
  //       );
  //     }
  //   },
  //   null,
  //   subscriptions,
  // );

  //    typescriptExplicitTypesSettings: {
  //   has: [Function: has],
  //   get: [Function: get],
  //   update: [Function: update],
  //   inspect: [Function: inspect],
  //   blameHighlightinglogLevel: 'Info',
  //   blameHighlightingParentLevel: '1',
  //   blameHighlightingShowStatus: true,
  //   blameHighlightingShowToastParentLevel: true,
  //   preferable: true,
  //   formatAfterGeneration: true,
  //   togglequotes: { chars: [] },
  //   logLevel: 'Debug'
  // }

  // const selector: DocumentFilter[] = [];
  // for (const language of ['typescript', 'typescriptreact', 'svelte']) {
  // selector.push({ language, scheme: 'file' });
  // selector.push({ language, scheme: 'untitled' });
  // }

  // const command = commands.registerCommand(commandId, commandHandler);
  // const codeActionProvider = languages.registerCodeActionsProvider(
  // selector,
  // new GenereateTypeProvider(),
  // GenereateTypeProvider.metadata,
  // );

  // const toggleQuotesCommand = commands.registerCommand(toogleQuotesCommandId, toggleQuotes);

  // subscriptions.push(command);
  // subscriptions.push(codeActionProvider);
  // subscriptions.push(toggleQuotesCommand);
  subscriptions.push(textEditorHighlightStyles.latestHighlight);

  if (typescriptExplicitTypesSettings.blameHighlightingShowStatus) {
    myStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 1);
    subscriptions.push(myStatusBarItem);
  }

  // subscriptions.push(
  //   window.onDidChangeActiveTextEditor(async (editor) => {
  //     if (editor) {
  //       const editorDocument: TextDocument = editor.document;
  //       if (editorDocument.uri.scheme === 'file') {
  //         const editorDocumentFileName = editorDocument.fileName;
  //         outputChannel!.debug(
  //           `0 - onDidChangeActiveTextEditor - editorDocumentFileName: ${editorDocumentFileName}`,
  //         );
  //         void triggerUpdateDecorationsNow(editor, editorDocument, editorDocumentFileName);

  //         if (typescriptExplicitTypesSettings.blameHighlightingShowStatus) {
  //           try {
  //             const subject = await getCommitSubject(
  //               BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING,
  //               editorDocumentFileName,
  //             );
  //             myStatusBarItem.text = `${BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING}: ${subject}`;
  //             myStatusBarItem.show();
  //           } catch (error: unknown) {
  //             myStatusBarItem.hide();
  //             outputChannel!.error(`getCommitSubject for ${editorDocumentFileName} failed:`, error);
  //             outputChannel!.show();
  //           }
  //         }
  //       }
  //     }
  //   }),
  // );

  // subscriptions.push(
  //   workspace.onDidSaveTextDocument((event: TextDocument) => {
  //     if (event.uri.scheme === 'file') {
  //       const eventFileName = event.fileName;
  //       for (const visibleEditor of window.visibleTextEditors) {
  //         const visibleEditorDocument = visibleEditor.document;
  //         const visibleEditorDocumentFileName = visibleEditorDocument.fileName;
  //         outputChannel!.debug(
  //           `0 - onDidSaveTextDocument - visibleEditorDocumentFileName: ${visibleEditorDocumentFileName}`,
  //         );
  //         if (eventFileName == visibleEditorDocumentFileName) {
  //           outputChannel!.debug(
  //             `1 - onDidSaveTextDocument - visibleEditorDocumentFileName: ${visibleEditorDocumentFileName}`,
  //           );
  //           triggerUpdateDecorationsDebounce(
  //             visibleEditor,
  //             visibleEditorDocument,
  //             visibleEditorDocumentFileName,
  //           );
  //         }
  //       }
  //     }
  //   }),
  // );

  const client: LanguageClientCustom | undefined = await startLSP(subscriptions);
  if (client) {
    await Promise.all(
      window.visibleTextEditors.map((editor) => {
        outputChannel!.info(`onDidOpenTextDocument: ${editor.document.fileName}`);
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      for (const visibleEditor of window.visibleTextEditors) {
        const visibleEditorDocument = visibleEditor.document;
        if (visibleEditorDocument.uri.scheme === 'file') {
          const visibleEditorDocumentFileName = visibleEditorDocument.fileName;
          outputChannel!.debug(
            `Calling triggerUpdateDecorationsNow for visibleEditorDocumentFileName: ${visibleEditorDocumentFileName}`,
          );
          //     // void triggerUpdateDecorationsNow(
          //     //   visibleEditor,
          //     //   visibleEditorDocument,
          //     //   visibleEditorDocumentFileName,
          //     // );

          //     const response = await client.sendRequest(didOpenTextDocumentCustomRequestType, {
          //       rev: 'HEAD~1',
          //       textDocument: {
          //         uri: visibleEditorDocumentFileName,
          //         languageId: visibleEditorDocument.languageId,
          //       },
          //     });
          //     if (!visibleEditorDocument.isClosed) {
          //       updateDecorations2(visibleEditor, visibleEditorDocumentFileName, response.ranges);
          //     }
        }
      }

      // subscriptions.push(
      //   workspace.onDidOpenTextDocument(async (event: TextDocument) => {
      //     if (event.uri.scheme === 'file') {
      //       const eventFileName = event.fileName;
      //       outputChannel!.debug(`0 - onDidOpenTextDocument - eventFileName: ${eventFileName}`);
      //       const response = await client.sendRequest(didOpenTextDocumentCustomRequestType, {
      //         rev: 'HEAD~1',
      //         textDocument: {
      //           uri: eventFileName,
      //           languageId: event.languageId,
      //         },
      //       });
      //       // if (!event.isClosed) {
      //       //   updateDecorations2(visibleEditor, visibleEditorDocumentFileName, response.ranges);
      //       // }

      //       // const result = await client.sendRequest(didOpenTextDocumentCustomRequestType, {
      //       //   rev: 'HEAD~1',
      //       //   textDocument: {
      //       //     uri: eventFileName,
      //       //     languageId: event.languageId,
      //       //   },
      //       // });

      //       let serializedRanges = '[';
      //       for (const range of response.ranges) {
      //         serializedRanges += `{"start":{"line":${range.start.line},"character":${range.start.character}},"end":{"line":${range.end.line},"character":${range.end.character}}},`;
      //       }
      //       serializedRanges += ']';
      //       outputChannel!.info(`onDidOpenTextDocument: ${serializedRanges}`);
      //     }
      //   }),
      // );
    }, 4000);

    // setTimeout(() => {
    //   enableGitExtensionFunctionality(subscriptions);
    // }, 4000);

    outputChannel.appendLine('Extension activated.'); // Initial activation log
    // window.showInformationMessage('Hello World from Your Extension!', {
    // });
  }
}

export function deactivate() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  // repositoryStateListeners.forEach((disposable: Disposable) => disposable.dispose());
  // repositoryStateListeners.clear();

  if (outputChannel) {
    outputChannel.appendLine('Extension deactivated.'); // Clean up logs
    outputChannel.dispose(); // Dispose to free resources
  }
}

function getAllTypescriptExplicitTypesSetting() {
  typescriptExplicitTypesSettings = workspace.getConfiguration('typescriptExplicitTypes');
  BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING = `HEAD~${typescriptExplicitTypesSettings.get<number>(
    'blameHighlightingParentLevel',
    1,
  )}`;
  outputChannel!.info(
    `typescriptExplicitTypesSettings: ${inspect(typescriptExplicitTypesSettings, { depth: null, colors: false })}`,
  );
}

function enableGitExtensionFunctionality(subscriptions: Disposable[]) {
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
      // Also add to subscriptions for automatic cleanup on extension deactivation
      subscriptions.push(stateChangeListener);
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
    subscriptions.push(openRepoListener); // Add listener disposable to context

    // 3. Unsubscribe when repositories are closed
    const closeRepoListener = gitApi.onDidCloseRepository(unsubscribeFromRepositoryState);
    subscriptions.push(closeRepoListener); // Add listener disposable to context

    outputChannel!.info('Successfully subscribed to Git repository state changes.');
  } catch (error) {
    outputChannel!.error('Error activating extension or interacting with Git API:', error);
  }
}
