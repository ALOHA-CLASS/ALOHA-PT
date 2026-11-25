// 발표 모드에서 애니메이션이 어떤 단계(클릭)와 시점에 재생되는지 계산합니다.
import type { AnimationEffect, ElementAnimation, Slide } from '@/types/project'

export function sortAnimations(animations: readonly ElementAnimation[]): ElementAnimation[] {
  return [...animations].sort((a, b) => a.order - b.order)
}

/** 요소가 화면에 나타나는 효과인지 여부. 등장 효과가 걸린 요소는 재생 전까지 숨겨집니다. */
export function isEntranceEffect(effect: AnimationEffect): boolean {
  return effect !== 'fadeOut'
}

export interface PlannedAnimation {
  animation: ElementAnimation
  /** 이 애니메이션이 재생되는 단계. 0은 슬라이드가 나타날 때, n은 n번째 클릭입니다. */
  step: number
  /** 단계가 시작된 뒤 재생을 시작하기까지의 시간 (ms) */
  startMs: number
}

export interface AnimationPlan {
  planned: PlannedAnimation[]
  /** 슬라이드를 끝까지 보려면 필요한 클릭 수 */
  stepCount: number
}

export function planAnimations(slide: Slide): AnimationPlan {
  const elementIds = new Set(slide.elements.filter((el) => el.visible).map((el) => el.id))
  const planned: PlannedAnimation[] = []
  let step = 0
  let previousStart = 0
  let previousEnd = 0

  for (const animation of sortAnimations(slide.animations)) {
    if (!elementIds.has(animation.elementId)) continue
    let startMs: number
    if (animation.trigger === 'onClick') {
      step += 1
      startMs = animation.delay
    } else if (animation.trigger === 'withPrevious') {
      startMs = previousStart + animation.delay
    } else {
      startMs = previousEnd + animation.delay
    }
    previousStart = startMs
    previousEnd = startMs + animation.duration
    planned.push({ animation, step, startMs })
  }
  return { planned, stepCount: step }
}

export interface ElementAnimationState {
  visible: boolean
  /** 현재 단계까지 재생된 것 중 마지막 애니메이션 */
  last?: PlannedAnimation
  /** 다음에 재생될 애니메이션 */
  upcoming?: PlannedAnimation
}

/** 주어진 단계에서 요소가 보이는지와 관련 애니메이션을 돌려줍니다. 애니메이션이 없는 요소는 null입니다. */
export function getElementAnimationState(
  plan: AnimationPlan,
  elementId: string,
  step: number,
): ElementAnimationState | null {
  const mine = plan.planned.filter((item) => item.animation.elementId === elementId)
  if (mine.length === 0) return null
  const played = mine.filter((item) => item.step <= step)
  const last = played[played.length - 1]
  const upcoming = mine[played.length]
  const visible = last ? isEntranceEffect(last.animation.effect) : !isEntranceEffect(mine[0].animation.effect)
  return { visible, last, upcoming }
}
