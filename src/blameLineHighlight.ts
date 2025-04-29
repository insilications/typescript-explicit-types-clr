import { Range } from 'vscode';
import type { TextEditor, TextDocument } from 'vscode';
import {
  outputChannel,
  textEditorHighlightStyles,
  BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING,
} from './extension';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import type { DifftasticJsonOutput, EditorCacheData } from './types/types';

const GIT_BINARY_NAME = 'git';
const GIT_DIFFTOOL_ARGS: string[] = [
  'difftool',
  '-y',
  '-x difft --context=0 --display=json2 --parse-error-limit=10 --graph-limit=9999999',
];

const textEditorCache = new WeakMap<TextEditor, EditorCacheData>();
const debounceTimersPerFileCache = new Map<string, NodeJS.Timeout>();
const triggerUpdateDecorationsDebounceTimeMs = 3000; // Adjust as needed

const dirNameForFileNameCache = new Map<string, string>();
const commitSubjectCache = new Map<string, string>();

// git rev-list -1 HEAD~1 -- client/src/hooks/SSE/useSSE.ts
async function getCommitHashIdFromRevSpec(revSpec: string, fileName: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let cachedDirname: string | undefined = dirNameForFileNameCache.get(fileName);
    if (cachedDirname == undefined) {
      cachedDirname = dirname(fileName);
      dirNameForFileNameCache.set(fileName, cachedDirname);
    }

    const proc = spawn(GIT_BINARY_NAME, ['rev-list', '-1', revSpec, '--', fileName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: cachedDirname,
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => (stdoutData += chunk));
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => (stderrData += chunk));

    proc.once('error', reject);
    proc.once('close', (code) => {
      if (code === 0) {
        resolve(stdoutData.trimEnd()); // strip trailing newline
      } else {
        reject(new Error(`git exited with code ${code}: ${stderrData.trimEnd()}`));
      }
    });
  });
}

/**
 * Gets the subject line of a revision spec that touches a given filesystem path.
 * Runs: git log -1 --format=%s <revSpec> -- <fileName>
 *
 * @param revSpec Revision specifier (i.e. HEAD~1)
 * @param fileName Filesystem path of the file to check
 */
export async function getCommitSubject(revSpec: string, fileName: string): Promise<string> {
  let cacheKey = '';

  try {
    const commitHashId = await getCommitHashIdFromRevSpec(revSpec, fileName);
    cacheKey = `${commitHashId}␟${fileName}`; // ␟ = unlikely in paths/SHAs
    const cachedCommitSubject = commitSubjectCache.get(cacheKey);
    if (cachedCommitSubject !== undefined) {
      return cachedCommitSubject;
    }
  } catch (error: unknown) {
    outputChannel!.error(`getCommitHashIdFromRevSpec for ${fileName} failed:`, error); // Log errors
    outputChannel!.show();
  }

  return new Promise<string>((resolve, reject) => {
    let cachedDirname: string | undefined = dirNameForFileNameCache.get(fileName);
    if (cachedDirname == undefined) {
      cachedDirname = dirname(fileName);
      dirNameForFileNameCache.set(fileName, cachedDirname);
    }

    const proc = spawn(GIT_BINARY_NAME, ['log', '-1', '--format=%s', revSpec, '--', fileName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: cachedDirname,
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => (stdoutData += chunk));
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => (stderrData += chunk));

    proc.once('error', reject);
    proc.once('close', (code) => {
      if (code === 0) {
        const subject = stdoutData.trimEnd(); // strip trailing newline
        commitSubjectCache.set(cacheKey, subject);
        resolve(subject);
      } else {
        reject(new Error(`git exited with code ${code}: ${stderrData.trimEnd()}`));
      }
    });
  });
}

// Function to run the binary and parse output
async function getRangesFromBinary(fileName: string): Promise<Range[]> {
  return new Promise((resolve, reject) => {
    let cachedDirname: string | undefined = dirNameForFileNameCache.get(fileName);
    if (cachedDirname == undefined) {
      cachedDirname = dirname(fileName);
      dirNameForFileNameCache.set(fileName, cachedDirname);
    }

    // Using spawn for better performance and stream handling
    const proc = spawn(
      GIT_BINARY_NAME,
      [...GIT_DIFFTOOL_ARGS, BLAME_HIGHLIGHTING_PARENT_LEVEL_STRING, '--', fileName],
      {
        // Prevent a shell window from popping up on Windows
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: cachedDirname,
      },
    );

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (data: Buffer | string) => {
      stdoutData += data.toString();
    });
    proc.stderr.on('data', (data: Buffer | string) => {
      stderrData += data.toString();
    });

    proc.on('error', (err) => {
      // Handle errors like binary not found (ENOENT)
      reject(new Error(`Failed to start '${GIT_BINARY_NAME}': ${err.message}`));
    });
    proc.on('close', (code) => {
      if (stderrData) {
        outputChannel!.warn(`Stderr from '${GIT_BINARY_NAME}' for ${fileName}:\n${stderrData}`);
      }

      if (code !== 0) {
        // Binary exited with an error code
        reject(new Error(stderrData || `Binary '${GIT_BINARY_NAME}' exited with code ${code}`));
        return;
      }

      // Process finished successfully, try parsing JSON
      try {
        if (!stdoutData.trim()) {
          // Handle cases where the binary might output nothing on success
          // (e.g., filePath not tracked, no changes in last commit)
          outputChannel!.debug(
            `No output from '${GIT_BINARY_NAME}' for ${fileName}. Assuming no changes.`,
          );
          resolve([]);
          return;
        }

        const outputJson = JSON.parse(stdoutData) as DifftasticJsonOutput;
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
        outputChannel!.debug(`Raw output for ${fileName}:`, stdoutData); // Log raw output for debugging
        if (parseError instanceof Error) {
          reject(new Error(`Failed to parse JSON output: ${parseError.message}`));
        } else {
          reject(new Error('Failed to parse JSON output: Unknown error'));
        }
      }
    });
  });
}

export async function updateDecorations(editor: TextEditor, fileName: string) {
  // Clear existing decorations before starting
  // editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
  // outputChannel!.debug(
  //   `0 - updateDecorations - Cleared existing decorations - fileName: ${fileName}`,
  // );

  try {
    const ranges: Range[] = await getRangesFromBinary(fileName);

    let serializedRanges = '[';
    for (const range of ranges) {
      serializedRanges += `{"start":{"line":${range.start.line},"character":${range.start.character}},"end":{"line":${range.end.line},"character":${range.end.character}}},`;
    }
    serializedRanges += ']';
    outputChannel!.info(`updateDecorations: ${serializedRanges}`);

    if (ranges.length > 0) {
      editor.setDecorations(textEditorHighlightStyles.latestHighlight, ranges);
      outputChannel!.debug(`Decorations set for fileName: ${fileName}`);
    }
  } catch (error: unknown) {
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
    outputChannel!.error(`setDecorations failed for ${fileName}:`, error); // Log errors
    outputChannel!.show();
  }
}

export function updateDecorations2(editor: TextEditor, fileName: string, ranges: Range[]) {
  // Clear existing decorations before starting
  // editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
  // outputChannel!.debug(
  //   `0 - updateDecorations2 - Cleared existing decorations - fileName: ${fileName}`,
  // );

  try {
    if (ranges.length > 0) {
      editor.setDecorations(textEditorHighlightStyles.latestHighlight, ranges);
      outputChannel!.debug(`0 - updateDecorations2 - Decorations set for fileName: ${fileName}`);
    }
  } catch (error: unknown) {
    editor.setDecorations(textEditorHighlightStyles.latestHighlight, []);
    outputChannel!.error(`1 - updateDecorations2 - setDecorations failed for ${fileName}:`, error); // Log errors
    outputChannel!.show();
  }
}

export async function triggerUpdateDecorationsNow(
  editor: TextEditor,
  editorDocument: TextDocument,
  fileName: string,
) {
  if (!editorDocument.isClosed) {
    outputChannel!.debug(`0 - triggerUpdateDecorationsNow - fileName: ${fileName}`);
    await updateDecorations(editor, fileName);
  }
}

export function triggerUpdateDecorationsDebounce(
  editor: TextEditor,
  editorDocument: TextDocument,
  editorDocumentFileName: string,
): void {
  // Clear any existing timer for this specific editor
  const editorCacheData = textEditorCache.get(editor);
  if (editorCacheData) {
    clearTimeout(editorCacheData.debounceTimer);
    textEditorCache.delete(editor);
    outputChannel!.debug(`Skipping update for ${editorDocumentFileName} - debounce active`);
  }

  const debounceTimer = setTimeout(() => {
    debounceTimersPerFileCache.delete(editorDocumentFileName);

    // Check if editor is still valid before updating
    if (!editorDocument.isClosed) {
      if (outputChannel) {
        outputChannel.debug(
          `0 - triggerUpdateDecorationsDebounce - fileName: ${editorDocumentFileName}`,
        );
      }
      void updateDecorations(editor, editorDocumentFileName);
    }
  }, triggerUpdateDecorationsDebounceTimeMs);

  // Set new timer with minimal object creation
  textEditorCache.set(editor, { debounceTimer });
}
