import { create } from 'zustand'
import { projectRepository } from '@/services/storage'
import type { PresentationProject } from '@/types/project'

type Updater = (project: PresentationProject) => PresentationProject

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

const HISTORY_LIMIT = 100
const COALESCE_WINDOW_MS = 800
const AUTOSAVE_DELAY_MS = 600

interface ProjectState {
  project: PresentationProject | null
  past: PresentationProject[]
  future: PresentationProject[]
  saveStatus: SaveStatus
  saveError: string | null

  load(project: PresentationProject): void
  unload(): void
  /** 변경을 적용하고 Undo 기록에 남깁니다. 같은 coalesceKey의 연속 변경은 한 단계로 묶입니다. */
  commit(fn: Updater, coalesceKey?: string): void
  /** Undo 기록 없이 변경합니다. 드래그처럼 고빈도 갱신에 쓰고, 시작 전에 checkpoint()를 호출합니다. */
  updateTransient(fn: Updater): void
  /** 현재 상태를 Undo 지점으로 기록합니다. */
  checkpoint(): void
  undo(): void
  redo(): void
}

let lastCoalesceKey: string | null = null
let lastCommitAt = 0

function pushPast(past: PresentationProject[], project: PresentationProject): PresentationProject[] {
  const next = [...past, project]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  saveStatus: 'saved',
  saveError: null,

  load(project) {
    lastSaved = project
    lastCoalesceKey = null
    set({ project, past: [], future: [], saveStatus: 'saved', saveError: null })
  },

  unload() {
    // 아직 저장되지 않은 변경은 닫기 전에 바로 저장을 시작합니다.
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const { project } = get()
    if (project && project !== lastSaved) {
      projectRepository.save(project).catch((error) => console.error('프로젝트 저장 실패', error))
    }
    lastSaved = null
    lastCoalesceKey = null
    set({ project: null, past: [], future: [], saveStatus: 'saved', saveError: null })
  },

  commit(fn, coalesceKey) {
    const { project, past } = get()
    if (!project) return
    const next = fn(project)
    if (next === project) return
    const now = Date.now()
    const coalesce =
      coalesceKey !== undefined && coalesceKey === lastCoalesceKey && now - lastCommitAt < COALESCE_WINDOW_MS
    lastCoalesceKey = coalesceKey ?? null
    lastCommitAt = now
    set({ project: next, past: coalesce ? past : pushPast(past, project), future: [] })
  },

  updateTransient(fn) {
    const { project } = get()
    if (!project) return
    const next = fn(project)
    if (next !== project) set({ project: next })
  },

  checkpoint() {
    const { project, past } = get()
    if (!project) return
    lastCoalesceKey = null
    set({ past: pushPast(past, project), future: [] })
  },

  undo() {
    const { project, past, future } = get()
    if (!project || past.length === 0) return
    lastCoalesceKey = null
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] })
  },

  redo() {
    const { project, past, future } = get()
    if (!project || future.length === 0) return
    lastCoalesceKey = null
    set({ project: future[0], past: pushPast(past, project), future: future.slice(1) })
  },
}))

// ── 자동 저장 ───────────────────────────────────────────────────────────
// 프로젝트 데이터가 바뀌면 변경을 묶어(debounce) Repository에 저장합니다.

let lastSaved: PresentationProject | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null

async function runSave(): Promise<void> {
  const snapshot = useProjectStore.getState().project
  if (!snapshot || snapshot === lastSaved) return
  useProjectStore.setState({ saveStatus: 'saving', saveError: null })
  try {
    await projectRepository.save(snapshot)
    lastSaved = snapshot
    const current = useProjectStore.getState().project
    if (current === snapshot) useProjectStore.setState({ saveStatus: 'saved' })
    else if (current) scheduleSave()
  } catch (error) {
    console.error('프로젝트 저장 실패', error)
    useProjectStore.setState({
      saveStatus: 'error',
      saveError: error instanceof Error ? error.message : '알 수 없는 오류',
    })
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushSave()
  }, AUTOSAVE_DELAY_MS)
}

/** 대기 중인 변경을 즉시 저장합니다. 편집기를 떠나기 전이나 저장 재시도에 사용합니다. */
export function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const previous = inFlight ?? Promise.resolve()
  const next = previous.then(runSave)
  inFlight = next
  void next.finally(() => {
    if (inFlight === next) inFlight = null
  })
  return next
}

useProjectStore.subscribe((state, prev) => {
  if (state.project === prev.project || !state.project || state.project === lastSaved) return
  if (state.saveStatus !== 'dirty') useProjectStore.setState({ saveStatus: 'dirty' })
  scheduleSave()
})
