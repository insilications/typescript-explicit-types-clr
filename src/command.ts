import {
  commands,
  Position,
  Range,
  TextEdit,
  Selection,
  TextEditor,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";
import { findMatchIndexes } from "./helpers/findMatches";
import { configurationId } from "./configuration";

export interface GenerateTypeInfo {
  typescriptHoverResult: string;
  typePosition: Position;
  isFunction?: boolean;
}

function executeFormatDocumentProvider(uri: Uri) {
  return commands.executeCommand<TextEdit[]>(
    "vscode.executeFormatDocumentProvider",
    uri,
  );
}

const generateType = async (
  { typescriptHoverResult, typePosition, isFunction }: GenerateTypeInfo,
  editor: TextEditor,
  isAutoFormatOn?: boolean,
) => {
  const indexes = findMatchIndexes(/:/gm, typescriptHoverResult);
  const dirtyType = typescriptHoverResult.slice(
    isFunction ? indexes.slice(-1)[0] : indexes[0],
  );
  const cleanType = dirtyType.replace(/(`)/gm, "").replace(/\n+$/, "");
  await editor.edit((editor) => editor.insert(typePosition, cleanType));

  if (!isAutoFormatOn) return;

  const document = editor.document;
  const text = document.getText();
  const typeIndex = text.indexOf(
    cleanType.replace(/\n/gm, "\r\n"),
    document.offsetAt(typePosition),
  );
  if (typeIndex < 0) return;

  const typePositionStart = document.positionAt(typeIndex);
  const typePositionEnd = document.positionAt(
    typeIndex + cleanType.length + (cleanType.match(/\n/gm)?.length ?? 0),
  );
  const typeRange = new Range(typePositionStart, typePositionEnd);
  if (!typeRange) return;

  if (isAutoFormatOn) {
    const edits = await executeFormatDocumentProvider(document.uri);
    if (!edits) return;
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(document.uri, edits);
    await workspace.applyEdit(workspaceEdit);
  }
};

export const commandId = "extension.generateExplicitType";
export const commandHandler = async (
  generateTypeInfos: GenerateTypeInfo[],
  autoImport = false,
) => {
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  await generateType(generateTypeInfos[0], editor, autoImport);
};

export const toogleQuotesCommandId = "extension.toggleQuotes";

export interface Quotes {
  begin: string;
  end: string;
}

// look at: https://github.com/dbankier/vscode-quick-select/blob/master/src/extension.ts
export function toggleQuotes() {
  const editor: TextEditor | undefined = window.activeTextEditor;
  if (!editor) {
    return;
  }
  const doc = editor.document;

  let chars = [];

  try {
    chars = getChars(editor);
  } catch (e) {
    window.showErrorMessage((e as Error).message);
    return;
  }

  const changes: { char: string; selection: Selection }[] = [];

  for (const sel of editor.selections) {
    // console.log(
    //   `toggleQuotes - sel.start.line: ${sel.start.line} - sel.start.character: ${sel.start.character}`,
    // );
    // console.log(
    //   `toggleQuotes - sel.end.line: ${sel.end.line} - sel.end.character: ${sel.end.character}`,
    // );
    // console.log(
    //   `toggleQuotes - sel.anchor.line: ${sel.anchor.line} - sel.anchor.character: ${sel.anchor.character}`,
    // );
    // console.log(
    //   `toggleQuotes - sel.active.line: ${sel.active.line} - sel.active.character: ${sel.active.character}`,
    // );
    const contentSelRange = new Range(sel.start, sel.end);
    if (contentSelRange) {
      const contentSel = doc.getText(contentSelRange);
      // console.log(`toggleQuotes - contentSel: ${contentSel}`);
    }

    const content = doc.lineAt(sel.start.line);
    const charInfo = findChar(chars, content.text, sel);

    // console.log(`toggleQuotes - content.text: ${content.text}`);

    if (charInfo) {
      const foundCharIdx = chars.indexOf(charInfo.foundQuotes);
      const nextChar = chars[(foundCharIdx + 1) % chars.length];
      // console.log(`found ${charInfo.start} - ${charInfo.end} will change to : ${nextChar}`);

      const first = new Position(sel.start.line, charInfo.start);
      const firstSelection = new Selection(
        first,
        new Position(first.line, first.character + 1),
      );
      changes.push({ char: nextChar.begin, selection: firstSelection });

      const second = new Position(sel.start.line, charInfo.end);
      const secondSelection = new Selection(
        second,
        new Position(second.line, second.character + 1),
      );
      changes.push({ char: nextChar.end, selection: secondSelection });
    }

    // for (const sel of newSelections){
    // 	editor
    // }
  }

  editor.edit((edit) => {
    for (const change of changes) {
      edit.replace(change.selection, change.char);
    }
  });
}

/** Find the .start and .end of a char (from the chars list) or null if any side is not found */
function findChar(
  chars: Quotes[],
  txt: string,
  sel: Selection,
): { start: number; end: number; foundQuotes: Quotes } | null {
  let start: number = -1;
  let end: number = -1;

  let foundQuotes: Quotes | null | undefined = null;

  // find the index of next char from end selection
  for (let i = sel.end.character; i < txt.length; i++) {
    const c = txt[i];
    const beforeC = i > 0 ? txt[i - 1] : null; // the previous character (to see if it is '\')
    if (beforeC !== "\\") {
      foundQuotes = chars.find((quotes) => quotes.end === c);
      if (foundQuotes) {
        end = i;
        break;
      }
    }
  }

  // find the index of previous char (note at this point we should have the found char)
  for (let i = sel.start.character - 1; i > -1; i--) {
    const c = txt[i];
    const beforeC = i > 0 ? txt[i - 1] : null; // the previous character (to see if it is '\')
    if (beforeC !== "\\") {
      if (foundQuotes?.begin === c) {
        start = i;
        break;
      }
    }
  }

  if (foundQuotes) {
    if (start > -1 && end > -1) {
      return { start, end, foundQuotes };
    }
    // else {
    //   return null;
    // }
  }
  return null;
}

export type ToggleQuotesConfigurationChars = (
  | string
  | [string, string]
  | Quotes
)[];

export interface ToggleQuotesConfiguration {
  chars: ToggleQuotesConfigurationChars;
  // "chars": string[] | Quotes | [string, string];
}

function getChars(editor: TextEditor): Quotes[] {
  const maybeChars = workspace
    .getConfiguration(configurationId, editor.document)
    .get<ToggleQuotesConfiguration>("togglequotes")?.chars;
  // .get<ToggleQuotesConfiguration>("togglequotes").get("chars");
  const chars = Array.isArray(maybeChars) ? maybeChars : [];

  // Transform properties to begin/end pair
  chars.forEach((char: any, i: number, chars: any[]) => {
    if (typeof char === "string") {
      chars[i] = { begin: char, end: char };
    } else if (typeof char === "object") {
      if (Array.isArray(char)) {
        if (char.length !== 2 || !char.every((c) => typeof c === "string")) {
          throw Error(
            'Wrong typescriptExplicitTypes.togglequotes.chars array quotes pair format. Use ["<", ">"]',
          );
        }
        chars[i] = { begin: char[0], end: char[1] };
      } else if (!char.begin || !char.end) {
        throw Error(
          'Wrong typescriptExplicitTypes.togglequotes.chars object quotes pair format. Use { "begin": "<", "end": ">" } ',
        );
      }
    } else {
      throw Error(
        'Wrong typescriptExplicitTypes.togglequotes.chars value type. Use string or [string, string] or { "begin": string, "end": string }',
      );
    }
  });

  return chars as Quotes[];
}
