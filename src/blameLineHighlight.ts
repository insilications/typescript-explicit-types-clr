/* eslint-disable @typescript-eslint/array-type */
import { window, Range } from 'vscode';
import type { TextEditor, Uri } from 'vscode';
// import type { API as GitAPI, Repository } from './types/git';
import { outputChannel, textEditorHighlightStyles } from './extension';
import { spawn } from 'child_process';
import { dirname } from 'path';
// import { Writable } from 'stream'; // For typing stderr stream

const BINARY_NAME = 'git'; // Or provide an absolute path

let debounceTimer: NodeJS.Timeout | undefined;
const debounceTimeMs = 300; // Adjust as needed

// Interface for the expected JSON structure
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

// Function to run the binary and parse output
async function getRangesFromBinary(filePath: string): Promise<Range[]> {
  return new Promise((resolve, reject) => {
    const command = BINARY_NAME; // Use RUST_BINARY_PATH if using an absolute path
    // const args = ['--file', filePath]; // Adjust arguments based on your binary's needs
    // const args = ['difftool', 'HEAD~1', '--']; // Adjust arguments based on your binary's needs
    // const args = ['difftool', 'HEAD~1']; // Adjust arguments based on your binary's needs
    const args = ['difftool', 'HEAD~1', '--', filePath]; // Adjust arguments based on your binary's needs

    let stdoutData = '';
    let stderrData = '';

    // Using spawn for better performance and stream handling
    const process = spawn(command, args, {
      // const process = cp.spawn(command, {
      // Prevent a shell window from popping up on Windows
      windowsHide: true,
      // If your binary needs a specific working directory (e.g., repo root),
      // you might need to determine it first and set the `cwd` option.
      cwd: dirname(filePath), // Example: run in file's directory
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
        outputChannel!.debug(`Raw output for ${filePath}:`, stdoutData); // Log raw output for debugging
        reject(new Error(`Failed to parse JSON output: ${parseError.message}`));
      }
    });
  });
}

export async function updateDecorations(editor: TextEditor, documentUri: Uri) {
  const filePath = documentUri.fsPath;
  outputChannel!.appendLine(`0 - updateDecorations - filePath: ${filePath}`);

  // Clear existing decorations before starting
  editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);

  try {
    const ranges = await getRangesFromBinary(filePath);
    if (ranges.length > 0) {
      editor.setDecorations(textEditorHighlightStyles.latestHighlight, ranges);
    }
  } catch (error: any) {
    outputChannel!.error(`Highlighting failed for ${filePath}:`, error); // Log errors
    outputChannel!.show(); // Optionally show the channel on error
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
  }
}

export async function triggerUpdateDecorationsNow(editor: TextEditor) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  // if (!editor) {
  //   return;
  // }

  const documentUri = editor.document.uri;
  // Only run if the document is file-based and not untitled etc.
  if (documentUri.scheme !== 'file') {
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []); // Clear if not a file
    return;
  }

  await updateDecorations(editor, documentUri);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  // debounceTimer = setTimeout(async () => {
  //   await updateDecorations(editor);
  //   debounceTimer = undefined;
  // }, debounceTimeMs);
}
