from __future__ import annotations

import base64
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import settings

KEY_HEADER = "x-enc-key"
ENC_MARKER = b"x-enc"


_DEFAULT_PRIVATE_KEY_PEM = """-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD+ZI+U8euiFlMl
ZlUe+/0kh7cIX+tczp2srnNuOiO+/xK3IvWs578nzHq8zNCrE4DvqKsDQ9nOVynL
TC5YodPPYFReyMh0kCFZT6fTl4HrRT4bMadOc5th12K8elNPUweoVjCEJKmm7Gc6
4tf4x38OR04Bd7GnacEIQUlAWKy7Ssel9+5TWWz4Q1qzsz2QN1AC+46jx3Wrp9ea
9luu5F3RjIHnGYZ5HuEnXDgrJErQfxeNm57oCw7TAdEek7XVdHC3cArTpVHC3F5L
xu95kLFHuwvPfJ2IlrOJrxz+DKMlqTld+Jwyg6V/JjF3vwTnOG+/HkCKO0Xu77wr
39o+A5/lAgMBAAECggEAJjUOR42KGV8G/9/9utiX7YugltZpMBgsIEpXNd/vjHkc
43qRsXVhBWY1rPOKB5e3TsdjX+sp5E69DTaU42Tyvfu20EGRscgP6i0HhMUFk0Nk
D4uGmEbOuIQz5SDuMETFKqg/QymKfXKWEocNbuTvlUJqWdgTS5SblFTR3qMy1jIZ
YAXKxB8IC3Ij9nVxZg0tsX30z0N5UmJ4zKz/7Ftdny6PFwiiSf8LXMWPvSjOImY9
5ZQMIlxPYON0kNkm3UewfMZq/YO0TwNWa0yQbQy0J+AOo102KPv2pgeyhb+FHRRX
OjwgAvKa9kEG2WmEQQsie7HwnX5AUWOdbY0gv3azIQKBgQD/+o/K/tFYp4Pg8A+K
yywlo6tU0EPQ8cqSsQKB2sljbHqUITkspmDPZyVQXtLqxBScDnQinFv9WtaQ0HZt
7m5bfJEtNBEJ8xH0fKfbja2ioZTSuAUtCujGuR4JTUAJArpK0TBOo5x+gXr1Hvgf
tnDX+ZfEPk7J9TZ5w4y9Qteo3QKBgQD+afcpzvvqiJvpYFrnmxPBQVW7V40YY4Wk
cEpxa/yMhXjCODdXIMI/UnzAJIYjcZrFrVizZYzzvJnnooTNLxQU2pBuQee4R3At
3ot2MOI4OKYRDcudYFASDw5EQzmbSo7mrjGoA2d60cRiEs4VDqwxQEy2hJlx0MnO
Mq5Xt/ReqQKBgQDzst7curYhufGC3+lcEMup1eUSbOhzbw6Vk3G4oMukHS2iAvNE
v+1g52kN2AjjOuQIInaMUOH/FVE7M0vcoudrr+8i4vPpzgDlCxxfmMWbFEv0RP+g
f0dXkfu3jVUOfwtOmVNtOrSNd8XQwbglsPJDm7rSOSOXgB1p1TMTKCTa/QKBgGLQ
57Zudbx3yQ8RZN2Wh0rFxLXaYKw7Y5omH1QEnHg8E1ZknWITED+mG1xKE2vK4VGs
bcpoRCIbfC/TGP/VLFiZOAYLRSR3YuP+D28dt5AcuKvhDtgWo6MQA/uRnNtrTyvc
Nt9KSzQSK9Pn9/GH3GvYzLMLt8nUTb3wQ3VAtwLZAoGBAPHQKSG5a8Mya3sdRllo
U+nCmjUX4JNF/bLp5g2Sgib4UXAsgO/I+EfqDKhHzaSXFVEql2ZJ15c8azq6yztG
pTJONG1DRXt3eo3VQad5qi/ipS8UNmrwfRgB4bwoUCJUUp7cFtnep158ZedG4qMu
YjZJmOCYTjTA4OeDWp5UG1QY
-----END PRIVATE KEY-----
"""


def _load_key():
    pem = settings.rsa_private_key_pem or _DEFAULT_PRIVATE_KEY_PEM
    try:
        return serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
    except Exception:
        return rsa.generate_private_key(public_exponent=65537, key_size=2048)


_private_key = _load_key()
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



async def _read_body(receive) -> bytes:
    body = b""
    more = True
    while more:
        message = await receive()
        body += message.get("body", b"")
        more = message.get("more_body", False)
    return body


def _replay_receive(body: bytes, original_receive):
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
