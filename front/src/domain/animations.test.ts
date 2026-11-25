import { describe, expect, it } from 'vitest'
import { getElementAnimationState, planAnimations } from '@/domain/animations'
import { createTextElement } from '@/domain/elements'
import { createProject, getActiveTheme } from '@/domain/projectOps'
import { hiddenPose, resolveElementMotion, VISIBLE_POSE } from '@/features/presentation/poses'
import type { ElementAnimation, Slide } from '@/types/project'

function animation(elementId: string, order: number, patch: Partial<ElementAnimation> = {}): ElementAnimation {
  return {
    id: `animation_${order}`,
    elementId,
    effect: 'fadeIn',
    trigger: 'onClick',
    duration: 500,
    delay: 0,
    order,
    ...patch,
  }
}

function slideWith(animations: (ids: string[]) => ElementAnimation[], hidden: number[] = []): { slide: Slide; ids: string[] } {
  const project = createProject('p')
  const theme = getActiveTheme(project)
  const elements = [1, 2, 3].map((z, index) => ({
    ...createTextElement(theme, project.canvas, z),
    visible: !hidden.includes(index),
  }))
  const ids = elements.map((el) => el.id)
  return { slide: { ...project.slides[0], elements, animations: animations(ids) }, ids }
}

describe('planAnimations', () => {
  it('onClick마다 단계를 늘리고 withPrevious·afterPrevious의 시작 시점을 계산한다', () => {
    const { slide } = slideWith(([a, b, c]) => [
      animation(a, 0, { delay: 100 }),
      animation(b, 1, { trigger: 'withPrevious', delay: 50 }),
      animation(c, 2, { trigger: 'afterPrevious', delay: 200, duration: 300 }),
    ])
    const plan = planAnimations(slide)
    expect(plan.stepCount).toBe(1)
    expect(plan.planned.map((item) => [item.step, item.startMs])).toEqual([
      [1, 100],
      [1, 150],
      // 이전 애니메이션(150ms 시작, 500ms 길이)이 끝난 뒤 200ms 후
      [1, 850],
    ])
  })

  it('order 순서대로 정렬하고, 클릭 없이 시작하는 애니메이션은 0단계에 둔다', () => {
    const { slide, ids } = slideWith(([a, b]) => [animation(b, 5), animation(a, 1, { trigger: 'afterPrevious' })])
    const plan = planAnimations(slide)
    expect(plan.planned.map((item) => [item.animation.elementId, item.step])).toEqual([
      [ids[0], 0],
      [ids[1], 1],
    ])
    expect(plan.stepCount).toBe(1)
  })

  it('숨겨졌거나 없는 요소의 애니메이션은 건너뛴다', () => {
    const { slide } = slideWith(([a, b]) => [animation(a, 0), animation(b, 1), animation('element_missing', 2)], [0])
    const plan = planAnimations(slide)
    expect(plan.planned).toHaveLength(1)
    expect(plan.stepCount).toBe(1)
  })
})

describe('getElementAnimationState', () => {
  it('등장 효과가 걸린 요소는 해당 단계 전까지 숨긴다', () => {
    const { slide, ids } = slideWith(([a, b]) => [animation(a, 0), animation(b, 1)])
    const plan = planAnimations(slide)
    expect(getElementAnimationState(plan, ids[1], 1)).toMatchObject({ visible: false })
    expect(getElementAnimationState(plan, ids[1], 2)).toMatchObject({ visible: true })
    expect(getElementAnimationState(plan, ids[2], 0)).toBeNull()
  })

  it('fadeOut 요소는 재생 전까지 보이고 재생 뒤에는 숨긴다', () => {
    const { slide, ids } = slideWith(([a]) => [animation(a, 0, { effect: 'fadeOut' })])
    const plan = planAnimations(slide)
    expect(getElementAnimationState(plan, ids[0], 0)?.visible).toBe(true)
    expect(getElementAnimationState(plan, ids[0], 1)?.visible).toBe(false)
  })
})

describe('resolveElementMotion', () => {
  const { slide, ids } = slideWith(([a, b]) => [
    animation(a, 0, { effect: 'slideIn', direction: 'right', duration: 400, delay: 100 }),
    animation(b, 1, { effect: 'fadeOut' }),
  ])
  const plan = planAnimations(slide)
  const state = (index: number, step: number) => getElementAnimationState(plan, ids[index], step)!

  it('재생 전에는 다가올 효과의 시작 자세로 즉시 둔다', () => {
    const motion = resolveElementMotion(state(0, 0), 0, false)
    expect(motion.target).toEqual(hiddenPose(plan.planned[0].animation))
    expect(motion.target.x).toBeGreaterThan(0)
    expect(motion).toMatchObject({ initial: null, duration: 0 })
  })

  it('해당 단계에 도달하면 지정한 시간과 지연으로 재생한다', () => {
    expect(resolveElementMotion(state(0, 1), 1, false)).toMatchObject({
      target: VISIBLE_POSE,
      duration: 0.4,
      delay: 0.1,
    })
    expect(resolveElementMotion(state(1, 2), 2, false)).toMatchObject({
      initial: VISIBLE_POSE,
      target: { opacity: 0 },
      duration: 0.5,
    })
  })

  it('이미 지나간 단계이거나 instant이면 결과 상태만 즉시 보여준다', () => {
    expect(resolveElementMotion(state(0, 2), 2, false)).toMatchObject({ target: VISIBLE_POSE, duration: 0, initial: null })
    expect(resolveElementMotion(state(0, 1), 1, true)).toMatchObject({ target: VISIBLE_POSE, duration: 0, initial: null })
  })

  it('appear 효과는 지연 뒤에 즉시 나타난다', () => {
    const appear = slideWith(([a]) => [animation(a, 0, { effect: 'appear', delay: 300 })])
    const appearPlan = planAnimations(appear.slide)
    const motion = resolveElementMotion(getElementAnimationState(appearPlan, appear.ids[0], 1)!, 1, false)
    expect(motion).toMatchObject({ duration: 0, delay: 0.3, target: VISIBLE_POSE })
  })
})
