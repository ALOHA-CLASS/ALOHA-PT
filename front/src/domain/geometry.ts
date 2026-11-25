import { MIN_ELEMENT_SIZE } from '@/domain/constants'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** 가용 영역에 캔버스를 맞추는 배율을 계산합니다. */
export function fitScale(
  availableWidth: number,
  availableHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = 0,
): number {
  const w = Math.max(0, availableWidth - padding * 2)
  const h = Math.max(0, availableHeight - padding * 2)
  if (w === 0 || h === 0) return 1
  return Math.min(w / canvasWidth, h / canvasHeight)
}

function rotate(x: number, y: number, degrees: number): [number, number] {
  if (!degrees) return [x, y]
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [x * cos - y * sin, x * sin + y * cos]
}

export interface ResizeOptions {
  rotation?: number
  keepAspect?: boolean
  minSize?: number
}

/**
 * 핸들을 (dx, dy)만큼 끌었을 때의 새 사각형을 계산합니다. dx·dy는 캔버스 논리 좌표 기준입니다.
 * 회전된 요소는 끄는 핸들의 반대쪽 지점이 화면에서 움직이지 않도록 중심을 보정합니다.
 */
export function resizeRect(
  start: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: ResizeOptions = {},
): Rect {
  const { rotation = 0, keepAspect = false, minSize = MIN_ELEMENT_SIZE } = options
  // 포인터 이동량을 요소의 로컬 축으로 변환
  const [ldx, ldy] = rotate(dx, dy, -rotation)

  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')

  let width = start.width + (east ? ldx : west ? -ldx : 0)
  let height = start.height + (south ? ldy : north ? -ldy : 0)

  if (keepAspect && (west || east) && (north || south) && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height
    if (Math.abs(width - start.width) >= Math.abs(height - start.height) * ratio) height = width / ratio
    else width = height * ratio
    if (width < minSize) {
      width = minSize
      height = width / ratio
    }
    if (height < minSize) {
      height = minSize
      width = height * ratio
    }
  } else {
    width = Math.max(minSize, width)
    height = Math.max(minSize, height)
  }

  // 고정점(끄는 핸들의 반대쪽)의 로컬 좌표: 중심 기준 -0.5..0.5
  const anchorX = west ? 0.5 : east ? -0.5 : 0
  const anchorY = north ? 0.5 : south ? -0.5 : 0

  const startCenterX = start.x + start.width / 2
  const startCenterY = start.y + start.height / 2
  const [ax, ay] = rotate(anchorX * start.width, anchorY * start.height, rotation)
  const [nax, nay] = rotate(anchorX * width, anchorY * height, rotation)
  const centerX = startCenterX + ax - nax
  const centerY = startCenterY + ay - nay

  return {
    x: Math.round(centerX - width / 2),
    y: Math.round(centerY - height / 2),
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function boundingRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** 여러 사각형을 정렬합니다. 하나만 주어지면 container(캔버스)를 기준으로 정렬합니다. */
export function alignRects<T extends Rect & { id: string }>(
  rects: readonly T[],
  mode: AlignMode,
  container: Rect,
): Record<string, { x?: number; y?: number }> {
  const frame = rects.length > 1 ? (boundingRect(rects) ?? container) : container
  const result: Record<string, { x?: number; y?: number }> = {}
  for (const r of rects) {
    switch (mode) {
      case 'left':
        result[r.id] = { x: frame.x }
        break
      case 'center':
        result[r.id] = { x: Math.round(frame.x + (frame.width - r.width) / 2) }
        break
      case 'right':
        result[r.id] = { x: frame.x + frame.width - r.width }
        break
      case 'top':
        result[r.id] = { y: frame.y }
        break
      case 'middle':
        result[r.id] = { y: Math.round(frame.y + (frame.height - r.height) / 2) }
        break
      case 'bottom':
        result[r.id] = { y: frame.y + frame.height - r.height }
        break
    }
  }
  return result
}
