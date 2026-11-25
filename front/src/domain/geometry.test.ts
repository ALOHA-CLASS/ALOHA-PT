import { describe, expect, it } from 'vitest'
import { alignRects, fitScale, resizeRect, type Rect } from '@/domain/geometry'

const start: Rect = { x: 100, y: 100, width: 200, height: 100 }

describe('resizeRect', () => {
  it('오른쪽 아래 핸들은 왼쪽 위를 고정한다', () => {
    expect(resizeRect(start, 'se', 50, 20)).toEqual({ x: 100, y: 100, width: 250, height: 120 })
  })

  it('왼쪽 위 핸들은 오른쪽 아래를 고정한다', () => {
    expect(resizeRect(start, 'nw', 50, 20)).toEqual({ x: 150, y: 120, width: 150, height: 80 })
  })

  it('변 핸들은 한 축만 바꾼다', () => {
    expect(resizeRect(start, 'e', 30, 999)).toEqual({ x: 100, y: 100, width: 230, height: 100 })
    expect(resizeRect(start, 'n', 999, -40)).toEqual({ x: 100, y: 60, width: 200, height: 140 })
  })

  it('최소 크기 아래로 줄어들지 않고 고정점을 유지한다', () => {
    const result = resizeRect(start, 'w', 500, 0, { minSize: 10 })
    expect(result.width).toBe(10)
    expect(result.x + result.width).toBe(300)
  })

  it('keepAspect는 모서리 핸들에서 비율을 유지한다', () => {
    const result = resizeRect(start, 'se', 100, 0, { keepAspect: true })
    expect(result.width / result.height).toBeCloseTo(2)
    expect(result).toMatchObject({ x: 100, y: 100, width: 300, height: 150 })
  })

  it('회전된 요소도 반대쪽 고정점이 화면에서 움직이지 않는다', () => {
    const rotation = 90
    const worldAnchor = (r: Rect) => {
      // 회전 90°에서 로컬 왼쪽 위(-w/2, -h/2)는 (h/2, -w/2)로 이동
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      return [cx + r.height / 2, cy - r.width / 2]
    }
    const result = resizeRect(start, 'se', 0, 40, { rotation })
    // 화면에서 아래로 40 끌면 로컬 x축(너비)이 40 늘어난다
    expect(result.width).toBe(240)
    expect(result.height).toBe(100)
    const [ax, ay] = worldAnchor(start)
    const [bx, by] = worldAnchor(result)
    expect(bx).toBeCloseTo(ax, 0)
    expect(by).toBeCloseTo(ay, 0)
  })
})

describe('fitScale', () => {
  it('가용 영역에 맞는 배율을 계산한다', () => {
    expect(fitScale(640, 720, 1280, 720)).toBe(0.5)
    expect(fitScale(1320, 400, 1280, 720, 20)).toBeCloseTo(0.5)
    expect(fitScale(0, 0, 1280, 720)).toBe(1)
  })
})

describe('alignRects', () => {
  const canvas = { x: 0, y: 0, width: 1280, height: 720 }

  it('하나만 선택하면 캔버스 기준으로 정렬한다', () => {
    expect(alignRects([{ id: 'a', ...start }], 'center', canvas)).toEqual({ a: { x: 540 } })
    expect(alignRects([{ id: 'a', ...start }], 'bottom', canvas)).toEqual({ a: { y: 620 } })
  })

  it('여러 개를 선택하면 선택 영역 기준으로 정렬한다', () => {
    const rects = [
      { id: 'a', x: 10, y: 10, width: 100, height: 50 },
      { id: 'b', x: 200, y: 80, width: 50, height: 50 },
    ]
    expect(alignRects(rects, 'left', canvas)).toEqual({ a: { x: 10 }, b: { x: 10 } })
    expect(alignRects(rects, 'right', canvas)).toEqual({ a: { x: 150 }, b: { x: 200 } })
  })
})
