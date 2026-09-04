# pi-copy-block

Grab a code block out of pi's recent replies and put it on your clipboard.

![demo](https://raw.githubusercontent.com/joelazar/pi-copy-block/main/assets/demo.gif)

Pi ends a lot of turns with something you're meant to run or paste: a fenced block in its prose, or a `bash` tool call waiting for approval. Selecting that text with the mouse inside a TUI is fiddly, and it picks up the surrounding borders. `/copy-block` pulls it out cleanly.

## Install

```bash
pi install npm:@joelazar/pi-copy-block
```

## Usage

Run `/copy-block`. The extension scans the last ten assistant replies and gathers from each, in the order they appear:

- the body of every fenced code block in the message text, with the fences and language tag stripped
- the `command` argument of every `bash` tool call

One match goes straight to the clipboard. If several replies have blocks, a picker chooses the reply (`Reply 1` is the latest). If that reply has several blocks, a second picker chooses the block. Each choice shows the first line, truncated to 80 characters.

If none of the replies has a block, you get a warning and the clipboard is left alone.

## License

MIT
