/**
 * pi-copy-block - copy a code block out of pi's last reply.
 *
 * `/copy-block` collects every fenced code block and bash tool call from the
 * most recent assistant message. One hit goes straight to the clipboard, more
 * than one opens a picker.
 */

import {
  copyToClipboard,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const COMMAND = "copy-block";

/** Pull the body of every fenced code block out of a markdown string. */
function extractFencedBlocks(text: string): string[] {
  const fence = /```(?:\w*)?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

/** First line of `text`, ellipsized to `max` characters. */
function truncate(text: string, max: number): string {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.length > max ? `${firstLine.slice(0, max - 3)}...` : firstLine;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: "Copy a code block from the last assistant message to clipboard",
    handler: async (_args, ctx) => {
      const lastAssistant = ctx.sessionManager.getBranch().findLast(
        (e): e is Extract<typeof e, { type: "message" }> =>
          e.type === "message" && e.message.role === "assistant",
      );

      const message = lastAssistant?.message;
      const content =
        message && "content" in message ? message.content : undefined;

      const blocks: string[] = [];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (
            block.type === "toolCall" &&
            block.name.toLowerCase() === "bash" &&
            typeof block.arguments?.command === "string"
          ) {
            blocks.push(block.arguments.command);
          } else if (block.type === "text" && block.text) {
            blocks.push(...extractFencedBlocks(block.text));
          }
        }
      }

      if (blocks.length === 0) {
        ctx.ui.notify("No code blocks in the last assistant message", "warning");
        return;
      }

      let selected = blocks[0] as string;
      if (blocks.length > 1) {
        const choices = blocks.map((block, i) => `${i + 1}. ${truncate(block, 80)}`);
        const choice = await ctx.ui.select("Which block to copy?", choices);
        if (choice === undefined) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        selected = blocks[choices.indexOf(choice)] as string;
      }

      try {
        await copyToClipboard(selected);
        ctx.ui.notify(`Copied: ${truncate(selected, 60)}`, "info");
      } catch (err) {
        ctx.ui.notify(`Failed to copy: ${err}`, "error");
      }
    },
  });
}
