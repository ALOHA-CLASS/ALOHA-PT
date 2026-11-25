import { memo } from 'react'
import { SlideView } from '@/features/canvas/SlideView'
import type { AssetReference, CanvasConfig, Slide, SlideMaster } from '@/types/project'

interface Props {
  slide: Slide
  canvas: CanvasConfig
  master: SlideMaster | undefined
  assets: readonly AssetReference[]
  width: number
}

/** 지정한 너비에 맞춰 축소한 슬라이드 미리보기 */
export const SlideThumbnail = memo(function SlideThumbnail({ slide, canvas, master, assets, width }: Props) {
  const scale = width / canvas.width
  return (
    <div
      style={{ width, height: canvas.height * scale, overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}
      aria-hidden
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: canvas.width, height: canvas.height }}>
        <SlideView slide={slide} canvas={canvas} master={master} assets={assets} mode="thumbnail" />
      </div>
    </div>
  )
})
