# pi-copy-block

Grab a code block out of pi's last reply and put it on your clipboard.

![demo](./assets/demo.gif)

Pi ends a lot of turns with something you're meant to run or paste: a fenced block in its prose, or a `bash` tool call waiting for approval. Selecting that text with the mouse inside a TUI is fiddly, and it picks up the surrounding borders. `/copy-block` pulls it out cleanly.

## Install

```bash
pi install npm:pi-copy-block
```

## Usage

Run `/copy-block`. The extension scans the most recent assistant message and gathers, in the order they appear:

- the body of every fenced code block in the message text, with the fences and language tag stripped
- the `command` argument of every `bash` tool call

One match goes straight to the clipboard. Several matches open a picker showing the first line of each, truncated to 80 characters. Pick one and it gets copied.

If the last reply had no blocks in it, you get a warning and the clipboard is left alone.

## License

MIT
