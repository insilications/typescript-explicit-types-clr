import { RequestType } from 'vscode-languageserver-protocol';
import type { Range } from 'vscode-languageclient/node';

export const didOpenTextDocumentCustomRequestType = new RequestType<
  DidOpenTextDocumentCustomRequestParams,
  DidOpenTextDocumentCustomRequestResponse,
  void
>('textDocument/didOpenCustom');

//   export const GetMyCustomDataRequest = new RequestType<
//   MyCustomDataParams,
//   MyCustomDataResult,
//   MyCustomErrorData, // Use void here if you don't expect specific error data
//   void
// >('myExtension/getCustomData');

export interface DidOpenTextDocumentCustomRequestItem {
  /**
   * The text document's uri.
   */
  uri: string;
  /**
   * The text document's language identifier.
   */
  languageId: string;
}

export interface DidOpenTextDocumentCustomRequestParams {
  rev: string;
  /**
   * The document that was opened.
   */
  textDocument: DidOpenTextDocumentCustomRequestItem;
}

export interface DidOpenTextDocumentCustomRequestResponse {
  ranges: Range[];
}

// export const didOpenTextDocumentCustomNotificationType =
//   new NotificationType<DidOpenTextDocumentCustomNotificationParams>('textDocument/didOpenCustom');

// export interface DidOpenTextDocumentCustomNotificationItem {
//   /**
//    * The text document's uri.
//    */
//   uri: string;
//   /**
//    * The text document's language identifier.
//    */
//   languageId: string;
// }

// export interface DidOpenTextDocumentCustomNotificationParams {
//   /**
//    * The document that was opened.
//    */
//   textDocument: DidOpenTextDocumentCustomNotificationItem;
// }

export interface EditorCacheData {
  debounceTimer: NodeJS.Timeout;
}

export const highlight = {
  novel: 'novel',
  novel_word: 'novel_word',
} as const;

export type HighlightType = (typeof highlight)[keyof typeof highlight];

export interface DifftasticJsonOutput {
  readonly chunks: Chunk[][];
  readonly language: string;
  readonly path: string;
  readonly status: string;
}

export interface Chunk {
  readonly rhs: Rhs;
}

export interface Rhs {
  readonly line_number: number;
  readonly changes: Change[];
}

export interface Change {
  readonly start: number;
  readonly end: number;
  readonly content: string;
  readonly highlight_type: HighlightType;
}

/**
 * Controls the verbosity of logging
 */
export const blameHighlightinglogLevelConst = {
  Debug: 'Debug',
  Info: 'Info',
  Warning: 'Warning',
  Error: 'Error',
  None: 'None',
} as const;

export type BlameHighlightinglogLevel =
  (typeof blameHighlightinglogLevelConst)[keyof typeof blameHighlightinglogLevelConst];

/**
 * A geographical coordinate
 */
export interface TypescriptExplicitTypesSettings {
  /**
   * Controls the verbosity of logging
   */
  blameHighlightinglogLevel?: BlameHighlightinglogLevel;
  /**
   * Controls how many levels up in the hierarchy above the HEAD (commit) the blame
   * highlighting should be applied. Same as `HEAD~n` in git.
   */
  blameHighlightingParentLevel?: number;
  /**
   * Controls whether to show the blame highlighting for the active editor in the status bar.
   */
  blameHighlightingShowStatus?: boolean;
  /**
   * Controls whether to show a toast notification when blame highlighting is changed.
   */
  blameHighlightingShowToastParentLevel?: boolean;
  /**
   * Mark type generation actions as preferable.
   */
  preferable?: boolean;
  /**
   * Run document format action after a type has been generated.
   */
  formatAfterGeneration?: boolean;
  /**
   * An array defining the quote characters or pairs to toggle between.
   */
  togglequotes?: TypesTogglequotesCharElement[];
}

export type TypesTogglequotesCharElement = string[] | TypesTogglequotesCharClass | string;

/**
 * An object explicitly defining begin and end quote strings.
 */
export interface TypesTogglequotesCharClass {
  /**
   * The beginning quote character/string.
   */
  begin: string;
  /**
   * The ending quote character/string.
   */
  end: string;
}
