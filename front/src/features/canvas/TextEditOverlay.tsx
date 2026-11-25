import { useEffect, useRef } from 'react'
import { updateElement } from '@/domain/projectOps'
import { elementFrameStyle, textBoxStyle, textContentStyle } from '@/features/elements/styles'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { TextElement } from '@/types/project'

function fitHeight(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

/** 캔버스 위에서 텍스트 내용을 직접 편집하는 입력 영역. 편집이 끝나면(언마운트) 내용을 한 번에 반영합니다. */
export function TextEditOverlay({ slideId, element }: { slideId: string; element: TextElement }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const elementId = element.id

  useEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    fitHeight(textarea)
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    return () => {
      const content = textarea.value
      useProjectStore
        .getState()
        .commit((project) =>
          updateElement(project, slideId, elementId, (el) =>
            el.type === 'text' && el.content !== content ? { ...el, content } : el,
          ),
        )
    }
  }, [slideId, elementId])

  // 편집 중에 글자 크기 등이 바뀌면 높이를 다시 맞춥니다.
  useEffect(() => {
    if (ref.current) fitHeight(ref.current)
  }, [element.style, element.position.width])

  return (
    <div
      style={{ ...elementFrameStyle(element.position), pointerEvents: 'auto', outline: '2px solid #2563EB' }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={textBoxStyle(element.style)}>
        <textarea
          ref={ref}
          defaultValue={element.content}
          aria-label="텍스트 내용"
          spellCheck={false}
          rows={1}
          onInput={(event) => fitHeight(event.currentTarget)}
          onBlur={() => {
            const editor = useEditorStore.getState()
            if (editor.editingTextId === elementId) editor.setEditingText(null)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') event.currentTarget.blur()
          }}
          style={{
            ...textContentStyle(element.style),
            fontFamily: element.style.fontFamily ?? 'inherit',
            display: 'block',
            width: '100%',
            margin: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            background: 'transparent',
            caretColor: element.style.color,
          }}
        />
      </div>
    </div>
  )
}
