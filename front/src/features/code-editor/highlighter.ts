// Shiki 기반 구문 강조. 필요한 언어·테마만 지연 로딩합니다.
import type { HighlighterCore } from 'shiki/core'
import { getCodeLanguage, getCodeTheme } from '@/domain/codeLanguages'

export interface CodeToken {
  content: string
  color?: string
  fontStyle?: 'italic' | 'bold'
}

type Loader = () => Promise<{ default: unknown }>

const LANGUAGE_LOADERS: Record<string, Loader> = {
  java: () => import('@shikijs/langs/java'),
  python: () => import('@shikijs/langs/python'),
  javascript: () => import('@shikijs/langs/javascript'),
  typescript: () => import('@shikijs/langs/typescript'),
  jsx: () => import('@shikijs/langs/jsx'),
  tsx: () => import('@shikijs/langs/tsx'),
  sql: () => import('@shikijs/langs/sql'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  json: () => import('@shikijs/langs/json'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  go: () => import('@shikijs/langs/go'),
  markdown: () => import('@shikijs/langs/markdown'),
}

const THEME_LOADERS: Record<string, Loader> = {
  'github-dark': () => import('@shikijs/themes/github-dark'),
  'github-light': () => import('@shikijs/themes/github-light'),
  'one-dark-pro': () => import('@shikijs/themes/one-dark-pro'),
  dracula: () => import('@shikijs/themes/dracula'),
  'vitesse-light': () => import('@shikijs/themes/vitesse-light'),
}

let highlighterPromise: Promise<HighlighterCore> | null = null
const loaded = new Map<string, Promise<void>>()

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ])
    return createHighlighterCore({ themes: [], langs: [], engine: createJavaScriptRegexEngine() })
  })()
  return highlighterPromise
}

function ensure(key: string, load: () => Promise<void>): Promise<void> {
  let pending = loaded.get(key)
  if (!pending) {
    pending = load().catch((error) => {
      loaded.delete(key)
      throw error
    })
    loaded.set(key, pending)
  }
  return pending
}

function plainLines(code: string): CodeToken[][] {
  return code.split('\n').map((line) => [{ content: line }])
}

/**
 * 코드를 줄 단위 토큰으로 변환합니다. 지원하지 않는 언어는 색 없이 그대로 돌려줍니다.
 * language·theme에는 CodeElement에 저장된 식별자를 그대로 넘깁니다.
 */
export async function highlightCode(code: string, language: string, theme: string): Promise<CodeToken[][]> {
  const lang = getCodeLanguage(language).shiki
  const themeId = getCodeTheme(theme).id
  const loadLang = LANGUAGE_LOADERS[lang]
  const loadTheme = THEME_LOADERS[themeId]
  if (!loadLang || !loadTheme) return plainLines(code)

  const highlighter = await getHighlighter()
  await Promise.all([
    ensure(`lang:${lang}`, async () => highlighter.loadLanguage((await loadLang()).default as never)),
    ensure(`theme:${themeId}`, async () => highlighter.loadTheme((await loadTheme()).default as never)),
  ])

  const lines = highlighter.codeToTokensBase(code, { lang, theme: themeId })
  return lines.map((line) =>
    line.map((token) => ({
      content: token.content,
      color: token.color,
      // Shiki FontStyle 비트 플래그: 1 = italic, 2 = bold
      fontStyle: token.fontStyle && token.fontStyle & 2 ? 'bold' : token.fontStyle && token.fontStyle & 1 ? 'italic' : undefined,
    })),
  )
}
