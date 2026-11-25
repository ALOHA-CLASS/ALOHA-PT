import { memo, type ReactNode } from 'react'
import { ElementView } from '@/features/elements/ElementView'
import { elementFrameStyle, sortByZIndex } from '@/features/elements/styles'
import type { RenderMode } from '@/features/elements/types'
import { useAssetUrl } from '@/features/elements/useAssetUrl'
import type {
  AssetReference,
  CanvasConfig,
  Slide,
  SlideElement,
  SlideMaster,
} from '@/types/project'

export interface SlideViewProps {
  slide: Slide
  canvas: CanvasConfig
  master: SlideMaster | undefined
  assets: readonly AssetReference[]
  mode: RenderMode
  /** 그리지 않을 요소 (예: 캔버스에서 직접 편집 중인 텍스트) */
  hiddenElementIds?: ReadonlySet<string>
  /** 요소 내용을 감싸는 래퍼. 발표 모드의 애니메이션에 사용합니다. */
  wrapElement?: (element: SlideElement, content: ReactNode) => ReactNode
}

/**
 * 슬라이드 한 장을 캔버스 논리 좌표(기본 1280×720) 그대로 그립니다.
 * 화면 배율은 바깥에서 CSS transform으로 적용합니다.
 */
export const SlideView = memo(function SlideView({
  slide,
  canvas,
  master,
  assets,
  mode,
  hiddenElementIds,
  wrapElement,
}: SlideViewProps) {
  const background = slide.background ?? master?.background
  const backgroundUrl = useAssetUrl(assets, background?.assetId)

  return (
    <div
      style={{
        position: 'relative',
        width: canvas.width,
        height: canvas.height,
        overflow: 'hidden',
        backgroundColor: background?.color ?? canvas.backgroundColor,
        backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
        backgroundSize: background?.fit === 'fill' ? '100% 100%' : (background?.fit ?? 'cover'),
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {master &&
        sortByZIndex(master.elements).map((element) =>
          element.visible ? (
            <div key={element.id} style={elementFrameStyle(element.position)}>
              <ElementView element={element} assets={assets} mode={mode === 'edit' ? 'thumbnail' : mode} />
            </div>
          ) : null,
        )}
      {sortByZIndex(slide.elements).map((element) => {
        if (!element.visible || hiddenElementIds?.has(element.id)) return null
        const content = <ElementView element={element} assets={assets} mode={mode} />
        return (
          <div key={element.id} style={elementFrameStyle(element.position)}>
            {wrapElement ? wrapElement(element, content) : content}
          </div>
        )
      })}
    </div>
  )
})
