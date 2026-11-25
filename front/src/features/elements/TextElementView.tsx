import { textBoxStyle, textContentStyle } from '@/features/elements/styles'
import type { RenderMode } from '@/features/elements/types'
import type { TextElement } from '@/types/project'

export function TextElementView({ element, mode }: { element: TextElement; mode: RenderMode }) {
  const empty = element.content.length === 0
  return (
    <div style={textBoxStyle(element.style)}>
      <div style={textContentStyle(element.style)}>
        {empty && mode === 'edit' ? (
          <span style={{ opacity: 0.4 }}>더블클릭하여 {element.name ?? '텍스트'} 입력</span>
        ) : (
          element.content
        )}
      </div>
    </div>
  )
}
