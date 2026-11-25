import { ImageIcon } from 'lucide-react'
import type { RenderMode } from '@/features/elements/types'
import { useAssetUrl } from '@/features/elements/useAssetUrl'
import type { AssetReference, ImageElement } from '@/types/project'

interface Props {
  element: ImageElement
  assets: readonly AssetReference[]
  mode: RenderMode
}

export function ImageElementView({ element, assets, mode }: Props) {
  // 로컬 Asset 참조를 외부 URL보다 우선합니다.
  const assetUrl = useAssetUrl(assets, element.assetId)
  const src = element.assetId ? assetUrl : element.sourceUrl

  if (!src) {
    if (mode === 'present') return null
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed #94A3B8',
          borderRadius: element.borderRadius,
          color: '#94A3B8',
          background: 'rgba(148, 163, 184, 0.12)',
        }}
      >
        <ImageIcon size={32} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={element.alt}
      draggable={false}
      referrerPolicy="no-referrer"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: element.fit,
        opacity: element.opacity ?? 1,
        borderRadius: element.borderRadius,
        userSelect: 'none',
      }}
    />
  )
}
