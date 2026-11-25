import { create } from 'zustand'
import type { SlideElement } from '@/types/project'

export type Zoom = 'fit' | number

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

// 프로젝트 JSON에 저장하지 않는 일시적인 편집 UI 상태
interface EditorState {
  activeSlideId: string | null
  selectedIds: string[]
  /** 캔버스에서 내용을 직접 편집 중인 텍스트 요소 */
  editingTextId: string | null
  /** 코드 편집기 대화상자에서 열려 있는 코드 요소 */
  editingCodeId: string | null
  zoom: Zoom
  /** 캔버스에 실제로 적용된 배율 (zoom이 'fit'일 때 계산된 값) */
  viewScale: number
  /** 발표 모드가 켜져 있으면 시작 슬라이드 인덱스 */
  presentingFrom: number | null
  clipboard: SlideElement[]

  setActiveSlide(slideId: string | null): void
  select(ids: string[]): void
  toggleSelect(id: string): void
  setEditingText(id: string | null): void
  setEditingCode(id: string | null): void
  setZoom(zoom: Zoom): void
  setViewScale(scale: number): void
  setPresentingFrom(index: number | null): void
  setClipboard(elements: SlideElement[]): void
  reset(): void
}

const initial = {
  activeSlideId: null,
  selectedIds: [],
  editingTextId: null,
  editingCodeId: null,
  zoom: 'fit' as Zoom,
  viewScale: 1,
  presentingFrom: null,
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initial,
  clipboard: [],

  setActiveSlide(slideId) {
    if (get().activeSlideId === slideId) return
    set({ activeSlideId: slideId, selectedIds: [], editingTextId: null, editingCodeId: null })
  },
  select(ids) {
    set({ selectedIds: ids, editingTextId: null })
  },
  toggleSelect(id) {
    const { selectedIds } = get()
    set({
      selectedIds: selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
      editingTextId: null,
    })
  },
  setEditingText(id) {
    set(id ? { editingTextId: id, selectedIds: [id] } : { editingTextId: null })
  },
  setEditingCode(id) {
    set({ editingCodeId: id })
  },
  setZoom(zoom) {
    set({ zoom: zoom === 'fit' ? zoom : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) })
  },
  setViewScale(scale) {
    if (get().viewScale !== scale) set({ viewScale: scale })
  },
  setPresentingFrom(index) {
    set({ presentingFrom: index, editingTextId: null })
  },
  setClipboard(elements) {
    set({ clipboard: elements })
  },
  reset() {
    set({ ...initial })
  },
}))
