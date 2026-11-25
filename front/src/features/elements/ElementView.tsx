import { memo } from 'react'
import { CodeElementView } from '@/features/elements/CodeElementView'
import { ImageElementView } from '@/features/elements/ImageElementView'
import { ShapeElementView } from '@/features/elements/ShapeElementView'
import { TextElementView } from '@/features/elements/TextElementView'
import type { RenderMode } from '@/features/elements/types'
import type { AssetReference, SlideElement } from '@/types/project'

interface Props {
  element: SlideElement
  assets: readonly AssetReference[]
  mode: RenderMode
}

/** 요소 타입에 맞는 렌더러를 고릅니다. 요소 영역(100% × 100%)을 채우는 내용만 그립니다. */
export const ElementView = memo(function ElementView({ element, assets, mode }: Props) {
  switch (element.type) {
    case 'text':
      return <TextElementView element={element} mode={mode} />
    case 'shape':
      return <ShapeElementView element={element} />
    case 'image':
      return <ImageElementView element={element} assets={assets} mode={mode} />
    case 'code':
      return <CodeElementView element={element} mode={mode} />
  }
})
