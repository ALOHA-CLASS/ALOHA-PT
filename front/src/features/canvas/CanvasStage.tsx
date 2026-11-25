import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { MIN_ELEMENT_SIZE } from '@/domain/constants'
import { fitScale, RESIZE_HANDLES, resizeRect, type Rect, type ResizeHandle } from '@/domain/geometry'
import { getSlideMaster, patchElementPositions } from '@/domain/projectOps'
import { SlideView } from '@/features/canvas/SlideView'
import { TextEditOverlay } from '@/features/canvas/TextEditOverlay'
import { trackPointer } from '@/features/canvas/trackPointer'
import { addImageFiles } from '@/features/editor/actions'
import { elementFrameStyle, sortByZIndex } from '@/features/elements/styles'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { ElementPosition, PresentationProject, Slide, SlideElement } from '@/types/project'

const STAGE_PADDING = 32
const DRAG_THRESHOLD = 3
const ACCENT = '#2563EB'

const HANDLE_POSITION: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** 선택한 요소들을 끌어서 옮깁니다. */
function beginMove(event: ReactPointerEvent, slide: Slide, element: SlideElement, scale: number): void {
  if (event.button !== 0) return
  event.stopPropagation()
  const editor = useEditorStore.getState()
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    editor.toggleSelect(element.id)
    return
  }
  let ids = editor.selectedIds
  if (!ids.includes(element.id)) {
    ids = [element.id]
    editor.select(ids)
  }
  const starts = slide.elements
    .filter((el) => ids.includes(el.id) && !el.locked)
    .map((el) => ({ id: el.id, x: el.position.x, y: el.position.y }))
  if (starts.length === 0) return

  let moved = false
  trackPointer(event, {
    onMove(dx, dy, moveEvent) {
      const store = useProjectStore.getState()
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        moved = true
        store.checkpoint()
      }
      let offsetX = Math.round(dx / scale)
      let offsetY = Math.round(dy / scale)
      // Shift를 누르면 가로 또는 세로 한 방향으로만 움직입니다.
      if (moveEvent.shiftKey) {
        if (Math.abs(offsetX) > Math.abs(offsetY)) offsetY = 0
        else offsetX = 0
      }
      const patches: Record<string, Partial<ElementPosition>> = {}
      for (const start of starts) patches[start.id] = { x: start.x + offsetX, y: start.y + offsetY }
      store.updateTransient((project) => patchElementPositions(project, slide.id, patches))
    },
  })
}

function beginResize(
  event: ReactPointerEvent,
  slideId: string,
  element: SlideElement,
  handle: ResizeHandle,
  scale: number,
): void {
  if (event.button !== 0) return
  event.stopPropagation()
  event.preventDefault()
  const { x, y, width, height, rotation } = element.position
  const start: Rect = { x, y, width, height }

  let moved = false
  trackPointer(event, {
    onMove(dx, dy, moveEvent) {
      const store = useProjectStore.getState()
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        moved = true
        store.checkpoint()
      }
      // 이미지는 기본적으로 비율을 유지하고, Shift로 동작을 뒤집습니다.
      const keepAspect = (element.type === 'image') !== moveEvent.shiftKey
      const next = resizeRect(start, handle, dx / scale, dy / scale, {
        rotation,
        keepAspect,
        minSize: MIN_ELEMENT_SIZE,
      })
      store.updateTransient((project) => patchElementPositions(project, slideId, { [element.id]: next }))
    },
  })
}

function SelectionOutline({
  slideId,
  element,
  scale,
  showHandles,
}: {
  slideId: string
  element: SlideElement
  scale: number
  showHandles: boolean
}) {
  const handleSize = 10 / scale
  return (
    <div
      style={{
        ...elementFrameStyle(element.position),
        outline: `${2 / scale}px ${element.locked ? 'dashed #94A3B8' : `solid ${ACCENT}`}`,
        pointerEvents: 'none',
      }}
    >
      {showHandles &&
        RESIZE_HANDLES.map((handle) => {
          const { left, top, cursor } = HANDLE_POSITION[handle]
          const style: CSSProperties = {
            position: 'absolute',
            left,
            top,
            width: handleSize,
            height: handleSize,
            marginLeft: -handleSize / 2,
            marginTop: -handleSize / 2,
            background: '#FFFFFF',
            border: `${1.5 / scale}px solid ${ACCENT}`,
            borderRadius: 2 / scale,
            boxSizing: 'border-box',
            cursor,
            pointerEvents: 'auto',
            touchAction: 'none',
          }
          return (
            <div
              key={handle}
              data-handle={handle}
              style={style}
              onPointerDown={(event) => beginResize(event, slideId, element, handle, scale)}
            />
          )
        })}
    </div>
  )
}

interface Props {
  project: PresentationProject
  slide: Slide
}

/** 편집 캔버스. 슬라이드 렌더링 위에 선택·이동·크기 조절을 위한 상호작용 계층을 겹칩니다. */
export function CanvasStage({ project, slide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [dropping, setDropping] = useState(false)

  const zoom = useEditorStore((state) => state.zoom)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const editingTextId = useEditorStore((state) => state.editingTextId)

  const { canvas } = project
  const scale =
    zoom === 'fit' ? fitScale(size.width, size.height, canvas.width, canvas.height, STAGE_PADDING) : zoom
  const scaleRef = useRef(scale)
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    useEditorStore.getState().setViewScale(scale)
  }, [scale])

  // Ctrl + 휠 확대/축소. 브라우저 기본 확대를 막아야 하므로 passive가 아닌 리스너로 등록합니다.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      useEditorStore.getState().setZoom(Math.round(scaleRef.current * factor * 100) / 100)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  const master = getSlideMaster(project, slide)
  const hiddenElementIds = useMemo(() => (editingTextId ? new Set([editingTextId]) : undefined), [editingTextId])
  const ordered = sortByZIndex(slide.elements).filter((element) => element.visible)
  const selected = ordered.filter((element) => selectedIds.includes(element.id))
  const editingElement = slide.elements.find((element) => element.id === editingTextId)

  const beginMarquee = (event: ReactPointerEvent) => {
    if (event.button !== 0 || !surfaceRef.current) return
    const editor = useEditorStore.getState()
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const baseIds = additive ? editor.selectedIds : []
    if (!additive) editor.select([])

    const bounds = surfaceRef.current.getBoundingClientRect()
    const originX = (event.clientX - bounds.left) / scale
    const originY = (event.clientY - bounds.top) / scale
    trackPointer(event, {
      onMove(dx, dy) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        const rect: Rect = {
          x: Math.min(originX, originX + dx / scale),
          y: Math.min(originY, originY + dy / scale),
          width: Math.abs(dx / scale),
          height: Math.abs(dy / scale),
        }
        setMarquee(rect)
        const hits = ordered.filter((el) => !el.locked && intersects(rect, el.position)).map((el) => el.id)
        useEditorStore.getState().select([...new Set([...baseIds, ...hits])])
      },
      onEnd() {
        setMarquee(null)
      },
    })
  }

  const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes('Files')

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-muted"
      data-testid="canvas-stage"
      onPointerDown={beginMarquee}
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDropping(false)
        void addImageFiles([...event.dataTransfer.files])
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: Math.max(size.width, canvas.width * scale + STAGE_PADDING * 2),
          height: Math.max(size.height, canvas.height * scale + STAGE_PADDING * 2),
        }}
      >
        <div
          ref={surfaceRef}
          className="relative shrink-0 shadow-lg ring-1 ring-black/10"
          style={{ width: canvas.width * scale, height: canvas.height * scale }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: canvas.width,
              height: canvas.height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              ['--canvas-scale' as string]: scale,
            }}
          >
            <SlideView
              slide={slide}
              canvas={canvas}
              master={master}
              assets={project.assetRefs}
              mode="edit"
              hiddenElementIds={hiddenElementIds}
            />

            {/* 상호작용 계층: 렌더링 결과 위에 투명한 선택 영역과 핸들을 겹칩니다. */}
            <div style={{ position: 'absolute', inset: 0 }}>
              {ordered.map((element) =>
                element.id === editingTextId ? null : (
                  <div
                    key={element.id}
                    className="canvas-hit-box"
                    data-element-id={element.id}
                    data-element-type={element.type}
                    style={{
                      ...elementFrameStyle(element.position),
                      cursor: element.locked ? 'default' : 'move',
                      touchAction: 'none',
                    }}
                    onPointerDown={(event) => beginMove(event, slide, element, scale)}
                    onDoubleClick={() => {
                      if (element.locked) return
                      const editor = useEditorStore.getState()
                      if (element.type === 'text') editor.setEditingText(element.id)
                      else if (element.type === 'code') editor.setEditingCode(element.id)
                    }}
                  />
                ),
              )}
              {selected.map((element) =>
                element.id === editingTextId ? null : (
                  <SelectionOutline
                    key={element.id}
                    slideId={slide.id}
                    element={element}
                    scale={scale}
                    showHandles={selected.length === 1 && !element.locked}
                  />
                ),
              )}
              {editingElement?.type === 'text' && (
                <TextEditOverlay key={editingElement.id} slideId={slide.id} element={editingElement} />
              )}
              {marquee && (
                <div
                  style={{
                    position: 'absolute',
                    left: marquee.x,
                    top: marquee.y,
                    width: marquee.width,
                    height: marquee.height,
                    border: `${1 / scale}px solid ${ACCENT}`,
                    background: 'rgba(37, 99, 235, 0.08)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {dropping && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/70 text-sm font-medium">
          이미지를 놓아 슬라이드에 추가
        </div>
      )}
    </div>
  )
}
