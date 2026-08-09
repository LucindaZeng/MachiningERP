import { randomInt } from 'node:crypto'

/** 去掉容易混淆的 0/O、1/I/L */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const WIDTH = 120
const HEIGHT = 44

export interface CaptchaArtifact {
  code: string
  /** data:image/svg+xml;base64,... —— 前端 <img src> 直接可用 */
  imageUrl: string
}

function randomCode(length: number): string {
  // charAt 永远返回字符串，不需要额外的 undefined 分支
  return Array.from({ length }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join('')
}

function noiseLines(count: number): string {
  return Array.from({ length: count }, () => {
    const [x1, y1, x2, y2] = [randomInt(WIDTH), randomInt(HEIGHT), randomInt(WIDTH), randomInt(HEIGHT)]
    const opacity = (randomInt(20, 45) / 100).toFixed(2)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0B357B" stroke-opacity="${opacity}" stroke-width="1"/>`
  }).join('')
}

function glyphs(code: string): string {
  const step = WIDTH / (code.length + 1)

  return [...code]
    .map((char, index) => {
      const x = step * (index + 1)
      const y = HEIGHT / 2 + randomInt(-3, 4)
      const rotate = randomInt(-22, 23)
      const fill = index % 2 === 0 ? '#0B357B' : '#DF911E'
      return `<text x="${x.toFixed(1)}" y="${y}" fill="${fill}" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotate} ${x.toFixed(1)} ${y})">${char}</text>`
    })
    .join('')
}

/**
 * 生成图形验证码 SVG。自绘而非引三方库：可控、无原生依赖，
 * 配色沿用品牌令牌（主色 #0B357B、辅色 #DF911E）。
 */
export function createCaptchaArtifact(length = 4): CaptchaArtifact {
  const code = randomCode(length)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="图形验证码">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#F5F7FB"/>` +
    noiseLines(5) +
    glyphs(code) +
    '</svg>'

  return {
    code,
    imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
  }
}
