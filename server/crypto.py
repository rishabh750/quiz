"""In-transit payload encryption, wire-compatible with the browser's Web Crypto
layer (ui/src/crypto.js).

Handshake: the client GETs the RSA public key (SPKI, base64). Per request it
generates a random AES-256 key, wraps it with RSA-OAEP(SHA-256) into the
`X-Enc-Key` header, and AES-GCM-encrypts the JSON body into an envelope
`{iv, d}` (both base64; `d` is ciphertext||tag). The server decrypts the request
and AES-GCM-encrypts the response with the same key, marking it `X-Enc: 1`.
`/api/generate` streams instead: each chunk is `base64(iv || ciphertext||tag)\n`.

Requests without `X-Enc-Key` pass through untouched, so the app still works over
plain HTTP where the browser has no Web Crypto (the client falls back to plaintext).

The RSA keypair is loaded from RSA_PRIVATE_KEY (PEM) when set, else generated per
process. Generated keys differ across instances/restarts; the client re-fetches the
public key when a decrypt fails, so single-instance POC usage is fine."""
from __future__ import annotations

import base64
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

KEY_HEADER = "x-enc-key"
ENC_MARKER = b"x-enc"


def _load_or_generate_key():
    if settings.rsa_private_key_pem:
        try:
            return serialization.load_pem_private_key(
                settings.rsa_private_key_pem.encode("utf-8"), password=None
            )
        except Exception:
            pass
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


_private_key = _load_or_generate_key()
_public_key_b64 = base64.b64encode(
    _private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
).decode("ascii")

_OAEP = padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def public_key_b64() -> str:
    return _public_key_b64


def unwrap_aes_key(wrapped_b64: str) -> bytes:
    return _private_key.decrypt(base64.b64decode(wrapped_b64), _OAEP)


def _aes_decrypt(key: bytes, iv_b64: str, d_b64: str) -> bytes:
    return AESGCM(key).decrypt(base64.b64decode(iv_b64), base64.b64decode(d_b64), None)


def encrypt_envelope(key: bytes, plaintext: bytes) -> bytes:
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plaintext, None)
    return json.dumps(
        {"iv": base64.b64encode(iv).decode("ascii"), "d": base64.b64encode(ct).decode("ascii")}
    ).encode("utf-8")


def encrypt_chunk(key: bytes, text: str) -> bytes:
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, text.encode("utf-8"), None)
    return base64.b64encode(iv + ct) + b"\n"


# --- ASGI middleware -------------------------------------------------------

async def _read_body(receive) -> bytes:
    body = b""
    more = True
    while more:
        message = await receive()
        body += message.get("body", b"")
        more = message.get("more_body", False)
    return body


def _replay_receive(body: bytes, original_receive):
    """Serve the decrypted body once, then defer to the real receive channel so
    genuine client disconnects still propagate (a one-shot that returns
    http.disconnect would make StreamingResponse abort mid-stream)."""
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await original_receive()

    return receive


async def _send_plain_error(send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [(b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode())],
    })
    await send({"type": "http.response.body", "body": body})


class PayloadCipherMiddleware:
    """Decrypts encrypted requests and encrypts responses in place."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        wrapped = headers.get(KEY_HEADER)
        if not wrapped:
            return await self.app(scope, receive, send)

        try:
            aes_key = unwrap_aes_key(wrapped)
        except Exception:
            return await _send_plain_error(send, 400, "Bad encryption key")

        raw = await _read_body(receive)
        plain = b""
        if raw:
            try:
                env = json.loads(raw)
                plain = _aes_decrypt(aes_key, env["iv"], env["d"])
            except Exception:
                return await _send_plain_error(send, 400, "Bad encrypted payload")

        scope = dict(scope)
        scope["aes_key"] = aes_key
        downstream_receive = _replay_receive(plain, receive)

        # Streaming endpoint encrypts its own chunks; don't buffer its response.
        if scope.get("path") == "/api/generate":
            return await self.app(scope, downstream_receive, send)

        state = {"status": 200, "headers": []}
        chunks = []

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                state["status"] = message["status"]
                state["headers"] = message.get("headers", [])
            elif message["type"] == "http.response.body":
                chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    envelope = encrypt_envelope(aes_key, b"".join(chunks))
                    out_headers = [
                        (k, v) for (k, v) in state["headers"]
                        if k.lower() not in (b"content-length", b"content-type")
                    ]
                    out_headers.append((b"content-type", b"application/json"))
                    out_headers.append((ENC_MARKER, b"1"))
                    out_headers.append((b"content-length", str(len(envelope)).encode()))
                    await send({"type": "http.response.start",
                                "status": state["status"], "headers": out_headers})
                    await send({"type": "http.response.body", "body": envelope})

        await self.app(scope, downstream_receive, send_wrapper)
