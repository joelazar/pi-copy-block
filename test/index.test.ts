import assert from "node:assert/strict";
import test from "node:test";

import type { SessionEntry } from "@earendil-works/pi-coding-agent";

import { extractFencedBlocks, findRecentCopyableReplies } from "../index.ts";

function assistant(...content: unknown[]): SessionEntry {
  return {
    type: "message",
    message: { role: "assistant", content },
  } as unknown as SessionEntry;
}

function user(text: string): SessionEntry {
  return {
    type: "message",
    message: { role: "user", content: text },
  } as unknown as SessionEntry;
}

function fenced(code: string): { type: "text"; text: string } {
  return { type: "text", text: `\`\`\`bash\n${code}\n\`\`\`` };
}

test("searches the ten most recent assistant replies, newest first", () => {
  const branch = Array.from({ length: 11 }, (_, i) => [
    assistant(fenced(`command-${i}`)),
    user(`prompt-${i}`),
  ]).flat();

  const replies = findRecentCopyableReplies(branch);

  assert.equal(replies.length, 10);
  assert.deepEqual(replies[0], { age: 1, blocks: ["command-10"] });
  assert.deepEqual(replies[9], { age: 10, blocks: ["command-1"] });
});

test("counts age by assistant reply, not by entry", () => {
  const branch = [
    assistant(fenced("old")),
    user("a"),
    user("b"),
    assistant({ type: "text", text: "no block here" }),
    user("c"),
    assistant(fenced("new")),
  ];

  assert.deepEqual(findRecentCopyableReplies(branch), [
    { age: 1, blocks: ["new"] },
    { age: 3, blocks: ["old"] },
  ]);
});

test("collects fenced blocks and bash tool calls in order", () => {
  const branch = [
    assistant(
      { type: "text", text: "```sh\necho from prose\n```" },
      { type: "toolCall", name: "bash", arguments: { command: "printf from-tool" } },
      { type: "toolCall", name: "read", arguments: { path: "x" } },
    ),
  ];

  assert.deepEqual(findRecentCopyableReplies(branch), [
    { age: 1, blocks: ["echo from prose", "printf from-tool"] },
  ]);
});

test("preserves newlines inside a fenced script", () => {
  const script = "for file in *.txt; do\n  printf '%s\\n' \"$file\"\ndone";

  assert.deepEqual(extractFencedBlocks(`\`\`\`bash\n${script}\n\`\`\`\n`), [script]);
});

test("returns nothing when no reply has a block", () => {
  const branch = [assistant({ type: "text", text: "There is no command in this reply." })];

  assert.deepEqual(findRecentCopyableReplies(branch), []);
});
