import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { navigate } from '@/app/router'
import { Button } from '@/components/ui/button'
import { migrateProject } from '@/domain/migrations'
import { pruneUnusedAssets } from '@/domain/projectOps'
import { validateProject } from '@/domain/validation'
import { CanvasStage } from '@/features/canvas/CanvasStage'
import { CodeEditorDialog } from '@/features/code-editor/CodeEditorDialog'
import { resolveActiveSlide } from '@/features/editor/actions'
import { Toolbar } from '@/features/editor/Toolbar'
import { useShortcuts } from '@/features/editor/useShortcuts'
import { Inspector } from '@/features/inspector/Inspector'
import { PresentationView } from '@/features/presentation/PresentationView'
import { SlidePanel } from '@/features/slides/SlidePanel'
import { assetRepository, projectRepository } from '@/services/storage'
import { releaseAssetUrls } from '@/services/storage/assetUrls'
import { useEditorStore } from '@/stores/editorStore'
import { flushSave, useProjectStore } from '@/stores/projectStore'
import type { PresentationProject } from '@/types/project'

type LoadState = { status: 'loading' | 'ready' | 'missing' } | { status: 'error'; message: string }

const APP_TITLE = 'ALOHA Slide Studio'

/** 저장된 프로젝트를 읽어 현재 스키마로 맞추고, 더 이상 쓰이지 않는 이미지를 정리합니다. */
async function openProject(projectId: string): Promise<PresentationProject | null> {
  const stored = await projectRepository.getById(projectId)
  if (!stored) return null
  const validation = validateProject(migrateProject(stored))
  if (!validation.ok) {
    console.error('프로젝트 데이터 검증 실패', validation.errors)
    throw new Error('저장된 프로젝트 데이터가 손상되어 열 수 없습니다.')
  }
  // Undo 기록이 없는 여는 시점에만 정리하므로, 삭제한 이미지를 실행 취소로 되살릴 수 있습니다.
  const { project, removed } = pruneUnusedAssets(validation.project)
  if (removed.length > 0) {
    await projectRepository.save(project)
    await assetRepository.delete(removed.map((ref) => ref.storageKey))
  }
  return project
}

function StatusScreen({ title, description }: { title: string; description?: string }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      <Button variant="outline" onClick={() => navigate('#/')}>
        프로젝트 목록으로
      </Button>
    </main>
  )
}

export function EditorPage({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const project = useProjectStore((store) => store.project)
  const activeSlideId = useEditorStore((store) => store.activeSlideId)
  const presentingFrom = useEditorStore((store) => store.presentingFrom)
  useShortcuts()

  useEffect(() => {
    let cancelled = false
    openProject(projectId)
      .then((opened) => {
        if (cancelled) return
        if (!opened) {
          setState({ status: 'missing' })
          return
        }
        useProjectStore.getState().load(opened)
        useEditorStore.getState().setActiveSlide(opened.slides[0]?.id ?? null)
        setState({ status: 'ready' })
      })
      .catch((error) => {
        console.error('프로젝트 열기 실패', error)
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' })
        }
      })
    return () => {
      cancelled = true
      useProjectStore.getState().unload()
      useEditorStore.getState().reset()
      releaseAssetUrls()
    }
  }, [projectId])

  // 탭을 닫거나 다른 탭으로 옮기기 전에 대기 중인 변경을 저장합니다.
  useEffect(() => {
    const save = () => {
      if (document.visibilityState === 'hidden') void flushSave()
    }
    const onPageHide = () => void flushSave()
    document.addEventListener('visibilitychange', save)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', save)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  const projectName = project?.name
  useEffect(() => {
    document.title = projectName ? `${projectName} - ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = APP_TITLE
    }
  }, [projectName])

  if (state.status === 'missing') {
    return <StatusScreen title="프로젝트를 찾을 수 없습니다" description="삭제되었거나 다른 브라우저에서 만든 프로젝트일 수 있습니다." />
  }
  if (state.status === 'error') {
    return <StatusScreen title="프로젝트를 열지 못했습니다" description={state.message} />
  }
  if (state.status === 'loading' || !project) {
    return (
      <main className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" /> 프로젝트를 여는 중…
      </main>
    )
  }

  const slide = resolveActiveSlide(project, activeSlideId)
  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/40" data-testid="editor">
      <Toolbar project={project} />
      <div className="flex min-h-0 flex-1">
        <SlidePanel project={project} activeSlideId={slide.id} />
        <CanvasStage project={project} slide={slide} />
        <Inspector project={project} slide={slide} />
      </div>
      <CodeEditorDialog slide={slide} />
      {presentingFrom !== null && <PresentationView project={project} startIndex={presentingFrom} />}
    </div>
  )
}
