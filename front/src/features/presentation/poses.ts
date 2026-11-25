// 발표 모드에서 애니메이션 전후의 요소 자세(위치·투명도·크기)를 정의합니다.
import { isEntranceEffect, type ElementAnimationState } from '@/domain/animations'
import type { ElementAnimation } from '@/types/project'

export type Pose = {
  opacity: number
  x: number
  y: number
  scale: number
}

export const VISIBLE_POSE: Pose = { opacity: 1, x: 0, y: 0, scale: 1 }
const FADED_POSE: Pose = { ...VISIBLE_POSE, opacity: 0 }

const SLIDE_OFFSET = 120
const ZOOM_START_SCALE = 0.6

/** 등장 효과가 재생되기 전의 숨겨진 자세 */
export function hiddenPose(animation: ElementAnimation): Pose {
  switch (animation.effect) {
    case 'slideIn': {
      const direction = animation.direction ?? 'left'
      return {
        opacity: 0,
        x: direction === 'left' ? -SLIDE_OFFSET : direction === 'right' ? SLIDE_OFFSET : 0,
        y: direction === 'top' ? -SLIDE_OFFSET : direction === 'bottom' ? SLIDE_OFFSET : 0,
        scale: 1,
      }
    }
    case 'zoomIn':
      return { ...FADED_POSE, scale: ZOOM_START_SCALE }
    default:
      return FADED_POSE
  }
}

export interface ElementMotion {
  /** 처음 그릴 때의 자세. null이면 target에서 바로 시작합니다. */
  initial: Pose | null
  target: Pose
  /** 초 단위. duration이 0이면 즉시 적용합니다. */
  duration: number
  delay: number
}

/**
 * 현재 단계에서 요소가 취할 자세와 재생 시간을 계산합니다.
 * instant가 true이면(뒤로 이동 등) 애니메이션 없이 결과 상태만 보여줍니다.
 */
export function resolveElementMotion(state: ElementAnimationState, step: number, instant: boolean): ElementMotion {
  const { visible, last, upcoming } = state
  const target = visible ? VISIBLE_POSE : !last && upcoming ? hiddenPose(upcoming.animation) : FADED_POSE
  if (instant || !last || last.step !== step) return { initial: null, target, duration: 0, delay: 0 }

  const { animation, startMs } = last
  return {
    initial: isEntranceEffect(animation.effect) ? hiddenPose(animation) : VISIBLE_POSE,
    target,
    duration: animation.effect === 'appear' ? 0 : animation.duration / 1000,
    delay: startMs / 1000,
  }
}
