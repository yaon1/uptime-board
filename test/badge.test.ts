import { expect, it } from 'vitest'
import { badge } from '../server/utils/badge'

it('renders an accessible, escaped SVG badge', () => {
  const svg = badge('api <prod>', '99.95%', 'up')
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
  expect(svg).toContain('aria-label="api &lt;prod&gt;: 99.95%"')
  expect(svg).toContain('fill="#2f9e44"')
  expect(svg).not.toContain('<prod>')
})
