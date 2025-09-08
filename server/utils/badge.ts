const COLORS = { up: '#2f9e44', down: '#e03131', paused: '#868e96', pending: '#868e96', degraded: '#f08c00' } as const

/** Approximate text width for 11px Verdana, enough for shields-style badges. */
function textWidth(text: string): number {
  return Math.round([...text].reduce((w, ch) => w + (/[ilI.,:']/.test(ch) ? 3.5 : /[mwMW]/.test(ch) ? 9.5 : 6.8), 0)) + 10
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** shields.io-style SVG, e.g. "api | 99.95%" in green. */
export function badge(label: string, value: string, tone: keyof typeof COLORS): string {
  const lw = textWidth(label)
  const vw = textWidth(value)
  const w = lw + vw
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escape(label)}: ${escape(value)}">
<title>${escape(label)}: ${escape(value)}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${COLORS[tone]}"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${escape(label)}</text><text x="${lw + vw / 2}" y="14">${escape(value)}</text></g>
</svg>`
}
