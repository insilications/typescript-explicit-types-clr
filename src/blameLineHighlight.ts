import {
  commands,
  DocumentFilter,
  ExtensionContext,
  languages,
  extensions,
  window,
  Range,
} from 'vscode';
import type { TextEditor } from 'vscode';
import type { GitExtension, API as GitAPI, Repository, Git } from './types/git';

const latestCommitHighlightDecorationType = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0, 255, 21, 0.3)', // Example: semi-transparent yellow
  isWholeLine: true,
  // You can add gutter icons, overview ruler colors etc.
  // overviewRulerColor: 'yellow',
  // overviewRulerLane: vscode.OverviewRulerLane.Left,
});

export async function updateDecorations(editor: TextEditor, gitApi: GitAPI) {
  const docUri = editor.document.uri;
  if (docUri.scheme !== 'file') {
    // Only apply to file system documents
    editor.setDecorations(latestCommitHighlightDecorationType, []); // Clear decorations
    return;
  }

  const repo = gitApi.getRepository(docUri);
  if (!repo) {
    // Not in a Git repository
    editor.setDecorations(latestCommitHighlightDecorationType, []); // Clear decorations
    return;
  }

  try {
    const currentFilePath = docUri.fsPath;
    // Need the file path relative to the repository root
    const repoRoot = repo.rootUri.fsPath;
    const relativePath = currentFilePath.substring(repoRoot.length + 1).replace(/\\/g, '/'); // Normalize path separators

    // 1. Get HEAD commit
    const headCommit = await repo.getCommit('HEAD');
    if (!headCommit || !headCommit.parents?.length) {
      // No HEAD or no parent commit (e.g., initial commit)
      editor.setDecorations(latestCommitHighlightDecorationType, []);
      return;
    }
    const parentCommitSha = headCommit.parents[0]; // Assuming first parent

    // 2. Get the diff between HEAD and its parent for this file
    // The API provides `repo.diffBetween()`
    const diffOutput = await repo.diffBetween(parentCommitSha, 'HEAD', relativePath);

    // 3. Parse the diff to find changed lines
    const changedRanges: Range[] = [];
    // The diffOutput format might vary slightly based on API version/implementation details.
    // Typically, it provides hunk information. You need to parse this to map
    // line numbers in the *current* file (HEAD version) that were changed.
    // Example parsing logic (needs refinement based on actual diff format):
    const diffLines = diffOutput.split('\n');
    let currentLineNumber = -1; // Line number in the *new* file (HEAD)

    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        // Example: @@ -15,7 +15,9 @@
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match && match[1]) {
          // Start line number in the *new* file (HEAD). Adjust because it's 1-based.
          currentLineNumber = parseInt(match[1], 10) - 1;
        } else {
          currentLineNumber = -1; // Reset if hunk header is malformed
        }
      } else if (currentLineNumber !== -1) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // Line added in HEAD
          const range = new Range(currentLineNumber, 0, currentLineNumber, 0); // Highlight whole line
          changedRanges.push(range);
          currentLineNumber++; // Increment line number for added lines
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          // Line removed in HEAD - doesn't correspond to a line *in* HEAD, so ignore for highlighting
          // Do NOT increment currentLineNumber here
        } else if (line.startsWith(' ')) {
          // Context line, present in both
          currentLineNumber++; // Increment line number for context/unchanged lines
        }
        // Handle edge cases like no newline at end of file if necessary
      }
    }

    // 4. Apply decorations
    editor.setDecorations(latestCommitHighlightDecorationType, changedRanges);
  } catch (error) {
    console.error('Error getting git diff for decorations:', error);
    // Clear decorations on error
    editor.setDecorations(latestCommitHighlightDecorationType, []);
  }
}
