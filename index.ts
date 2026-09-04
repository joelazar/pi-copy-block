import {
  copyToClipboard,
  type ExtensionAPI,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";

type AssistantMessage = Extract<
  Extract<SessionEntry, { type: "message" }>["message"],
  { role: "assistant" }
>;

const COMMAND = "copy-block";
const RECENT_REPLIES = 10;
const PREVIEW_WIDTH = 80;

export type CopyableReply = {
  age: number;
  blocks: string[];
};

export function extractFencedBlocks(text: string): string[] {
  const fence = /```(?:\w*)?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

function collectBlocks(message: AssistantMessage): string[] {
  const blocks: string[] = [];
  for (const block of message.content) {
    if (
      block.type === "toolCall" &&
      block.name.toLowerCase() === "bash" &&
      typeof block.arguments.command === "string"
    ) {
      blocks.push(block.arguments.command);
    } else if (block.type === "text") {
      blocks.push(...extractFencedBlocks(block.text));
    }
  }
  return blocks;
}

export function findRecentCopyableReplies(
  branch: SessionEntry[],
): CopyableReply[] {
  const replies: CopyableReply[] = [];
  let age = 0;
  for (let i = branch.length - 1; i >= 0 && age < RECENT_REPLIES; i--) {
    const entry = branch[i];
    if (entry?.type !== "message" || entry.message.role !== "assistant") continue;
    age++;
    const blocks = collectBlocks(entry.message);
    if (blocks.length > 0) replies.push({ age, blocks });
  }
  return replies;
}

function truncate(text: string, max = PREVIEW_WIDTH): string {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.length > max ? `${firstLine.slice(0, max - 3)}...` : firstLine;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: `Copy a code block from the last ${RECENT_REPLIES} assistant replies to clipboard`,
    handler: async (_args, ctx) => {
      const replies = findRecentCopyableReplies(ctx.sessionManager.getBranch());

      if (replies.length === 0) {
        ctx.ui.notify(
          `No code blocks in the last ${RECENT_REPLIES} assistant replies`,
          "warning",
        );
        return;
      }

      let reply = replies[0] as CopyableReply;
      if (replies.length > 1) {
        const choices = replies.map(
          ({ age, blocks }) =>
            `Reply ${age} (${plural(blocks.length, "block")}): ${truncate(blocks[0] as string)}`,
        );
        const choice = await ctx.ui.select("Which assistant reply?", choices);
        if (choice === undefined) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        reply = replies[choices.indexOf(choice)] as CopyableReply;
      }

      let selected = reply.blocks[0] as string;
      if (reply.blocks.length > 1) {
        const choices = reply.blocks.map(
          (block, i) => `${i + 1}. ${truncate(block)}`,
        );
        const choice = await ctx.ui.select("Which block to copy?", choices);
        if (choice === undefined) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        selected = reply.blocks[choices.indexOf(choice)] as string;
      }

      try {
        await copyToClipboard(selected);
        ctx.ui.notify(
          `Copied from reply ${reply.age}: ${truncate(selected)}`,
          "info",
        );
      } catch (err) {
        ctx.ui.notify(`Failed to copy: ${err}`, "error");
      }
    },
  });
}
