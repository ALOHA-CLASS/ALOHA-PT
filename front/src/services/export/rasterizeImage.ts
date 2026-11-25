// 이미지를 요소 크기에 맞춰 PNG로 다시 그립니다 (브라우저 전용).
import type { ImageFit } from '@/types/project'

export interface RasterizeOptions {
  /** 결과 이미지의 논리 크기 (px) */
  width: number
  height: number
  fit: ImageFit
  opacity?: number
  borderRadius?: number
  backgroundColor?: string
}

export type RasterizeImage = (blob: Blob, options: RasterizeOptions) => Promise<string>

const MAX_PIXELS = 4096

function loadImage(blob: Blob): Promise<{ image: HTMLImageElement; release(): void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(url) })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽을 수 없습니다.'))
    }
    image.src = url
  })
}

/** object-fit과 같은 규칙으로 원본이 그려질 영역을 계산합니다. */
export function fitRect(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: ImageFit,
): { x: number; y: number; width: number; height: number } {
  if (fit === 'fill' || sourceWidth <= 0 || sourceHeight <= 0) return { x: 0, y: 0, width: boxWidth, height: boxHeight }
  const scaleX = boxWidth / sourceWidth
  const scaleY = boxHeight / sourceHeight
  const scale = fit === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height }
}

export const rasterizeImage: RasterizeImage = async (blob, options) => {
  const { image, release } = await loadImage(blob)
  try {
    const { width, height } = options
    // 선명하게 보이도록 2배로 그리되, 지나치게 큰 캔버스는 만들지 않습니다.
    const ratio = Math.min(2, MAX_PIXELS / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('캔버스를 만들 수 없습니다.')
    context.scale(canvas.width / width, canvas.height / height)

    if (options.borderRadius) {
      const radius = Math.min(options.borderRadius, width / 2, height / 2)
      context.beginPath()
      context.roundRect(0, 0, width, height, radius)
      context.clip()
    }
    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor
      context.fillRect(0, 0, width, height)
    }
    context.globalAlpha = Math.min(1, Math.max(0, options.opacity ?? 1))
    const target = fitRect(image.naturalWidth || width, image.naturalHeight || height, width, height, options.fit)
    // 캔버스 밖으로 나가는 부분(cover)은 캔버스 경계에서 잘립니다.
    context.drawImage(image, target.x, target.y, target.width, target.height)
    return canvas.toDataURL('image/png')
  } finally {
    release()
  }
}
