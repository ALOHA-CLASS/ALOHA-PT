interface TrackHandlers {
  /** dx·dy는 누른 지점부터의 화면 픽셀 이동량입니다. */
  onMove(dx: number, dy: number, event: PointerEvent): void
  onEnd?(event: PointerEvent): void
}

/** pointerdown 이후의 이동을 창 전체에서 추적합니다. 요소 밖으로 나가도 드래그가 끊기지 않습니다. */
export function trackPointer(start: { clientX: number; clientY: number; pointerId: number }, handlers: TrackHandlers) {
  const move = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return
    handlers.onMove(event.clientX - start.clientX, event.clientY - start.clientY, event)
  }
  const end = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    handlers.onEnd?.(event)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}
