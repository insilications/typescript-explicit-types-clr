/* eslint-disable @typescript-eslint/array-type */
import { OverviewRulerLane, window, Range } from 'vscode';
import type { TextEditor } from 'vscode';
// import type { API as GitAPI, Repository } from './types/git';
// import { outputChannel } from './extension';
import * as cp from 'child_process';
import * as path from 'path';
// import { Writable } from 'stream'; // For typing stderr stream

const RUST_BINARY_NAME = 'git'; // Or provide an absolute path

let debounceTimer: NodeJS.Timeout | undefined;
const debounceTimeMs = 300; // Adjust as needed

const latestCommitHighlightDecorationType = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0, 255, 21, 0.2)',
  // isWholeLine: true,
  overviewRulerLane: OverviewRulerLane.Left,
  overviewRulerColor: 'rgba(43, 255, 0, 1)',
});

// --- Interface for the expected JSON structure ---
interface RustDiffOutput {
  chunks: Array<
    {
      rhs: {
        line_number: number;
        changes: Array<{
          start: number;
          end: number;
        }>;
      };
    }[]
  >;
  // Include other fields if needed, e.g., language, path, status
}

// --- Function to run the binary and parse output ---
async function getRangesFromBinary(filePath: string): Promise<Range[]> {
  return new Promise((resolve, reject) => {
    const command = RUST_BINARY_NAME; // Use RUST_BINARY_PATH if using an absolute path
    // const args = ['--file', filePath]; // Adjust arguments based on your binary's needs
    const args = ['difftool']; // Adjust arguments based on your binary's needs

    let stdoutData = '';
    let stderrData = '';

    // Using spawn for better performance and stream handling
    const process = cp.spawn(command, args, {
      // const process = cp.spawn(command, {
      // Prevent a shell window from popping up on Windows
      windowsHide: true,
      // If your binary needs a specific working directory (e.g., repo root),
      // you might need to determine it first and set the `cwd` option.
      cwd: path.dirname(filePath), // Example: run in file's directory
    });

    process.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    process.on('error', (err) => {
      // Handle errors like binary not found (ENOENT)
      reject(new Error(`Failed to start binary '${command}': ${err.message}`));
    });

    process.on('close', (code) => {
      if (stderrData) {
        console.warn(`Stderr from ${command} for ${filePath}:\n${stderrData}`);
      }

      if (code !== 0) {
        // Binary exited with an error code
        const errorMessage = stderrData || `Binary exited with code ${code}`;
        // return reject(new Error(errorMessage));
        reject(new Error(errorMessage));
        return;
      }

      // Process finished successfully, try parsing JSON
      try {
        if (!stdoutData.trim()) {
          // Handle cases where the binary might output nothing on success
          // (e.g., file not tracked, no changes in last commit)
          console.log(`No output from ${command} for ${filePath}. Assuming no changes.`);
          // return resolve([]);
          resolve([]);
          return;
        }

        const outputJson = JSON.parse(stdoutData) as RustDiffOutput;
        const ranges: Range[] = [];

        // --- JSON Parsing and Range Mapping ---
        if (outputJson.chunks) {
          for (const hunk of outputJson.chunks) {
            for (const lineChange of hunk) {
              if (lineChange.rhs && lineChange.rhs.changes) {
                const lineNumber = lineChange.rhs.line_number; // 1-based
                for (const change of lineChange.rhs.changes) {
                  const startCol = change.start; // 1-based
                  const endCol = change.end; // 1-based, inclusive

                  // Convert to 0-based for VS Code Range
                  // Line number: lineNumber - 1
                  // Start char: startCol - 1
                  // End char: endCol (since VS Code end is exclusive, and our endCol is inclusive, using endCol directly works)
                  if (lineNumber > 0 && startCol > 0 && endCol >= startCol) {
                    const range = new Range(
                      lineNumber,
                      startCol,
                      lineNumber,
                      endCol, // Use endCol directly as VS Code end is exclusive
                    );
                    ranges.push(range);
                  } else {
                    console.warn(
                      `Invalid range data received: Line ${lineNumber}, Start ${startCol}, End ${endCol}`,
                    );
                  }
                }
              }
            }
          }
        }

        resolve(ranges);
      } catch (parseError: any) {
        console.error('Raw output:', stdoutData); // Log raw output for debugging
        reject(new Error(`Failed to parse JSON output: ${parseError.message}`));
      }
    });
  });
}

export async function updateDecorations(editor: TextEditor) {
  const docUri = editor.document.uri;
  const filePath = docUri.fsPath;

  // Clear existing decorations before starting
  editor.setDecorations(latestCommitHighlightDecorationType, []);

  try {
    const ranges = await getRangesFromBinary(filePath);
    if (ranges.length > 0) {
      editor.setDecorations(latestCommitHighlightDecorationType, ranges);
    }
  } catch (error: any) {
    console.error(`Error running ${RUST_BINARY_NAME} for ${filePath}:`, error);
    // Optionally show a subtle error to the user, but avoid being noisy
    // vscode.window.showWarningMessage(`Highlighting failed: ${error.message}`);
    // Ensure decorations are cleared on error
    editor.setDecorations(latestCommitHighlightDecorationType, []);
  }
}

export function triggerUpdateDecorations(editor: TextEditor | undefined = window.activeTextEditor) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (!editor) {
    return;
  }
  // Only run if the document is file-based and not untitled etc.
  if (editor.document.uri.scheme !== 'file') {
    editor.setDecorations(latestCommitHighlightDecorationType, []); // Clear if not a file
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  debounceTimer = setTimeout(async () => {
    await updateDecorations(editor);
    debounceTimer = undefined;
  }, debounceTimeMs);
}

// export async function updateDecorations(editor: TextEditor, gitApi: GitAPI) {
// export async function updateDecorations(editor: TextEditor) {
//   const docUri = editor.document.uri;
//   if (docUri.scheme !== 'file') {
//     // Only apply to file system documents
//     editor.setDecorations(latestCommitHighlightDecorationType, []); // Clear decorations
//     return;
//   }

//   const repo: Repository | null = gitApi.getRepository(docUri);
//   if (!repo) {
//     // Not in a Git repository
//     editor.setDecorations(latestCommitHighlightDecorationType, []); // Clear decorations
//     return;
//   }

//   try {
//     const currentFilePath = docUri.fsPath;
//     outputChannel!.appendLine(`1 - updateDecorations - currentFilePath: ${currentFilePath}`);
//     // Need the file path relative to the repository root
//     const repoRoot = repo.rootUri.fsPath;
//     outputChannel!.appendLine(`2 - updateDecorations - repoRoot: ${repoRoot}`);
//     const relativePath = currentFilePath.substring(repoRoot.length + 1).replace(/\\/g, '/'); // Normalize path separators
//     outputChannel!.appendLine(`3 - updateDecorations - relativePath: ${relativePath}`);

//     //     2025-04-16 11:00:50.885 [info] 1 - updateDecorations - currentFilePath: /aot/stuff/dev/public/LibreChat/client/src/hooks/SSE/useEventHandlers.ts
//     // 2025-04-16 11:00:50.885 [info] 2 - updateDecorations - repoRoot: /aot/stuff/dev/public/LibreChat
//     // 2025-04-16 11:00:50.885 [info] 3 - updateDecorations - relativePath: client/src/hooks/SSE/useEventHandlers.ts

//     // 1. Get HEAD commit
//     const headCommit = await repo.getCommit('HEAD');
//     if (!headCommit || !headCommit.parents?.length) {
//       // No HEAD or no parent commit (e.g., initial commit)
//       editor.setDecorations(latestCommitHighlightDecorationType, []);
//       return;
//     }
//     const parentCommitSha = headCommit.parents[0]; // Assuming first parent

//     // 2. Get the diff between HEAD and its parent for this file
//     // The API provides `repo.diffBetween()`
//     const diffOutput = await repo.diffBetween(parentCommitSha, 'HEAD', relativePath);
//     outputChannel!.appendLine(`4 - updateDecorations - diffOutput: ${diffOutput}`);

//     // 3. Parse the diff to find changed lines
//     const changedRanges: Range[] = [];
//     // The diffOutput format might vary slightly based on API version/implementation details.
//     // Typically, it provides hunk information. You need to parse this to map
//     // line numbers in the *current* file (HEAD version) that were changed.
//     // Example parsing logic (needs refinement based on actual diff format):
//     const diffLines: string[] = diffOutput.split('\n');
//     let currentLineNumber = -1; // Line number in the *new* file (HEAD)

//     for (const line of diffLines) {
//       if (line.startsWith('@@')) {
//         // Example: @@ -15,7 +15,9 @@
//         const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
//         if (match && match[1]) {
//           // Start line number in the *new* file (HEAD). Adjust because it's 1-based.
//           currentLineNumber = parseInt(match[1], 10) - 1;
//         } else {
//           currentLineNumber = -1; // Reset if hunk header is malformed
//         }
//       } else if (currentLineNumber !== -1) {
//         if (line.startsWith('+') && !line.startsWith('+++')) {
//           // Line added in HEAD
//           const range = new Range(currentLineNumber, 0, currentLineNumber, 0); // Highlight whole line
//           changedRanges.push(range);
//           currentLineNumber++; // Increment line number for added lines
//         } else if (line.startsWith('-') && !line.startsWith('---')) {
//           // Line removed in HEAD - doesn't correspond to a line *in* HEAD, so ignore for highlighting
//           // Do NOT increment currentLineNumber here
//         } else if (line.startsWith(' ')) {
//           // Context line, present in both
//           currentLineNumber++; // Increment line number for context/unchanged lines
//         }
//         // Handle edge cases like no newline at end of file if necessary
//       }
//     }

//     // 4. Apply decorations
//     editor.setDecorations(latestCommitHighlightDecorationType, changedRanges);
//   } catch (error) {
//     outputChannel!.error('Error getting git diff for decorations:', error); // Log errors
//     outputChannel!.show(); // Optionally show the channel on error
//     // Clear decorations on error
//     editor.setDecorations(latestCommitHighlightDecorationType, []);
//   }
// }
