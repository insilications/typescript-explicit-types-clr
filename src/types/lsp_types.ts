import { RequestType } from 'vscode-languageserver-protocol';
// import type { Range } from 'vscode-languageclient/node';
import type { Range } from 'vscode';

export const didOpenTextDocumentCustomRequestType = new RequestType<
  DidOpenTextDocumentCustomRequestParams,
  DidOpenTextDocumentCustomRequestResponse,
  void
>('textDocument/didOpenCustom');

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
