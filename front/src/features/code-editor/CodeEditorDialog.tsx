import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CODE_LANGUAGES, CODE_THEMES, getCodeLanguage, getCodeTheme } from '@/domain/codeLanguages'
import { updateElement } from '@/domain/projectOps'
import { SelectField } from '@/features/inspector/fields'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { CodeElement, Slide } from '@/types/project'

const MonacoEditor = lazy(() => import('@/features/code-editor/MonacoEditor'))

function CodeEditorContent({ slideId, element }: { slideId: string; element: CodeElement }) {
  const [code, setCode] = useState(element.code)
  const [language, setLanguage] = useState(element.language)
  const [theme, setTheme] = useState(element.theme)

  const close = () => useEditorStore.getState().setEditingCode(null)
  const apply = () => {
    const codeTheme = getCodeTheme(theme)
    useProjectStore.getState().commit((project) =>
      updateElement(project, slideId, element.id, (el) => {
        if (el.type !== 'code') return el
        if (el.code === code && el.language === language && el.theme === codeTheme.id) return el
        // 테마를 바꾼 경우에만 배경·글자색을 테마 값으로 맞춥니다.
        const colors =
          el.theme === codeTheme.id ? {} : { backgroundColor: codeTheme.background, textColor: codeTheme.foreground }
        return { ...el, code, language, theme: codeTheme.id, ...colors }
      }),
    )
    close()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="flex h-[min(80vh,720px)] flex-col gap-3 sm:max-w-4xl"
        showCloseButton={false}
        // 편집 중인 내용을 실수로 잃지 않도록 Esc·바깥 클릭으로는 닫지 않습니다.
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>코드 편집</DialogTitle>
          <DialogDescription className="sr-only">
            코드를 편집한 뒤 적용을 누르면 슬라이드에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">언어</span>
          <div className="flex w-40">
            <SelectField
              ariaLabel="코드 언어"
              value={language}
              options={CODE_LANGUAGES.map((item) => ({ value: item.id, label: item.label }))}
              onChange={setLanguage}
            />
          </div>
          <span className="ml-2 text-xs text-muted-foreground">테마</span>
          <div className="flex w-40">
            <SelectField
              ariaLabel="코드 테마"
              value={theme}
              options={CODE_THEMES.map((item) => ({ value: item.id, label: item.label }))}
              onChange={setTheme}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          <Suspense
            fallback={
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                편집기를 불러오는 중…
              </div>
            }
          >
            <MonacoEditor
              initialValue={element.code}
              language={getCodeLanguage(language).monaco}
              theme={getCodeTheme(theme).monaco}
              tabSize={element.tabSize ?? 4}
              onChange={setCode}
              onSubmit={apply}
            />
          </Suspense>
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">Ctrl + Enter로 적용</span>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button onClick={apply}>적용</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 선택한 코드 요소를 Monaco Editor로 편집하는 대화상자 */
export function CodeEditorDialog({ slide }: { slide: Slide }) {
  const editingCodeId = useEditorStore((state) => state.editingCodeId)
  const element = slide.elements.find((el) => el.id === editingCodeId)
  if (!element || element.type !== 'code') return null
  return <CodeEditorContent key={element.id} slideId={slide.id} element={element} />
}
