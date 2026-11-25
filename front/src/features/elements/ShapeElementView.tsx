import type { ShapeElement } from '@/types/project'

export function ShapeElementView({ element }: { element: ShapeElement }) {
  const { width: w, height: h } = element.position
  const { fill, stroke, strokeWidth: sw, opacity, borderRadius } = element.style
  const common = { fill, stroke, strokeWidth: sw }
  const midY = h / 2

  let shape
  switch (element.shape) {
    case 'rectangle':
    case 'roundedRectangle':
      // 테두리가 요소 영역 밖으로 나가지 않도록 선 두께의 절반만큼 안쪽에 그립니다.
      shape = (
        <rect
          x={sw / 2}
          y={sw / 2}
          width={Math.max(0, w - sw)}
          height={Math.max(0, h - sw)}
          rx={element.shape === 'roundedRectangle' ? (borderRadius ?? 16) : 0}
          {...common}
        />
      )
      break
    case 'ellipse':
      shape = (
        <ellipse cx={w / 2} cy={midY} rx={Math.max(0, (w - sw) / 2)} ry={Math.max(0, (h - sw) / 2)} {...common} />
      )
      break
    case 'line':
      shape = <line x1={0} y1={midY} x2={w} y2={midY} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      break
    case 'arrow': {
      const headLength = Math.min(w, Math.max(12, sw * 3.5))
      const headHalf = Math.max(6, sw * 2)
      shape = (
        <>
          <line x1={0} y1={midY} x2={w - headLength} y2={midY} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <polygon
            points={`${w},${midY} ${w - headLength},${midY - headHalf} ${w - headLength},${midY + headHalf}`}
            fill={stroke}
          />
        </>
      )
      break
    }
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', overflow: 'visible', opacity: opacity ?? 1 }}
      aria-hidden
    >
      {shape}
    </svg>
  )
}
