// Monaco Editor 래퍼. 용량이 크므로 코드 편집 대화상자를 열 때만 동적으로 불러옵니다.
import { useEffect, useRef } from 'react'
import { editor } from 'monaco-editor/editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'

// 편집 기능: 필요한 것만 등록해 번들 크기를 줄입니다.
import 'monaco-editor/features/bracketMatching/register.js'
import 'monaco-editor/features/caretOperations/register.js'
import 'monaco-editor/features/clipboard/register.js'
import 'monaco-editor/features/comment/register.js'
import 'monaco-editor/features/contextmenu/register.js'
import 'monaco-editor/features/cursorUndo/register.js'
import 'monaco-editor/features/find/register.js'
import 'monaco-editor/features/folding/register.js'
import 'monaco-editor/features/indentation/register.js'
import 'monaco-editor/features/lineSelection/register.js'
import 'monaco-editor/features/linesOperations/register.js'
import 'monaco-editor/features/multicursor/register.js'
import 'monaco-editor/features/smartSelect/register.js'
import 'monaco-editor/features/wordHighlighter/register.js'
import 'monaco-editor/features/wordOperations/register.js'

// 언어: src/domain/codeLanguages.ts의 monaco ID와 맞춥니다.
import 'monaco-editor/languages/definitions/cpp/register.js'
import 'monaco-editor/languages/definitions/csharp/register.js'
import 'monaco-editor/languages/definitions/css/register.js'
import 'monaco-editor/languages/definitions/go/register.js'
import 'monaco-editor/languages/definitions/html/register.js'
import 'monaco-editor/languages/definitions/java/register.js'
import 'monaco-editor/languages/definitions/javascript/register.js'
import 'monaco-editor/languages/definitions/kotlin/register.js'
import 'monaco-editor/languages/definitions/markdown/register.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/shell/register.js'
import 'monaco-editor/languages/definitions/sql/register.js'
import 'monaco-editor/languages/definitions/typescript/register.js'
import 'monaco-editor/languages/definitions/xml/register.js'
import 'monaco-editor/languages/definitions/yaml/register.js'
import 'monaco-editor/languages/features/json/register.js'

// Worker는 CDN이 아니라 번들에 포함된 로컬 파일을 사용합니다.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    return label === 'json' ? new JsonWorker() : new EditorWorker()
  },
}

export interface MonacoEditorProps {
  initialValue: string
  language: string
  theme: 'vs' | 'vs-dark'
  tabSize: number
  onChange(value: string): void
  /** Ctrl/Cmd + Enter */
  onSubmit(): void
}

export default function MonacoEditor({ initialValue, language, theme, tabSize, onChange, onSubmit }: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const callbacks = useRef({ onChange, onSubmit })
  useEffect(() => {
    callbacks.current = { onChange, onSubmit }
  }, [onChange, onSubmit])
  const initial = useRef({ value: initialValue, language, theme, tabSize })

  useEffect(() => {
    if (!hostRef.current) return
    const instance = editor.create(hostRef.current, {
      value: initial.current.value,
      language: initial.current.language,
      theme: initial.current.theme,
      tabSize: initial.current.tabSize,
      insertSpaces: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 15,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      fixedOverflowWidgets: true,
      padding: { top: 12, bottom: 12 },
    })
    const model = instance.getModel()
    model?.setEOL(editor.EndOfLineSequence.LF)
    const subscription = instance.onDidChangeModelContent(() => {
      callbacks.current.onChange(instance.getValue().replace(/\r\n/g, '\n'))
    })
    // 2048 = KeyMod.CtrlCmd, 3 = KeyCode.Enter
    instance.addCommand(2048 | 3, () => callbacks.current.onSubmit())
    instance.focus()
    editorRef.current = instance
    return () => {
      subscription.dispose()
      instance.dispose()
      model?.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) editor.setModelLanguage(model, language)
  }, [language])

  useEffect(() => {
    editor.setTheme(theme)
  }, [theme])

  return <div ref={hostRef} className="size-full" data-testid="monaco-editor" />
}
