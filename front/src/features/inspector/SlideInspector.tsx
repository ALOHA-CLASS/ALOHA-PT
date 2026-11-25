import { ArrowDown, ArrowUp, Code2, Eye, EyeOff, Image, Lock, LockOpen, Shapes, Type, X } from 'lucide-react'
import { sortAnimations } from '@/domain/animations'
import {
  applyLayout,
  getSlideDisplayTitle,
  setActiveTheme,
  setAnimations,
  updateElement,
  updateSlide,
  type SlidePatch,
} from '@/domain/projectOps'
import { ColorField, IconToggle, NumberField, Row, Section, SelectField } from '@/features/inspector/fields'
import { EFFECT_LABELS, elementLabel, TRIGGER_LABELS } from '@/features/inspector/labels'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { ElementType, PresentationProject, Slide, SlideTransitionType } from '@/types/project'

const TYPE_ICONS: Record<ElementType, typeof Type> = { text: Type, shape: Shapes, image: Image, code: Code2 }

const TRANSITION_OPTIONS: { value: SlideTransitionType; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'fade', label: '페이드' },
  { value: 'slide', label: '밀어내기' },
]

const inputClass =
  'min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'

const commit = useProjectStore.getState().commit

function LayerList({ slide }: { slide: Slide }) {
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const layers = [...slide.elements].sort((a, b) => b.position.zIndex - a.position.zIndex)
  const toggle = (elementId: string, key: 'visible' | 'locked') =>
    commit((project) => updateElement(project, slide.id, elementId, (el) => ({ ...el, [key]: !el[key] })))

  if (layers.length === 0) {
    return <p className="text-xs text-muted-foreground">요소가 없습니다. 위쪽 도구 모음에서 요소를 추가하세요.</p>
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {layers.map((element) => {
        const Icon = TYPE_ICONS[element.type]
        return (
          <li
            key={element.id}
            className={cn(
              'flex h-7 items-center rounded-md pl-1.5 text-xs hover:bg-muted',
              selectedIds.includes(element.id) && 'bg-muted font-medium',
            )}
          >
            <button
              type="button"
              className={cn(
                'flex h-full min-w-0 flex-1 items-center gap-1.5 text-left outline-none',
                !element.visible && 'text-muted-foreground line-through',
              )}
              onClick={() => useEditorStore.getState().select([element.id])}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{elementLabel(element)}</span>
            </button>
            <IconToggle
              label={element.visible ? '숨기기' : '표시'}
              pressed={!element.visible}
              onClick={() => toggle(element.id, 'visible')}
            >
              {element.visible ? <Eye /> : <EyeOff />}
            </IconToggle>
            <IconToggle
              label={element.locked ? '잠금 해제' : '잠금'}
              pressed={element.locked}
              onClick={() => toggle(element.id, 'locked')}
            >
              {element.locked ? <Lock /> : <LockOpen />}
            </IconToggle>
          </li>
        )
      })}
    </ul>
  )
}

function AnimationOrder({ slide }: { slide: Slide }) {
  const animations = sortAnimations(slide.animations)
  if (animations.length === 0) return null

  const move = (index: number, offset: number) => {
    const next = [...animations]
    const [moved] = next.splice(index, 1)
    next.splice(index + offset, 0, moved)
    commit((project) => setAnimations(project, slide.id, next))
  }
  const remove = (id: string) =>
    commit((project) =>
      setAnimations(
        project,
        slide.id,
        animations.filter((animation) => animation.id !== id),
      ),
    )

  return (
    <Section title="애니메이션 순서">
      <ol className="flex flex-col gap-0.5">
        {animations.map((animation, index) => {
          const element = slide.elements.find((el) => el.id === animation.elementId)
          return (
            <li key={animation.id} className="flex min-h-9 items-center gap-1.5 rounded-md pl-1.5 text-xs hover:bg-muted">
              <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{index + 1}</span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left outline-none"
                onClick={() => element && useEditorStore.getState().select([element.id])}
              >
                <span className="block truncate">{element ? elementLabel(element) : '(삭제된 요소)'}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {EFFECT_LABELS[animation.effect]} · {TRIGGER_LABELS[animation.trigger]}
                </span>
              </button>
              <IconToggle label="먼저 재생" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </IconToggle>
              <IconToggle label="나중에 재생" disabled={index === animations.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </IconToggle>
              <IconToggle label="애니메이션 제거" onClick={() => remove(animation.id)}>
                <X />
              </IconToggle>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

/** 요소를 선택하지 않았을 때 보이는 슬라이드·프로젝트 속성 */
export function SlideInspector({ project, slide }: { project: PresentationProject; slide: Slide }) {
  const patch = (value: SlidePatch, key: string) =>
    commit((current) => updateSlide(current, slide.id, value), `slide:${key}`)
  const transition = slide.transition ?? { type: 'none' as const, duration: 400 }

  return (
    <>
      <Section title="슬라이드">
        <Row label="제목">
          <input
            aria-label="슬라이드 제목"
            className={cn(inputClass, 'h-7')}
            value={slide.title}
            maxLength={200}
            placeholder={getSlideDisplayTitle(project, slide) || '제목 없음'}
            onChange={(event) => patch({ title: event.target.value }, 'title')}
          />
        </Row>
        <Row label="레이아웃">
          <SelectField
            ariaLabel="슬라이드 레이아웃"
            value={slide.layoutId ?? ''}
            options={[
              ...(slide.layoutId ? [] : [{ value: '', label: '선택 안 함' }]),
              ...project.layouts.map((layout) => ({ value: layout.id, label: layout.name })),
            ]}
            onChange={(layoutId) => {
              if (layoutId) commit((current) => applyLayout(current, slide.id, layoutId))
            }}
          />
        </Row>
        <Row label="배경색">
          <ColorField
            ariaLabel="슬라이드 배경색"
            value={slide.background?.color}
            onChange={(color) => patch({ background: { ...slide.background, color } }, 'background')}
            onClear={() => patch({ background: undefined }, 'background')}
          />
        </Row>
        <Row label="전환 효과">
          <SelectField
            ariaLabel="슬라이드 전환 효과"
            value={transition.type}
            options={TRANSITION_OPTIONS}
            onChange={(type) => patch({ transition: { ...transition, type } }, 'transition')}
          />
        </Row>
        {transition.type !== 'none' && (
          <Row label="전환 시간">
            <NumberField
              ariaLabel="전환 시간"
              suffix="ms"
              value={transition.duration}
              min={0}
              max={5000}
              step={50}
              onChange={(duration) => patch({ transition: { ...transition, duration } }, 'transitionDuration')}
            />
          </Row>
        )}
      </Section>

      <Section title="테마">
        <Row label="테마">
          <SelectField
            ariaLabel="프로젝트 테마"
            value={project.activeThemeId}
            options={project.themes.map((theme) => ({ value: theme.id, label: theme.name }))}
            onChange={(themeId) => commit((current) => setActiveTheme(current, themeId))}
          />
        </Row>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          테마를 바꾸면 테마 색과 글꼴을 쓰는 요소가 모든 슬라이드에서 함께 바뀝니다.
        </p>
      </Section>

      <Section title="발표자 노트">
        <textarea
          aria-label="발표자 노트"
          className={cn(inputClass, 'min-h-24 resize-y py-1.5 leading-relaxed')}
          value={slide.speakerNotes ?? ''}
          maxLength={20000}
          placeholder="이 슬라이드에서 말할 내용을 적어 두세요."
          onChange={(event) => patch({ speakerNotes: event.target.value }, 'notes')}
        />
      </Section>

      <Section title="레이어">
        <LayerList slide={slide} />
      </Section>

      <AnimationOrder slide={slide} />
    </>
  )
}
