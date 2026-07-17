"""Vercel Python entrypoint. Vercel serves this file as a serverless function and
runs the exported ASGI `app`. Ensure the repo root is importable so the `server`
package resolves regardless of the runtime working directory."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.app import app  # noqa: E402

__all__ = ["app"]
