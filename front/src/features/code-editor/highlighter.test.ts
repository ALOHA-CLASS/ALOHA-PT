import { describe, expect, it } from 'vitest'
import { CODE_LANGUAGES, CODE_THEMES } from '@/domain/codeLanguages'
import { highlightCode } from '@/features/code-editor/highlighter'

const SAMPLES: Record<string, string> = {
  java: 'public class Hello {\n    int count = 1; // 주석\n}',
  python: 'def greet(name):\n    return f"hi {name}"  # 주석',
  javascript: 'const add = (a, b) => a + b; // 주석',
  typescript: 'function id<T>(value: T): T { return value }',
  sql: "SELECT id, name FROM users WHERE name = 'kim';",
}

function colorsOf(lines: Awaited<ReturnType<typeof highlightCode>>): Set<string> {
  return new Set(lines.flat().flatMap((t) => (t.color ? [t.color.toLowerCase()] : [])))
}

describe('highlightCode', () => {
  it.each(Object.entries(SAMPLES))('%s 코드를 여러 색의 토큰으로 강조한다', async (language, code) => {
    const lines = await highlightCode(code, language, 'github-dark')
    expect(lines).toHaveLength(code.split('\n').length)
    expect(lines.map((line) => line.map((t) => t.content).join('')).join('\n')).toBe(code)
    expect(colorsOf(lines).size).toBeGreaterThanOrEqual(3)
  })

  it('테마에 따라 색이 달라진다', async () => {
    const dark = colorsOf(await highlightCode(SAMPLES.java, 'java', 'github-dark'))
    const light = colorsOf(await highlightCode(SAMPLES.java, 'java', 'github-light'))
    expect([...dark].sort()).not.toEqual([...light].sort())
  })

  it('등록된 모든 언어와 테마를 오류 없이 처리한다', async () => {
    for (const language of CODE_LANGUAGES) {
      const lines = await highlightCode('a = 1\nb = 2', language.id, 'github-dark')
      expect(lines).toHaveLength(2)
    }
    for (const theme of CODE_THEMES) {
      const lines = await highlightCode(SAMPLES.sql, 'sql', theme.id)
      expect(colorsOf(lines).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('알 수 없는 언어는 일반 텍스트로 돌려준다', async () => {
    const lines = await highlightCode('hello\nworld', 'brainfuck', 'github-dark')
    expect(lines).toEqual([[{ content: 'hello' }], [{ content: 'world' }]])
  })
})
