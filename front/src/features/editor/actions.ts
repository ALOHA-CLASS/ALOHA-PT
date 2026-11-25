// 편집기 명령 모음. 툴바·단축키·Inspector가 같은 함수를 호출합니다.
import { toast } from 'sonner'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@/domain/constants'
import {
  createCodeElement,
  createImageElement,
  createShapeElement,
  createTextElement,
  nextZIndex,
} from '@/domain/elements'
import { alignRects, type AlignMode } from '@/domain/geometry'
import { createId, nowIso } from '@/domain/ids'
import {
  addAssetRef,
  addElement,
  addSlide,
  deleteSlide,
  duplicateElements,
  duplicateSlide,
  getActiveTheme,
  insertElementCopies,
  patchElementPositions,
  removeElements,
  reorderElement,
  updateElement,
  type ReorderDirection,
} from '@/domain/projectOps'
import { assetRepository } from '@/services/storage'
import { primeAssetUrl } from '@/services/storage/assetUrls'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type {
  AssetReference,
  ElementPosition,
  PresentationProject,
  ShapeKind,
  Slide,
  SlideElement,
} from '@/types/project'

/** 활성 슬라이드를 찾습니다. 지정된 슬라이드가 없으면 첫 슬라이드를 씁니다. */
export function resolveActiveSlide(project: PresentationProject, activeSlideId: string | null): Slide {
  return project.slides.find((slide) => slide.id === activeSlideId) ?? project.slides[0]
}

interface Context {
  project: PresentationProject
  slide: Slide
  selectedIds: string[]
}

function getContext(): Context | null {
  const { project } = useProjectStore.getState()
  if (!project) return null
  const { activeSlideId, selectedIds } = useEditorStore.getState()
  return { project, slide: resolveActiveSlide(project, activeSlideId), selectedIds }
}

function selectedElements(ctx: Context): SlideElement[] {
  const ids = new Set(ctx.selectedIds)
  return ctx.slide.elements.filter((element) => ids.has(element.id))
}

const commit = (fn: (project: PresentationProject) => PresentationProject, coalesceKey?: string) =>
  useProjectStore.getState().commit(fn, coalesceKey)

// ── 요소 추가 ───────────────────────────────────────────────────────────

function insertElement(ctx: Context, element: SlideElement): void {
  commit((project) => addElement(project, ctx.slide.id, element))
  useEditorStore.getState().select([element.id])
}

export function addText(): void {
  const ctx = getContext()
  if (!ctx) return
  const element = createTextElement(getActiveTheme(ctx.project), ctx.project.canvas, nextZIndex(ctx.slide.elements))
  insertElement(ctx, element)
  useEditorStore.getState().setEditingText(element.id)
}

export function addShape(shape: ShapeKind): void {
  const ctx = getContext()
  if (!ctx) return
  insertElement(
    ctx,
    createShapeElement(getActiveTheme(ctx.project), ctx.project.canvas, nextZIndex(ctx.slide.elements), shape),
  )
}

export function addCode(): void {
  const ctx = getContext()
  if (!ctx) return
  insertElement(ctx, createCodeElement(getActiveTheme(ctx.project), ctx.project.canvas, nextZIndex(ctx.slide.elements)))
}

function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      // 크기 정보가 없는 SVG는 기본 크기를 사용합니다.
      resolve({ width: image.naturalWidth || 400, height: image.naturalHeight || 300 })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽을 수 없습니다.'))
    }
    image.src = url
  })
}

/** 이미지 파일을 검증해 Asset으로 저장하고 활성 슬라이드에 이미지 요소로 추가합니다. */
export async function addImageFiles(files: readonly File[]): Promise<void> {
  for (const file of files) {
    const ctx = getContext()
    if (!ctx) return
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error(`지원하지 않는 이미지 형식입니다: ${file.name}`, {
        description: 'PNG, JPEG, GIF, WebP, SVG 파일을 사용할 수 있습니다.',
      })
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`이미지가 너무 큽니다: ${file.name}`, {
        description: `${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB 이하의 파일만 추가할 수 있습니다.`,
      })
      continue
    }
    try {
      const { width, height } = await readImageSize(file)
      const assetId = createId('asset')
      const asset: AssetReference = {
        id: assetId,
        name: file.name || '이미지',
        mimeType: file.type,
        size: file.size,
        width,
        height,
        storageKey: `${ctx.project.id}/${assetId}`,
        createdAt: nowIso(),
      }
      await assetRepository.put(ctx.project.id, asset.storageKey, file)
      primeAssetUrl(asset.storageKey, file)

      // 저장하는 동안 프로젝트가 닫혔거나 바뀌었을 수 있으므로 다시 확인합니다.
      const latest = getContext()
      if (!latest || latest.project.id !== ctx.project.id) {
        await assetRepository.delete([asset.storageKey])
        return
      }
      const element = createImageElement(asset, latest.project.canvas, nextZIndex(latest.slide.elements))
      commit((project) => addElement(addAssetRef(project, asset), latest.slide.id, element))
      useEditorStore.getState().select([element.id])
    } catch (error) {
      console.error('이미지 추가 실패', error)
      toast.error(`이미지를 추가하지 못했습니다: ${file.name}`)
    }
  }
}

// ── 선택 요소 편집 ──────────────────────────────────────────────────────

/** 선택한 요소 각각에 변경 함수를 적용합니다. */
export function updateSelected(fn: (element: SlideElement) => SlideElement, coalesceKey?: string): void {
  const ctx = getContext()
  if (!ctx || ctx.selectedIds.length === 0) return
  commit(
    (project) => ctx.selectedIds.reduce((acc, id) => updateElement(acc, ctx.slide.id, id, fn), project),
    coalesceKey,
  )
}

export function updateElementById(
  elementId: string,
  fn: (element: SlideElement) => SlideElement,
  coalesceKey?: string,
): void {
  const ctx = getContext()
  if (!ctx) return
  commit((project) => updateElement(project, ctx.slide.id, elementId, fn), coalesceKey)
}

export function patchSelectedPosition(patch: Partial<ElementPosition>, coalesceKey?: string): void {
  const ctx = getContext()
  if (!ctx || ctx.selectedIds.length === 0) return
  const patches = Object.fromEntries(ctx.selectedIds.map((id) => [id, patch]))
  commit((project) => patchElementPositions(project, ctx.slide.id, patches), coalesceKey)
}

export function deleteSelection(): void {
  const ctx = getContext()
  if (!ctx || ctx.selectedIds.length === 0) return
  commit((project) => removeElements(project, ctx.slide.id, ctx.selectedIds))
  useEditorStore.getState().select([])
}

export function duplicateSelection(): void {
  const ctx = getContext()
  if (!ctx || ctx.selectedIds.length === 0) return
  const result = duplicateElements(ctx.project, ctx.slide.id, ctx.selectedIds)
  if (result.newIds.length === 0) return
  commit(() => result.project)
  useEditorStore.getState().select(result.newIds)
}

export function copySelection(): boolean {
  const ctx = getContext()
  if (!ctx) return false
  const elements = selectedElements(ctx)
  if (elements.length === 0) return false
  useEditorStore.getState().setClipboard(structuredClone(elements))
  return true
}

export function cutSelection(): void {
  if (copySelection()) deleteSelection()
}

export function pasteClipboard(): void {
  const ctx = getContext()
  const { clipboard } = useEditorStore.getState()
  if (!ctx || clipboard.length === 0) return
  // 이미지 요소는 같은 프로젝트의 Asset을 가리킬 때만 붙여 넣을 수 있습니다.
  const assetIds = new Set(ctx.project.assetRefs.map((ref) => ref.id))
  const sources = clipboard.filter((el) => el.type !== 'image' || !el.assetId || assetIds.has(el.assetId))
  const result = insertElementCopies(ctx.project, ctx.slide.id, sources)
  if (result.newIds.length === 0) return
  commit(() => result.project)
  useEditorStore.getState().select(result.newIds)
}

export function nudgeSelection(dx: number, dy: number): void {
  const ctx = getContext()
  if (!ctx) return
  const patches: Record<string, Partial<ElementPosition>> = {}
  for (const element of selectedElements(ctx)) {
    if (element.locked) continue
    patches[element.id] = { x: element.position.x + dx, y: element.position.y + dy }
  }
  if (Object.keys(patches).length === 0) return
  commit((project) => patchElementPositions(project, ctx.slide.id, patches), 'nudge')
}

export function reorderSelection(direction: ReorderDirection): void {
  const ctx = getContext()
  if (!ctx || ctx.selectedIds.length === 0) return
  commit((project) =>
    ctx.selectedIds.reduce((acc, id) => reorderElement(acc, ctx.slide.id, id, direction), project),
  )
}

export function alignSelection(mode: AlignMode): void {
  const ctx = getContext()
  if (!ctx) return
  const rects = selectedElements(ctx)
    .filter((element) => !element.locked)
    .map((element) => ({ id: element.id, ...element.position }))
  if (rects.length === 0) return
  const { width, height } = ctx.project.canvas
  const patches = alignRects(rects, mode, { x: 0, y: 0, width, height })
  commit((project) => patchElementPositions(project, ctx.slide.id, patches))
}

export function selectAll(): void {
  const ctx = getContext()
  if (!ctx) return
  useEditorStore.getState().select(ctx.slide.elements.filter((el) => el.visible).map((el) => el.id))
}

// ── 슬라이드 ────────────────────────────────────────────────────────────

export function addSlideAfterActive(layoutId?: string): void {
  const ctx = getContext()
  if (!ctx) return
  const result = addSlide(ctx.project, { layoutId, afterSlideId: ctx.slide.id })
  commit(() => result.project)
  useEditorStore.getState().setActiveSlide(result.slideId)
}

export function duplicateSlideById(slideId: string): void {
  const ctx = getContext()
  if (!ctx) return
  const result = duplicateSlide(ctx.project, slideId)
  if (!result) return
  commit(() => result.project)
  useEditorStore.getState().setActiveSlide(result.slideId)
}

export function deleteSlideById(slideId: string): void {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.project.slides.length <= 1) {
    toast.info('마지막 슬라이드는 삭제할 수 없습니다.')
    return
  }
  const index = ctx.project.slides.findIndex((slide) => slide.id === slideId)
  if (index === -1) return
  commit((project) => deleteSlide(project, slideId))
  if (ctx.slide.id === slideId) {
    const neighbor = ctx.project.slides[index + 1] ?? ctx.project.slides[index - 1]
    useEditorStore.getState().setActiveSlide(neighbor.id)
  }
}

export function goToSlide(offset: number): void {
  const ctx = getContext()
  if (!ctx) return
  const index = ctx.project.slides.findIndex((slide) => slide.id === ctx.slide.id)
  const target = ctx.project.slides[Math.min(ctx.project.slides.length - 1, Math.max(0, index + offset))]
  useEditorStore.getState().setActiveSlide(target.id)
}

// ── 실행 취소 ───────────────────────────────────────────────────────────

/** Undo/Redo 뒤에 사라진 슬라이드·요소를 가리키는 편집 상태를 정리합니다. */
function reconcileEditorState(): void {
  const ctx = getContext()
  if (!ctx) return
  const editor = useEditorStore.getState()
  if (editor.activeSlideId !== ctx.slide.id) {
    editor.setActiveSlide(ctx.slide.id)
    return
  }
  const ids = new Set(ctx.slide.elements.map((element) => element.id))
  const kept = ctx.selectedIds.filter((id) => ids.has(id))
  if (kept.length !== ctx.selectedIds.length || editor.editingTextId) editor.select(kept)
}

export function undo(): void {
  useProjectStore.getState().undo()
  reconcileEditorState()
}

export function redo(): void {
  useProjectStore.getState().redo()
  reconcileEditorState()
}

// ── 발표 ────────────────────────────────────────────────────────────────

export function startPresentation(fromStart: boolean): void {
  const ctx = getContext()
  if (!ctx) return
  const index = fromStart ? 0 : ctx.project.slides.findIndex((slide) => slide.id === ctx.slide.id)
  useEditorStore.getState().setPresentingFrom(Math.max(0, index))
}
