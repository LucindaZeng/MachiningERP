const BRAND_COLORS = ['#0b357b', '#123f8f', '#1f5bb5', '#c97d12', '#df911e']

/** 把验证码文本画成 SVG data URL（仅 mock 使用，生产由后端 auth 模块出图）。 */
export function renderCaptchaSvg(code: string): string {
  const width = 120
  const height = 44
  const glyphs = code
    .split('')
    .map((char, index) => buildGlyph(char, index, width, height))
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#f4f7fc"/>` +
    buildNoise(width, height) +
    glyphs +
    '</svg>'

  return `data:image/svg+xml;base64,${base64(svg)}`
}

function buildGlyph(char: string, index: number, width: number, height: number): string {
  const slot = width / 4
  const x = slot * index + slot / 2 + randomBetween(-4, 4)
  const y = height / 2 + randomBetween(4, 8)
  const rotate = randomBetween(-24, 24)
  const fill = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]

  return (
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}" font-size="${randomBetween(24, 30).toFixed(0)}" ` +
    `font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle" ` +
    `transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${char}</text>`
  )
}

function buildNoise(width: number, height: number): string {
  const lines = Array.from({ length: 4 }, () => {
    const color = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]
    return (
      `<path d="M0 ${randomBetween(6, height - 6).toFixed(0)} Q ${(width / 2).toFixed(0)} ` +
      `${randomBetween(0, height).toFixed(0)} ${width} ${randomBetween(6, height - 6).toFixed(0)}" ` +
      `stroke="${color}" stroke-width="1" fill="none" opacity="0.35"/>`
    )
  })

  const dots = Array.from({ length: 26 }, () => {
    return (
      `<circle cx="${randomBetween(0, width).toFixed(0)}" cy="${randomBetween(0, height).toFixed(0)}" ` +
      `r="1" fill="#0b357b" opacity="0.25"/>`
    )
  })

  return [...lines, ...dots].join('')
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function base64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}
