import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PWA assets', () => {
  it('has a valid manifest with icons that exist', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
    expect(m.name).toBe('PSRM Pasti')
    expect(m.start_url).toBe('/')
    expect(m.display).toBe('standalone')
    expect(m.lang).toBe('it')
    for (const icon of m.icons) expect(existsSync(`public${icon.src}`)).toBe(true)
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512'])
  })
  it('ships a service worker that serves the offline page for navigations', () => {
    const sw = readFileSync('public/sw.js', 'utf8')
    expect(sw).toContain("'/offline'")
    expect(sw).toContain("mode === 'navigate'")
  })
})
