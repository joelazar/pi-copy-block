#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO="${DEMO_DIR:-/tmp/pi-copy-block-demo}"

PI_HOME="${DEMO}-pi"
rm -rf "$DEMO" "$PI_HOME"
mkdir -p "$DEMO/.pi/extensions" "$DEMO/sessions" "$PI_HOME"
echo '{}' > "$PI_HOME/settings.json"
ln -sf "$ROOT/index.ts" "$DEMO/.pi/extensions/pi-copy-block.ts"

cd "$DEMO"
git init -q
git config user.name "demo"
git config user.email "demo@example.com"

cat > deploy.md <<'EOF'
# Deploying

Nothing here yet.
EOF

git add -A
git commit -qm "initial"

python3 - "$DEMO/sessions/demo.jsonl" <<'PY'
import json, sys, uuid

reply = """Here is the deploy sequence. Build the image first:

```bash
docker build -t api:latest -f docker/Dockerfile .
```

Then apply the manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
```

Once the rollout settles, tail the logs to confirm the new pods are healthy."""

sid = str(uuid.uuid7()) if hasattr(uuid, "uuid7") else str(uuid.uuid4())
ts = "2026-08-13T09:00:00.000Z"

lines = [
    {"type": "session", "version": 3, "id": sid, "timestamp": ts, "cwd": "/tmp/pi-copy-block-demo"},
    {
        "type": "message",
        "id": "aaaaaaaa",
        "parentId": None,
        "timestamp": ts,
        "message": {
            "role": "user",
            "content": [{"type": "text", "text": "How do I deploy the api service?"}],
            "timestamp": 1786000000000,
        },
    },
    {
        "type": "message",
        "id": "bbbbbbbb",
        "parentId": "aaaaaaaa",
        "timestamp": ts,
        "message": {
            "role": "assistant",
            "content": [{"type": "text", "text": reply}],
            "api": "anthropic-messages",
            "provider": "anthropic",
            "model": "claude-sonnet-4-5",
            "usage": {
                "input": 4,
                "output": 212,
                "cacheRead": 8241,
                "cacheWrite": 1904,
                "totalTokens": 10361,
                "cost": {"input": 0.0, "output": 0.003, "cacheRead": 0.002, "cacheWrite": 0.007, "total": 0.012},
            },
            "stopReason": "stop",
            "responseId": "msg_demo",
            "timestamp": 1786000001000,
        },
    },
]

with open(sys.argv[1], "w") as fh:
    for line in lines:
        fh.write(json.dumps(line) + "\n")
PY
