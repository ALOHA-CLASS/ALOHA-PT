import { memo } from 'react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSlideDisplayTitle, getSlideMaster, moveSlide } from '@/domain/projectOps'
import { SlideThumbnail } from '@/features/canvas/SlideThumbnail'
import { addSlideAfterActive, deleteSlideById, duplicateSlideById } from '@/features/editor/actions'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { AssetReference, CanvasConfig, PresentationProject, Slide, SlideMaster } from '@/types/project'

const THUMBNAIL_WIDTH = 168

interface ItemProps {
  slide: Slide
  index: number
  title: string
  active: boolean
  count: number
  canvas: CanvasConfig
  master: SlideMaster | undefined
  assets: readonly AssetReference[]
}

const SlideItem = memo(function SlideItem({ slide, index, title, active, count, canvas, master, assets }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id })
  const move = (offset: number) =>
    useProjectStore.getState().commit((project) => moveSlide(project, index, index + offset))

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative flex gap-2 rounded-lg p-1.5 pl-0', isDragging && 'z-10 opacity-70')}
      data-testid="slide-item"
    >
      <span className="w-6 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`슬라이드 ${index + 1}${title ? `: ${title}` : ''}`}
        aria-current={active}
        onClick={() => useEditorStore.getState().setActiveSlide(slide.id)}
        className={cn(
          'overflow-hidden rounded-md bg-white ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'ring-2 ring-primary',
        )}
      >
        <SlideThumbnail slide={slide} canvas={canvas} master={master} assets={assets} width={THUMBNAIL_WIDTH} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-xs"
            aria-label={`슬라이드 ${index + 1} 메뉴`}
            className="absolute top-2.5 right-2.5 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => duplicateSlideById(slide.id)}>
            <Copy /> 복제
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
            <ArrowUp /> 위로 이동
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => move(1)}>
            <ArrowDown /> 아래로 이동
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={count <= 1} onSelect={() => deleteSlideById(slide.id)}>
            <Trash2 /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
})

export function SlidePanel({ project, activeSlideId }: { project: PresentationProject; activeSlideId: string }) {
  // 키보드로는 슬라이드 메뉴의 위/아래 이동을 사용합니다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = project.slides.findIndex((slide) => slide.id === active.id)
    const to = project.slides.findIndex((slide) => slide.id === over.id)
    useProjectStore.getState().commit((current) => moveSlide(current, from, to))
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background" aria-label="슬라이드 목록">
      <div className="flex items-center gap-1.5 border-b p-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => addSlideAfterActive()}>
          <Plus /> 새 슬라이드
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="레이아웃을 골라 슬라이드 추가">
              레이아웃
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuLabel>레이아웃 선택</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {project.layouts.map((layout) => (
              <DropdownMenuItem key={layout.id} onSelect={() => addSlideAfterActive(layout.id)}>
                {layout.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={project.slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
            {project.slides.map((slide, index) => (
              <SlideItem
                key={slide.id}
                slide={slide}
                index={index}
                title={getSlideDisplayTitle(project, slide)}
                active={slide.id === activeSlideId}
                count={project.slides.length}
                canvas={project.canvas}
                master={getSlideMaster(project, slide)}
                assets={project.assetRefs}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </aside>
  )
}
