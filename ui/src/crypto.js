import { API_BASE } from './config.js'

const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null

export const cryptoAvailable = !!subtle

let warned = false
function warnOnce() {
  if (!warned) {
    warned = true
    console.warn(
      '[InterviewPrep] Web Crypto is unavailable (insecure context). API payloads are sent unencrypted. ' +
        'Open the app over HTTPS or http://localhost to enable payload encryption.'
    )
  }
}

let publicKeyPromise = null

function toB64(buf) {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode.apply(null, arr.subarray(i, i + chunk))
  }
  return btoa(s)
}

function fromB64(s) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function fetchPublicKey() {
  const res = await fetch(API_BASE + '/api/crypto/public-key')
  if (!res.ok) throw new Error('Could not fetch encryption key')
  const { publicKey } = await res.json()
  return subtle.importKey(
    'spki',
    fromB64(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
}

function ensurePublicKey() {
  if (!publicKeyPromise) {
    publicKeyPromise = fetchPublicKey().catch((e) => {
      publicKeyPromise = null
      throw e
    })
  }
  return publicKeyPromise
}

export function resetPublicKey() {
  publicKeyPromise = null
}

async function newAesKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const key = await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { raw, key }
}

export async function prepareRequest(bodyObj) {
  if (!subtle) {
    warnOnce()
    const headers = {}
    let body
    if (bodyObj !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(bodyObj)
    }
    return { headers, body, aesKey: null }
  }
  const pub = await ensurePublicKey()
  const { raw, key } = await newAesKey()
  const wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw)
  const headers = { 'X-Enc-Key': toB64(wrapped) }
  let body
  if (bodyObj !== undefined) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = new TextEncoder().encode(JSON.stringify(bodyObj))
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data)
    body = JSON.stringify({ iv: toB64(iv), d: toB64(ct) })
    headers['Content-Type'] = 'application/json'
  }
  return { headers, body, aesKey: key }
}

export async function decryptEnvelope(aesKey, text) {
  const { iv, d } = JSON.parse(text)
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), tagLength: 128 },
    aesKey,
    fromB64(d)
  )
  return new TextDecoder().decode(plain)
}

export async function decryptChunk(aesKey, line) {
  const framed = fromB64(line)
  const iv = framed.slice(0, 12)
  const ct = framed.slice(12)
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesKey, ct)
  return new TextDecoder().decode(plain)
}
