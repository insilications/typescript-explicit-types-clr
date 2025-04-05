import { commands, DocumentFilter, ExtensionContext, languages } from "vscode";
import { GenereateTypeProvider } from "./actionProvider";
import {
  commandHandler,
  commandId,
  toogleQuotesCommandId,
  toggleQuotes,
} from "./command";

export function activate(context: ExtensionContext) {
  const selector: DocumentFilter[] = [];
  for (const language of ["typescript", "typescriptreact", "svelte"]) {
    selector.push({ language, scheme: "file" });
    selector.push({ language, scheme: "untitled" });
  }

  const command = commands.registerCommand(commandId, commandHandler);
  const codeActionProvider = languages.registerCodeActionsProvider(
    selector,
    new GenereateTypeProvider(),
    GenereateTypeProvider.metadata,
  );

  const toggleQuotesCommand = commands.registerCommand(
    toogleQuotesCommandId,
    toggleQuotes,
  );

  context.subscriptions.push(command);
  context.subscriptions.push(codeActionProvider);
  context.subscriptions.push(toggleQuotesCommand);
}
