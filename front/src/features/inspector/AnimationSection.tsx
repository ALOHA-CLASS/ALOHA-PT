import { sortAnimations } from '@/domain/animations'
import { createId } from '@/domain/ids'
import { setAnimations } from '@/domain/projectOps'
import { NumberField, Row, Section, SelectField } from '@/features/inspector/fields'
import { EFFECT_LABELS, TRIGGER_LABELS } from '@/features/inspector/labels'
import { useProjectStore } from '@/stores/projectStore'
import type {
  AnimationDirection,
  AnimationEffect,
  AnimationTrigger,
  ElementAnimation,
  Slide,
  SlideElement,
} from '@/types/project'

const EFFECT_OPTIONS: { value: AnimationEffect | 'none'; label: string }[] = [
  { value: 'none', label: '없음' },
  ...(Object.keys(EFFECT_LABELS) as AnimationEffect[]).map((effect) => ({ value: effect, label: EFFECT_LABELS[effect] })),
]

const TRIGGER_OPTIONS = (Object.keys(TRIGGER_LABELS) as AnimationTrigger[]).map((trigger) => ({
  value: trigger,
  label: TRIGGER_LABELS[trigger],
}))

const DIRECTION_OPTIONS: { value: AnimationDirection; label: string }[] = [
  { value: 'left', label: '왼쪽에서' },
  { value: 'right', label: '오른쪽에서' },
  { value: 'top', label: '위에서' },
  { value: 'bottom', label: '아래에서' },
]

/** 선택한 요소의 발표 애니메이션 설정. 요소 하나에 효과 하나를 지정합니다. */
export function AnimationSection({ slide, element }: { slide: Slide; element: SlideElement }) {
  const animations = sortAnimations(slide.animations)
  const animation = animations.find((item) => item.elementId === element.id)

  const apply = (next: ElementAnimation[], key: string) =>
    useProjectStore.getState().commit((project) => setAnimations(project, slide.id, next), `animation:${key}`)

  const setEffect = (effect: AnimationEffect | 'none') => {
    if (effect === 'none') {
      apply(
        animations.filter((item) => item.elementId !== element.id),
        'effect',
      )
    } else if (animation) {
      update({ effect })
    } else {
      apply(
        [
          ...animations,
          {
            id: createId('animation'),
            elementId: element.id,
            effect,
            trigger: 'onClick',
            duration: 500,
            delay: 0,
            order: animations.length,
            direction: 'left',
          },
        ],
        'effect',
      )
    }
  }

  const update = (patch: Partial<ElementAnimation>) => {
    if (!animation) return
    apply(
      animations.map((item) => (item.id === animation.id ? { ...item, ...patch } : item)),
      Object.keys(patch).join(','),
    )
  }

  return (
    <Section title="애니메이션">
      <Row label="효과">
        <SelectField
          ariaLabel="애니메이션 효과"
          value={animation?.effect ?? 'none'}
          options={EFFECT_OPTIONS}
          onChange={setEffect}
        />
      </Row>
      {animation && (
        <>
          <Row label="시작">
            <SelectField
              ariaLabel="애니메이션 시작 조건"
              value={animation.trigger}
              options={TRIGGER_OPTIONS}
              onChange={(trigger) => update({ trigger })}
            />
          </Row>
          {animation.effect === 'slideIn' && (
            <Row label="방향">
              <SelectField
                ariaLabel="슬라이드 인 방향"
                value={animation.direction ?? 'left'}
                options={DIRECTION_OPTIONS}
                onChange={(direction) => update({ direction })}
              />
            </Row>
          )}
          <Row label="시간">
            <NumberField
              ariaLabel="재생 시간"
              suffix="ms"
              value={animation.duration}
              min={0}
              max={10000}
              step={50}
              onChange={(duration) => update({ duration })}
            />
          </Row>
          <Row label="지연">
            <NumberField
              ariaLabel="지연 시간"
              suffix="ms"
              value={animation.delay}
              min={0}
              max={10000}
              step={50}
              onChange={(delay) => update({ delay })}
            />
          </Row>
        </>
      )}
    </Section>
  )
}
