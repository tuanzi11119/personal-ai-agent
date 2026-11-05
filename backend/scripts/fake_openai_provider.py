"""Local OpenAI-compatible provider used only to verify the live LLM/embedding code path.

Run:  .venv/Scripts/python.exe scripts/fake_openai_provider.py            # port 9099
It implements:
  POST /v1/chat/completions  -> deterministic answer marked [LIVE-PROVIDER]
  POST /v1/embeddings        -> 384-dim hashed n-gram vectors (lexical, like the mock embedder)
  GET  /stats                -> call counters
Model name containing "fail401" makes the chat endpoint answer 401 with a fake key inside the
error message, which lets the test prove that secrets are redacted from surfaced errors.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DIMENSION = 384
_LATIN = re.compile(r"[a-z0-9_+#.]+")
_CJK = re.compile(r"[\u4e00-\u9fff]")

stats = {"chat": 0, "embed": 0}


def _tokens(text: str) -> list[tuple[str, float]]:
    low = (text or "").lower()
    tokens = [(t, 1.0) for t in _LATIN.findall(low)]
    chars = _CJK.findall(low)
    tokens += [(c, 0.3) for c in chars]
    tokens += [("".join(chars[i : i + 2]), 1.0) for i in range(len(chars) - 1)]
    return tokens


def _embed(text: str) -> list[float]:
    vec = [0.0] * DIMENSION
    for token, weight in _tokens(text):
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big")
        vec[value % DIMENSION] += weight if (value >> 63) & 1 else -weight
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm else vec


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # silence request logging
        pass

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") == "/stats":
            self._send(200, stats)
            return
        self._send(404, {"error": {"message": "not found"}})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw)
        except ValueError:
            self._send(400, {"error": {"message": "invalid json"}})
            return

        path = self.path.split("?")[0].rstrip("/")
        if path.endswith("/chat/completions"):
            stats["chat"] += 1
            model = str(payload.get("model", ""))
            if "fail401" in model:
                self._send(
                    401,
                    {
                        "error": {
                            "message": "Incorrect API key provided: sk-test-leaked-0000. Check your key.",
                            "type": "invalid_request_error",
                        }
                    },
                )
                return
            messages = payload.get("messages") or []
            last_user = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
            content = (
                f"[LIVE-PROVIDER:{model}] fake-provider HTTP reply\n"
                f"messages={len(messages)} last_user={last_user[:120]}"
            )
            self._send(
                200,
                {
                    "id": "chatcmpl-fake",
                    "object": "chat.completion",
                    "model": model,
                    "choices": [
                        {"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}
                    ],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                },
            )
            return
        if path.endswith("/embeddings"):
            stats["embed"] += 1
            inputs = payload.get("input") or []
            if isinstance(inputs, str):
                inputs = [inputs]
            data = [
                {"object": "embedding", "index": i, "embedding": _embed(str(text))}
                for i, text in enumerate(inputs)
            ]
            self._send(200, {"object": "list", "model": payload.get("model", ""), "data": data})
            return
        self._send(404, {"error": {"message": "not found"}})


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9099
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"fake openai provider listening on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
