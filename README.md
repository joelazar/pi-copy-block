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

One match goes straight to the clipboard. Several open a picker: the list on the left shows each block's first line tagged with its reply (`R1` is the latest reply), the pane on the right shows the highlighted block. `←`/`→` scroll a long block. Navigation follows your `tui.select.*` keybindings.

If none of the replies has a block, you get a warning and the clipboard is left alone.

## License

MIT
