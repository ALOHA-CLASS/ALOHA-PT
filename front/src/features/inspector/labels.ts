import type { AnimationEffect, AnimationTrigger, ElementType, SlideElement } from '@/types/project'

export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  text: '텍스트',
  shape: '도형',
  image: '이미지',
  code: '코드',
}

/** 레이어 목록과 Inspector에 보여 줄 요소 이름 */
export function elementLabel(element: SlideElement): string {
  if (element.type === 'text' && element.content.trim()) {
    const firstLine = element.content.trim().split('\n')[0]
    return firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine
  }
  return element.name?.trim() || ELEMENT_TYPE_LABELS[element.type]
}

export const EFFECT_LABELS: Record<AnimationEffect, string> = {
  appear: '나타나기',
  fadeIn: '페이드 인',
  slideIn: '슬라이드 인',
  zoomIn: '확대',
  fadeOut: '페이드 아웃',
}

export const TRIGGER_LABELS: Record<AnimationTrigger, string> = {
  onClick: '클릭할 때',
  withPrevious: '이전 효과와 함께',
  afterPrevious: '이전 효과 다음에',
}
