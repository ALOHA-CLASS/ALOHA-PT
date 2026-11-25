import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { getElementAnimationState, planAnimations, type ElementAnimationState } from '@/domain/animations'
import { fitScale } from '@/domain/geometry'
import { getSlideMaster } from '@/domain/projectOps'
import { SlideView } from '@/features/canvas/SlideView'
import { resolveElementMotion } from '@/features/presentation/poses'
import { useEditorStore } from '@/stores/editorStore'
import type { PresentationProject, Slide, SlideElement, SlideTransition } from '@/types/project'

interface Position {
  /** 슬라이드 인덱스. 슬라이드 수와 같으면 발표 종료 화면입니다. */
  index: number
  /** 현재 슬라이드에서 진행한 클릭 수 */
  step: number
  /** true이면 애니메이션·전환 없이 바로 표시합니다 (뒤로 이동 등). */
  instant: boolean
}

const NO_TRANSITION: SlideTransition = { type: 'none', duration: 0 }

const slideVariants = {
  enter: (transition: SlideTransition) =>
    transition.type === 'fade' ? { opacity: 0, x: '0%' } : transition.type === 'slide' ? { opacity: 1, x: '100%' } : {},
  center: (transition: SlideTransition) => ({
    opacity: 1,
    x: '0%',
    transition: { duration: transition.duration / 1000, ease: 'easeInOut' as const },
  }),
  exit: (transition: SlideTransition) => ({
    opacity: transition.type === 'slide' ? 1 : 0,
    x: transition.type === 'slide' ? '-100%' : '0%',
    transition: { duration: transition.type === 'none' ? 0 : transition.duration / 1000, ease: 'easeInOut' as const },
  }),
}

function AnimatedElement({
  state,
  step,
  instant,
  children,
}: {
  state: ElementAnimationState
  step: number
  instant: boolean
  children: ReactNode
}) {
  const { initial, target, duration, delay } = resolveElementMotion(state, step, instant)
  return (
    <motion.div
      initial={initial ?? false}
      animate={{ ...target, transition: { duration, delay, ease: 'easeOut' } }}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  )
}

function PresentedSlide({
  project,
  slide,
  step,
  instant,
}: {
  project: PresentationProject
  slide: Slide
  step: number
  instant: boolean
}) {
  const plan = useMemo(() => planAnimations(slide), [slide])
  const wrapElement = useCallback(
    (element: SlideElement, content: ReactNode) => {
      const state = getElementAnimationState(plan, element.id, step)
      if (!state) return content
      return (
        <AnimatedElement state={state} step={step} instant={instant}>
          {content}
        </AnimatedElement>
      )
    },
    [plan, step, instant],
  )
  return (
    <SlideView
      slide={slide}
      canvas={project.canvas}
      master={getSlideMaster(project, slide)}
      assets={project.assetRefs}
      mode="present"
      wrapElement={wrapElement}
    />
  )
}

function useViewportScale(width: number, height: number): number {
  const [scale, setScale] = useState(() => fitScale(window.innerWidth, window.innerHeight, width, height))
  useEffect(() => {
    const update = () => setScale(fitScale(window.innerWidth, window.innerHeight, width, height))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [width, height])
  return scale
}

/** 전체 화면 발표 모드. 클릭·키보드로 애니메이션 단계와 슬라이드를 넘깁니다. */
export function PresentationView({ project, startIndex }: { project: PresentationProject; startIndex: number }) {
  const { slides, canvas } = project
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>(() => ({
    index: Math.min(Math.max(0, startIndex), slides.length - 1),
    step: 0,
    instant: false,
  }))
  const scale = useViewportScale(canvas.width, canvas.height)
  const slide: Slide | undefined = slides[position.index]
  const ended = position.index >= slides.length

  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const exit = useCallback(() => {
    const editor = useEditorStore.getState()
    const current = slides[Math.min(positionRef.current.index, slides.length - 1)]
    editor.setPresentingFrom(null)
    if (current) editor.setActiveSlide(current.id)
  }, [slides])

  const next = useCallback(() => {
    setPosition((current) => {
      if (current.index >= slides.length) return current
      const stepCount = planAnimations(slides[current.index]).stepCount
      if (current.step < stepCount) return { ...current, step: current.step + 1, instant: false }
      return { index: current.index + 1, step: 0, instant: false }
    })
  }, [slides])

  const previous = useCallback(() => {
    setPosition((current) => {
      if (current.index < slides.length && current.step > 0) return { ...current, step: current.step - 1, instant: true }
      if (current.index === 0) return current
      const index = current.index - 1
      return { index, step: planAnimations(slides[index]).stepCount, instant: true }
    })
  }, [slides])

  const jump = useCallback(
    (index: number) => {
      setPosition({ index, step: index === slides.length - 1 ? planAnimations(slides[index]).stepCount : 0, instant: true })
    },
    [slides],
  )

  // 키보드 조작
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // 조작 버튼에 포커스가 있을 때 Enter·Space는 버튼이 직접 처리합니다.
      if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
          if (positionRef.current.index >= slides.length) exit()
          else next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          previous()
          break
        case 'Home':
          jump(0)
          break
        case 'End':
          jump(slides.length - 1)
          break
        case 'Escape':
          exit()
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [slides, next, previous, jump, exit])

  // 전체 화면: 사용자가 Esc 등으로 전체 화면을 끝내면 발표도 끝냅니다.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let wasFullscreen = false
    const onChange = () => {
      if (document.fullscreenElement === container) wasFullscreen = true
      else if (wasFullscreen) exit()
    }
    document.addEventListener('fullscreenchange', onChange)
    container.focus()
    // 전체 화면을 쓸 수 없는 환경에서는 창 안에서 그대로 발표합니다.
    container.requestFullscreen?.().catch(() => {})
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement === container) void document.exitFullscreen().catch(() => {})
    }
  }, [exit])

  const transition = !position.instant && slide?.transition ? slide.transition : NO_TRANSITION

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="발표 모드"
      className="group/present fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black outline-none select-none"
      data-testid="presentation"
      data-slide-index={position.index}
      data-step={position.step}
      onClick={() => (ended ? exit() : next())}
    >
      {ended ? (
        <p className="text-sm text-white/70">발표가 끝났습니다. 클릭하면 편집 화면으로 돌아갑니다.</p>
      ) : (
        <div className="relative overflow-hidden" style={{ width: canvas.width * scale, height: canvas.height * scale }}>
          <AnimatePresence initial={false} custom={transition}>
            {slide && (
              <motion.div
                key={slide.id}
                custom={transition}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <div style={{ width: canvas.width, height: canvas.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                  <PresentedSlide project={project} slide={slide} step={position.step} instant={position.instant} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-1 text-white opacity-0 transition-opacity group-hover/present:opacity-100 focus-within:opacity-100"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="이전"
          className="rounded-full p-1.5 outline-none hover:bg-white/15 focus-visible:bg-white/15 disabled:opacity-30"
          disabled={position.index === 0 && position.step === 0}
          onClick={previous}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-14 text-center text-xs tabular-nums" aria-live="polite">
          {Math.min(position.index + 1, slides.length)} / {slides.length}
        </span>
        <button
          type="button"
          aria-label="다음"
          className="rounded-full p-1.5 outline-none hover:bg-white/15 focus-visible:bg-white/15 disabled:opacity-30"
          disabled={ended}
          onClick={next}
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="발표 끝내기"
          className="rounded-full p-1.5 outline-none hover:bg-white/15 focus-visible:bg-white/15"
          onClick={exit}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
