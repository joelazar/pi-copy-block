import {
  copyToClipboard,
  highlightCode,
  type ExtensionAPI,
  type ExtensionContext,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

const COMMAND = "copy-block";
const RECENT_REPLIES = 10;
const PREVIEW_WIDTH = 80;
const PICKER_MIN_ROWS = 8;
const PICKER_LIST_MAX_WIDTH = 52;

type AssistantMessage = Extract<
  Extract<SessionEntry, { type: "message" }>["message"],
  { role: "assistant" }
>;

export type Fence = {
  lang: string;
  code: string;
};

export type Block = Fence & {
  age: number;
};

export function extractFencedBlocks(text: string): Fence[] {
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  const fences: Fence[] = [];
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const code = match[2]?.trim();
    if (code) fences.push({ lang: match[1] ?? "", code });
  }
  return fences;
}

function collectFences(message: AssistantMessage): Fence[] {
  const fences: Fence[] = [];
  for (const block of message.content) {
    if (
      block.type === "toolCall" &&
      block.name.toLowerCase() === "bash" &&
      typeof block.arguments.command === "string"
    ) {
      fences.push({ lang: "bash", code: block.arguments.command });
    } else if (block.type === "text") {
      fences.push(...extractFencedBlocks(block.text));
    }
  }
  return fences;
}

export function findRecentBlocks(branch: SessionEntry[]): Block[] {
  const blocks: Block[] = [];
  let age = 0;
  for (let i = branch.length - 1; i >= 0 && age < RECENT_REPLIES; i--) {
    const entry = branch[i];
    if (entry?.type !== "message" || entry.message.role !== "assistant") continue;
    age++;
    for (const fence of collectFences(entry.message)) blocks.push({ ...fence, age });
  }
  return blocks;
}

function truncate(text: string, max = PREVIEW_WIDTH): string {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.length > max ? `${firstLine.slice(0, max - 3)}...` : firstLine;
}

function pickBlock(ctx: ExtensionContext, blocks: Block[]): Promise<Block | undefined> {
  return ctx.ui.custom<Block | undefined>((tui, theme, kb, done) => {
    const panes = blocks.map(({ lang, code }) => highlightCode(code.replaceAll("\t", "   "), lang));
    const paneLines = Math.max(...panes.map((pane) => pane.length));
    let cursor = 0;
    let listOffset = 0;
    let paneOffset = 0;
    let height = PICKER_MIN_ROWS;

    const move = (delta: number) => {
      cursor = (cursor + delta + blocks.length) % blocks.length;
      paneOffset = 0;
    };

    return {
      render(width: number): string[] {
        const cap = Math.max(PICKER_MIN_ROWS, Math.floor(tui.terminal.rows / 2));
        const listWidth = Math.min(PICKER_LIST_MAX_WIDTH, Math.max(20, Math.floor(width * 0.35)));
        const paneWidth = Math.max(20, width - listWidth - 3);

        const pane = panes[cursor] as string[];
        height = Math.min(cap, Math.max(blocks.length, paneLines));
        if (cursor < listOffset) listOffset = cursor;
        if (cursor >= listOffset + height) listOffset = cursor - height + 1;
        paneOffset = Math.min(paneOffset, Math.max(0, pane.length - height));

        const separator = theme.fg("borderMuted", "│");
        const body: string[] = [];
        for (let i = 0; i < height; i++) {
          const index = listOffset + i;
          const block = blocks[index];
          const left = truncateToWidth(
            block === undefined
              ? ""
              : `${index === cursor ? theme.fg("accent", "❯ ") : "  "}${theme.fg("dim", `R${block.age}`)} ${truncate(block.code)}`,
            listWidth,
            "…",
            true,
          );
          const right = truncateToWidth(pane[paneOffset + i] ?? "", paneWidth, "…");
          body.push(`${left} ${separator} ${right}`);
        }

        const scrollHint = pane.length > height ? " • ←→ scroll" : "";
        const footer = theme.fg("dim", `↑↓ move${scrollHint} • enter copy • esc cancel`);
        return [theme.fg("accent", theme.bold("Which block to copy?")), "", ...body, "", footer];
      },
      invalidate() {},
      handleInput(data: string) {
        if (kb.matches(data, "tui.select.up")) move(-1);
        else if (kb.matches(data, "tui.select.down")) move(1);
        else if (matchesKey(data, Key.left)) paneOffset = Math.max(0, paneOffset - Math.floor(height / 2));
        else if (matchesKey(data, Key.right)) paneOffset += Math.floor(height / 2);
        else if (kb.matches(data, "tui.select.confirm")) done(blocks[cursor]);
        else if (kb.matches(data, "tui.select.cancel")) done(undefined);
        tui.requestRender();
      },
    };
  });
}

async function selectBlock(ctx: ExtensionContext, blocks: Block[]): Promise<Block | undefined> {
  const labels = blocks.map((block) => `R${block.age} ${truncate(block.code)}`);
  const choice = await ctx.ui.select("Which block to copy?", labels);
  return choice === undefined ? undefined : blocks[labels.indexOf(choice)];
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: `Copy a code block from the last ${RECENT_REPLIES} assistant replies to clipboard`,
    handler: async (_args, ctx) => {
      const blocks = findRecentBlocks(ctx.sessionManager.getBranch());

      if (blocks.length === 0) {
        ctx.ui.notify(
          `No code blocks in the last ${RECENT_REPLIES} assistant replies`,
          "warning",
        );
        return;
      }

      const block =
        blocks.length === 1
          ? (blocks[0] as Block)
          : ctx.mode === "tui"
            ? await pickBlock(ctx, blocks)
            : await selectBlock(ctx, blocks);
      if (block === undefined) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      try {
        await copyToClipboard(block.code);
        ctx.ui.notify(
          `Copied from reply ${block.age}: ${truncate(block.code)}`,
          "info",
        );
      } catch (err) {
        ctx.ui.notify(`Failed to copy: ${err}`, "error");
      }
    },
  });
}
