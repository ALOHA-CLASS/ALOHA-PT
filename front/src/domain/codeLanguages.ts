// 코드 요소의 언어·테마 식별자를 Monaco와 Shiki 양쪽에 연결하는 공통 매핑 계층.

export interface CodeLanguage {
  id: string // CodeElement.language에 저장되는 값
  label: string
  monaco: string
  shiki: string
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { id: 'java', label: 'Java', monaco: 'java', shiki: 'java' },
  { id: 'python', label: 'Python', monaco: 'python', shiki: 'python' },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', shiki: 'javascript' },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', shiki: 'typescript' },
  { id: 'jsx', label: 'JSX', monaco: 'javascript', shiki: 'jsx' },
  { id: 'tsx', label: 'TSX', monaco: 'typescript', shiki: 'tsx' },
  { id: 'sql', label: 'SQL', monaco: 'sql', shiki: 'sql' },
  { id: 'html', label: 'HTML', monaco: 'html', shiki: 'html' },
  { id: 'css', label: 'CSS', monaco: 'css', shiki: 'css' },
  { id: 'json', label: 'JSON', monaco: 'json', shiki: 'json' },
  { id: 'xml', label: 'XML', monaco: 'xml', shiki: 'xml' },
  { id: 'yaml', label: 'YAML', monaco: 'yaml', shiki: 'yaml' },
  { id: 'bash', label: 'Bash', monaco: 'shell', shiki: 'bash' },
  { id: 'c', label: 'C', monaco: 'c', shiki: 'c' },
  { id: 'cpp', label: 'C++', monaco: 'cpp', shiki: 'cpp' },
  { id: 'csharp', label: 'C#', monaco: 'csharp', shiki: 'csharp' },
  { id: 'kotlin', label: 'Kotlin', monaco: 'kotlin', shiki: 'kotlin' },
  { id: 'go', label: 'Go', monaco: 'go', shiki: 'go' },
  { id: 'markdown', label: 'Markdown', monaco: 'markdown', shiki: 'markdown' },
  { id: 'plaintext', label: '일반 텍스트', monaco: 'plaintext', shiki: 'text' },
]

export interface CodeTheme {
  id: string // CodeElement.theme에 저장되는 값 (Shiki 테마 ID)
  label: string
  monaco: 'vs' | 'vs-dark'
  background: string
  foreground: string
}

export const CODE_THEMES: CodeTheme[] = [
  { id: 'github-dark', label: 'GitHub Dark', monaco: 'vs-dark', background: '#24292E', foreground: '#E1E4E8' },
  { id: 'github-light', label: 'GitHub Light', monaco: 'vs', background: '#FFFFFF', foreground: '#24292E' },
  { id: 'one-dark-pro', label: 'One Dark Pro', monaco: 'vs-dark', background: '#282C34', foreground: '#ABB2BF' },
  { id: 'dracula', label: 'Dracula', monaco: 'vs-dark', background: '#282A36', foreground: '#F8F8F2' },
  { id: 'vitesse-light', label: 'Vitesse Light', monaco: 'vs', background: '#FFFFFF', foreground: '#393A34' },
]

export const DEFAULT_CODE_LANGUAGE = 'java'
export const DEFAULT_CODE_THEME = 'github-dark'

export function getCodeLanguage(id: string): CodeLanguage {
  return CODE_LANGUAGES.find((l) => l.id === id) ?? CODE_LANGUAGES[CODE_LANGUAGES.length - 1]
}

export function getCodeTheme(id: string): CodeTheme {
  return CODE_THEMES.find((t) => t.id === id) ?? CODE_THEMES[0]
}
