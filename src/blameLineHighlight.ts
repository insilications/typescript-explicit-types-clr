import { Range } from 'vscode';
import type { TextEditor, Uri } from 'vscode';
// import type { API as GitAPI, Repository } from './types/git';
import { outputChannel, textEditorHighlightStyles } from './extension';
import { spawn } from 'child_process';
import { dirname } from 'path';
import type { JsonOutput } from './types/types';

const BINARY_NAME = 'git';
const BINARY_ARGS = [
  'difftool',
  '-y',
  '-x difft --context=0 --display=json2 --parse-error-limit=10 --graph-limit=9999999',
  'HEAD~1',
  '--',
];

const debounceTimers = new Map<string, NodeJS.Timeout>();
const debounceTimeMs = 3000; // Adjust as needed

// Function to run the binary and parse output
async function getRangesFromBinary(filePath: string): Promise<Range[]> {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';

    // Using spawn for better performance and stream handling
    const process = spawn(BINARY_NAME, [...BINARY_ARGS, filePath], {
      // Prevent a shell window from popping up on Windows
      windowsHide: true,
      cwd: dirname(filePath), // Run in `filePath` directory
    });

    process.stdout.on('data', (data: Buffer | string) => {
      stdoutData += data.toString();
    });

    process.stderr.on('data', (data: Buffer | string) => {
      stderrData += data.toString();
    });

    process.on('error', (err) => {
      // Handle errors like binary not found (ENOENT)
      reject(new Error(`Failed to start '${BINARY_NAME}': ${err.message}`));
    });

    process.on('close', (code) => {
      if (stderrData) {
        outputChannel!.warn(`Stderr from '${BINARY_NAME}' for ${filePath}:\n${stderrData}`);
      }

      if (code !== 0) {
        // Binary exited with an error code
        const errorMessage = stderrData || `Binary '${BINARY_NAME}' exited with code ${code}`;
        reject(new Error(errorMessage));
        return;
      }

      // Process finished successfully, try parsing JSON
      try {
        if (!stdoutData.trim()) {
          // Handle cases where the binary might output nothing on success
          // (e.g., file not tracked, no changes in last commit)
          outputChannel!.debug(
            `No output from '${BINARY_NAME}' for ${filePath}. Assuming no changes.`,
          );
          resolve([]);
          return;
        }

        const outputJson = JSON.parse(stdoutData) as JsonOutput;
        const ranges: Range[] = [];

        // JSON Parsing and Range Mapping
        for (const hunk of outputJson.chunks) {
          for (const lineChange of hunk) {
            const lineChangeRhs = lineChange.rhs;
            // `lineNumber` is already 0-based in the JSON output
            const lineNumber = lineChangeRhs.line_number;
            for (const change of lineChangeRhs.changes) {
              // Both `change.start` and `change.end` are already 0-based
              const range = new Range(lineNumber, change.start, lineNumber, change.end);
              ranges.push(range);
            }
          }
        }

        resolve(ranges);
      } catch (parseError: unknown) {
        outputChannel!.debug(`Raw output for ${filePath}:`, stdoutData); // Log raw output for debugging
        if (parseError instanceof Error) {
          reject(new Error(`Failed to parse JSON output: ${parseError.message}`));
        } else {
          reject(new Error('Failed to parse JSON output: Unknown error'));
        }
      }
    });
  });
}

export async function updateDecorations(editor: TextEditor, documentUri: Uri) {
  const filePath = documentUri.fsPath;
  outputChannel!.debug(`0 - updateDecorations - filePath: ${filePath}`);

  // Clear existing decorations before starting
  editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);

  try {
    const ranges = await getRangesFromBinary(filePath);
    if (ranges.length > 0) {
      editor.setDecorations(textEditorHighlightStyles.latestHighlight, ranges);
    }
  } catch (error: unknown) {
    outputChannel!.error(`Highlighting failed for ${filePath}:`, error); // Log errors
    outputChannel!.show(); // Optionally show the channel on error
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
  }
}

export async function triggerUpdateDecorationsNow(editor: TextEditor) {
  const editorDocument = editor.document;
  const documentUri = editorDocument.uri;

  // Only run if the document is file-based and not untitled etc.
  if (documentUri.scheme !== 'file') {
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []); // Clear if not a file
    return;
  }

  if (!editorDocument.isClosed) {
    await updateDecorations(editor, documentUri);
  }
}

export function triggerUpdateDecorationsDebounce(editor: TextEditor): void {
  const editorDocument = editor.document;
  const documentUri = editorDocument.uri;
  const editorId = documentUri.toString();

  // Clear any existing timer for this specific editor
  if (debounceTimers.has(editorId)) {
    outputChannel!.debug(`Skipping update for ${editorId} - debounce active`);
    clearTimeout(debounceTimers.get(editorId));
    debounceTimers.delete(editorId);
  }

  // Early exit for non-file documents
  if (documentUri.scheme !== 'file') {
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
    return;
  }

  // Set new timer
  debounceTimers.set(
    editorId,
    setTimeout(() => {
      debounceTimers.delete(editorId);
      // Check if editor is still valid before updating
      if (!editorDocument.isClosed) {
        outputChannel!.debug(`0 - triggerUpdateDecorationsDebounce - editorId: ${editorId}`);
        void updateDecorations(editor, documentUri);
      }
    }, debounceTimeMs),
  );
}
