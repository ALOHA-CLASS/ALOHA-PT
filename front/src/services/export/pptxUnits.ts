// 캔버스(px) 값을 PPTX 단위로 바꾸는 순수 함수 모음.

const PX_PER_INCH = 96

export function pxToInch(px: number): number {
  return px / PX_PER_INCH
}

/** CSS px → pt (96px = 72pt) */
export function pxToPoint(px: number): number {
  return Math.round(px * 0.75 * 100) / 100
}

export interface PptxColor {
  /** '#' 없는 6자리 16진수 */
  color: string
  /** 0(불투명) ~ 100(완전 투명) */
  transparency: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')

/**
 * CSS 색상 문자열을 PPTX 색상으로 바꿉니다.
 * 16진수(#RGB, #RRGGBB, #RRGGBBAA)와 rgb()/rgba()를 지원하며, 투명하거나 해석할 수 없으면 null입니다.
 */
export function toPptxColor(value: string | undefined, opacity = 1): PptxColor | null {
  if (!value) return null
  const text = value.trim().toLowerCase()
  if (text === 'transparent' || text === 'none') return null

  let hex: string | null = null
  let alpha = 1
  const hexMatch = /^#([0-9a-f]{3,8})$/.exec(text)
  if (hexMatch) {
    const digits = hexMatch[1]
    if (digits.length === 3 || digits.length === 4) {
      hex = [...digits.slice(0, 3)].map((c) => c + c).join('')
      if (digits.length === 4) alpha = parseInt(digits[3] + digits[3], 16) / 255
    } else if (digits.length === 6 || digits.length === 8) {
      hex = digits.slice(0, 6)
      if (digits.length === 8) alpha = parseInt(digits.slice(6), 16) / 255
    }
  } else {
    const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text)
    if (rgbMatch) {
      hex = toHex(Number(rgbMatch[1])) + toHex(Number(rgbMatch[2])) + toHex(Number(rgbMatch[3]))
      if (rgbMatch[4]) alpha = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : Number(rgbMatch[4])
    }
  }
  if (!hex) return null

  const visible = clamp(alpha, 0, 1) * clamp(opacity, 0, 1)
  if (visible <= 0) return null
  return { color: hex.toUpperCase(), transparency: Math.round((1 - visible) * 100) }
}

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit'])

/** CSS font-family 목록에서 글꼴 이름을 순서대로 꺼냅니다 (generic family 제외). */
export function parseFontFamilies(fontFamily: string | undefined): string[] {
  if (!fontFamily) return []
  return fontFamily
    .split(',')
    .map((name) => name.trim().replace(/^['"]|['"]$/g, ''))
    .filter((name) => name && !GENERIC_FAMILIES.has(name.toLowerCase()))
}

/** PPTX에는 글꼴을 하나만 지정할 수 있으므로 첫 번째 글꼴을 사용합니다. */
export function primaryFontFace(fontFamily: string | undefined, fallback: string): string {
  return parseFontFamilies(fontFamily)[0] ?? fallback
}

const SAFE_MONOSPACE = ['Consolas', 'Courier New']

/**
 * 코드용 글꼴을 고릅니다. 글꼴이 없는 PC에서 가변폭 글꼴로 바뀌면 코드 정렬이 깨지므로
 * 대부분의 환경에 설치된 고정폭 글꼴을 우선합니다.
 */
export function monospaceFontFace(fontFamily: string | undefined): string {
  const families = parseFontFamilies(fontFamily)
  return SAFE_MONOSPACE.find((safe) => families.some((name) => name.toLowerCase() === safe.toLowerCase())) ?? 'Consolas'
}

export function normalizeRotation(rotation: number | undefined): number {
  if (!rotation) return 0
  return ((Math.round(rotation) % 360) + 360) % 360
}
