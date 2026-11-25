import { ElementInspector } from '@/features/inspector/ElementInspector'
import { SlideInspector } from '@/features/inspector/SlideInspector'
import { useEditorStore } from '@/stores/editorStore'
import type { PresentationProject, Slide } from '@/types/project'

export function Inspector({ project, slide }: { project: PresentationProject; slide: Slide }) {
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const selected = slide.elements.filter((element) => selectedIds.includes(element.id))

  return (
    <aside
      className="flex w-80 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-l bg-background"
      aria-label="속성"
      data-testid="inspector"
    >
      {selected.length > 0 ? (
        // 선택이 바뀌면 입력 중이던 임시 값을 버리도록 key를 줍니다.
        <ElementInspector key={selected.map((el) => el.id).join(',')} project={project} slide={slide} elements={selected} />
      ) : (
        <SlideInspector key={slide.id} project={project} slide={slide} />
      )}
    </aside>
  )
}
