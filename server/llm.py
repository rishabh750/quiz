"""Server-side streaming proxy to the LLM providers. The account's API key stays
on the server and is never sent to the browser."""
from __future__ import annotations

import json
import urllib.parse
from typing import AsyncIterator

import httpx

MODELS = {"gemini": "gemini-2.5-flash", "openai": "gpt-4o", "anthropic": "claude-sonnet-5"}


class GenerationError(Exception):
    pass


def _build(provider: str, model: str, api_key: str, prompt: str):
    if provider == "openai":
        return (
            "https://api.openai.com/v1/chat/completions",
            {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            {"model": model, "stream": True, "max_tokens": 16384,
             "messages": [{"role": "user", "content": prompt}]},
        )
    if provider == "anthropic":
        return (
            "https://api.anthropic.com/v1/messages",
            {"Content-Type": "application/json", "x-api-key": api_key,
             "anthropic-version": "2023-06-01"},
            {"model": model, "stream": True, "max_tokens": 32000,
             "messages": [{"role": "user", "content": prompt}]},
        )
    generation_config = {"temperature": 0.6, "maxOutputTokens": 32768}
    if "2.5" in model:
        generation_config["thinkingConfig"] = {"thinkingBudget": 0}
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           + urllib.parse.quote(model) + ":streamGenerateContent?alt=sse")
    return (
        url,
        {"Content-Type": "application/json", "x-goog-api-key": api_key},
        {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
         "generationConfig": generation_config},
    )


def _delta(provider: str, obj: dict) -> str:
    if provider == "openai":
        choices = obj.get("choices") or [{}]
        return (choices[0].get("delta") or {}).get("content") or ""
    if provider == "anthropic":
        if obj.get("type") == "content_block_delta":
            return (obj.get("delta") or {}).get("text") or ""
        return ""
    candidates = obj.get("candidates") or [{}]
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    return "".join(p.get("text", "") for p in parts)


async def _error_message(response: httpx.Response) -> str:
    try:
        raw = await response.aread()
        data = json.loads(raw)
        return (data.get("error") or {}).get("message") or "Generation failed"
    except Exception:
        return "Generation failed"


async def stream_generation(provider: str, api_key: str, prompt: str) -> AsyncIterator[str]:
    provider = provider if provider in MODELS else "gemini"
    model = MODELS[provider]
    url, headers, body = _build(provider, model, api_key, prompt)
    timeout = httpx.Timeout(300.0, connect=30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=body) as response:
                if response.status_code >= 400:
                    raise GenerationError(await _error_message(response))
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        text = _delta(provider, json.loads(payload))
                    except Exception:
                        continue
                    if text:
                        yield text
    except GenerationError:
        raise
    except Exception:
        raise GenerationError("Could not reach the provider")
