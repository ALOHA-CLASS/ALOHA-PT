import { Fragment } from 'react'
import type { CodeToken } from '@/features/code-editor/highlighter'
import type { RenderMode } from '@/features/elements/types'
import { useHighlightedCode } from '@/features/elements/useHighlightedCode'
import type { CodeElement } from '@/types/project'

export function CodeElementView({ element, mode }: { element: CodeElement; mode: RenderMode }) {
  const highlighted = useHighlightedCode(element.code, element.language, element.theme)
  const lines: CodeToken[][] = highlighted ?? element.code.split('\n').map((line) => [{ content: line }])
  const empty = element.code.length === 0

  return (
    <div
      // 내보내기에서 구문 강조가 끝났는지 확인하는 데 씁니다.
      data-code-pending={highlighted ? undefined : ''}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        // 발표 중에는 넘치는 코드를 스크롤로 볼 수 있게 하고, 편집·미리보기에서는 잘라냅니다.
        overflow: mode === 'present' ? 'auto' : 'hidden',
        backgroundColor: element.backgroundColor,
        color: element.textColor,
        padding: element.padding,
        borderRadius: element.borderRadius,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        lineHeight: element.lineHeight ?? 1.5,
        tabSize: element.tabSize ?? 4,
        textAlign: 'left',
      }}
    >
      {empty && mode === 'edit' ? (
        <span style={{ opacity: 0.5 }}>더블클릭하여 코드 입력</span>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: element.showLineNumbers ? 'max-content minmax(0, 1fr)' : 'minmax(0, 1fr)',
            columnGap: '1.2em',
          }}
        >
          {lines.map((tokens, index) => (
            <Fragment key={index}>
              {element.showLineNumbers && (
                <span style={{ textAlign: 'right', opacity: 0.45, userSelect: 'none' }}>{index + 1}</span>
              )}
              <span
                style={
                  element.wordWrap
                    ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
                    : { whiteSpace: 'pre' }
                }
              >
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={tokenIndex}
                    style={{
                      color: token.color,
                      fontStyle: token.fontStyle === 'italic' ? 'italic' : undefined,
                      fontWeight: token.fontStyle === 'bold' ? 'bold' : undefined,
                    }}
                  >
                    {token.content}
                  </span>
                ))}
                {tokens.every((token) => token.content.length === 0) && '​'}
              </span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
