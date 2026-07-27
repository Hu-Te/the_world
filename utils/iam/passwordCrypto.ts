/**
 * 口令传输加密：RSA-OAEP(SHA-256) + 服务端公钥。
 * Payload 中不再出现明文密码（HTTPS 之外的纵深防护）。
 */

type PublicKeyPayload = {
  alg: string
  kid: string
  publicKey: string
}

let cached: { kid: string; key: CryptoKey; fetchedAt: number } | null = null

function apiBase(): string {
  const config = useRuntimeConfig()
  return String(config.public.apiOrigin || '').replace(/\/$/, '')
}

async function fetchPublicKey(): Promise<PublicKeyPayload> {
  const res = await fetch(`${apiBase()}/api/auth/public-key`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const json = (await res.json().catch(() => null)) as {
    code: number
    message: string
    data: PublicKeyPayload
  } | null
  if (!res.ok || !json || json.code !== 0 || !json.data?.publicKey) {
    throw new Error(json?.message || '获取加密公钥失败')
  }
  return json.data
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  const spki = b64ToBytes(spkiB64)
  return crypto.subtle.importKey(
    'spki',
    spki.buffer as ArrayBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
}

async function ensureKey(): Promise<CryptoKey> {
  if (!import.meta.client || typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前环境不支持 WebCrypto，无法安全登录')
  }
  const now = Date.now()
  if (cached && now - cached.fetchedAt < 10 * 60 * 1000) {
    return cached.key
  }
  const payload = await fetchPublicKey()
  if (payload.alg && payload.alg !== 'RSA-OAEP-256') {
    throw new Error(`不支持的口令加密算法: ${payload.alg}`)
  }
  const key = await importPublicKey(payload.publicKey)
  cached = { kid: payload.kid, key, fetchedAt: now }
  return key
}

/** 将明文口令加密为 Base64 密文（发往后端 password 字段）。 */
export async function encryptPasswordForTransport(plain: string): Promise<string> {
  if (!plain) throw new Error('密码不能为空')
  const key = await ensureKey()
  const encoded = new TextEncoder().encode(plain)
  const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded)
  return bytesToB64(cipher)
}

export function clearPasswordCryptoCache() {
  cached = null
}
