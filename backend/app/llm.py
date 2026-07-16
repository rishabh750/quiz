import json
import re
from urllib.parse import quote

import httpx


def _gemini_delta(o):
    parts = (((o.get("candidates") or [{}])[0].get("content") or {}).get("parts")) or []
    return "".join(p.get("text", "") for p in parts)


def _openai_delta(o):
    choices = o.get("choices") or [{}]
    return (choices[0].get("delta") or {}).get("content") or ""


def _anthropic_delta(o):
    if o.get("type") == "content_block_delta":
        return (o.get("delta") or {}).get("text") or ""
    return ""


def _gemini(prompt, model):
    generation_config = {"temperature": 0.6, "maxOutputTokens": 32768}
    if re.search(r"2\.5", model):
        generation_config["thinkingConfig"] = {"thinkingBudget": 0}
    return {
        "url": "https://generativelanguage.googleapis.com/v1beta/models/"
        + quote(model)
        + ":streamGenerateContent?alt=sse",
        "headers": lambda key: {"Content-Type": "application/json", "x-goog-api-key": key},
        "body": {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        },
        "delta": _gemini_delta,
    }


def _openai(prompt, model):
    return {
        "url": "https://api.openai.com/v1/chat/completions",
        "headers": lambda key: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
        },
        "body": {
            "model": model,
            "stream": True,
            "max_tokens": 16384,
            "messages": [{"role": "user", "content": prompt}],
        },
        "delta": _openai_delta,
    }


def _anthropic(prompt, model):
    return {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": lambda key: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        "body": {
            "model": model,
            "stream": True,
            "max_tokens": 32000,
            "messages": [{"role": "user", "content": prompt}],
        },
        "delta": _anthropic_delta,
    }


MODELS = {"gemini": "gemini-2.5-flash", "openai": "gpt-4o", "anthropic": "claude-sonnet-5"}
BUILDERS = {"gemini": _gemini, "openai": _openai, "anthropic": _anthropic}


async def stream_generate(provider: str, api_key: str, prompt: str):
    provider = provider if provider in BUILDERS else "gemini"
    model = MODELS[provider]
    cfg = BUILDERS[provider](prompt, model)
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        async with client.stream(
            "POST", cfg["url"], headers=cfg["headers"](api_key), json=cfg["body"]
        ) as resp:
            if resp.status_code >= 400:
                raw = await resp.aread()
                try:
                    data = json.loads(raw)
                    msg = (data.get("error") or {}).get("message") or "Generation failed"
                except Exception:
                    msg = "Generation failed"
                raise GenerationError(msg, resp.status_code)
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if not payload or payload == "[DONE]":
                    continue
                try:
                    text = cfg["delta"](json.loads(payload))
                except Exception:
                    continue
                if text:
                    yield text


class GenerationError(Exception):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
