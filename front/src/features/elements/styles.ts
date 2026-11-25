import type { CSSProperties } from 'react'
import type { ElementPosition, TextStyle } from '@/types/project'

export function elementFrameStyle(position: ElementPosition): CSSProperties {
  return {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
    transform: position.rotation ? `rotate(${position.rotation}deg)` : undefined,
  }
}

export function sortByZIndex<T extends { position: ElementPosition }>(elements: readonly T[]): T[] {
  return [...elements].sort((a, b) => a.position.zIndex - b.position.zIndex)
}

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

/** 텍스트 상자(배경·여백·세로 정렬) 스타일. 캔버스 표시와 편집 오버레이가 함께 사용합니다. */
export function textBoxStyle(style: TextStyle): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: JUSTIFY[style.verticalAlign ?? 'top'],
    backgroundColor: style.backgroundColor,
    padding: style.padding ?? 0,
    borderRadius: style.borderRadius,
  }
}

export function textContentStyle(style: TextStyle): CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight ?? 1.4,
    letterSpacing: style.letterSpacing,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    minWidth: 0,
  }
}
