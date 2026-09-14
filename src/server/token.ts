import { createHash, randomBytes } from 'node:crypto'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isTokenShape(s: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(s)
}

export function personLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${token}`
}
