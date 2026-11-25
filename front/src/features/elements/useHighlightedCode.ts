import { useEffect, useState } from 'react'
import { highlightCode, type CodeToken } from '@/features/code-editor/highlighter'

interface Highlighted {
  key: string
  lines: CodeToken[][]
}

/** 구문 강조 결과를 비동기로 가져옵니다. 준비되기 전에는 null을 돌려줍니다. */
export function useHighlightedCode(code: string, language: string, theme: string): CodeToken[][] | null {
  const key = `${language}\u0000${theme}\u0000${code}`
  const [result, setResult] = useState<Highlighted | null>(null)

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language, theme)
      .then((lines) => {
        if (!cancelled) setResult({ key, lines })
      })
      .catch((error) => console.error('구문 강조 실패', error))
    return () => {
      cancelled = true
    }
  }, [key, code, language, theme])

  // 내용이 바뀐 직후에는 이전 결과를 쓰지 않습니다.
  return result?.key === key ? result.lines : null
}
