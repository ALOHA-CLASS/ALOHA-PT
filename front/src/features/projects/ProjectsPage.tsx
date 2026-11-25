import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Download, FolderOpen, MoreHorizontal, Pencil, Plus, Presentation, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { navigate, projectPath } from '@/app/router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { createProject, renameProject } from '@/domain/projectOps'
import { exportJson } from '@/features/export/exportActions'
import { ImportError, parseBackup, restoreBackup } from '@/services/export/jsonBackup'
import { assetRepository, projectRepository } from '@/services/storage'
import type { ProjectSummary } from '@/types/project'

const DEFAULT_PROJECT_NAME = '새 프레젠테이션'
const MAX_NAME_LENGTH = 100
// 이미지가 base64로 포함되므로 백업 파일은 클 수 있습니다.
const MAX_BACKUP_BYTES = 300 * 1024 * 1024

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

type ListResult = { projects: ProjectSummary[] } | { error: string }

async function loadProjects(): Promise<ListResult> {
  try {
    return { projects: await projectRepository.list() }
  } catch (error) {
    console.error('프로젝트 목록 조회 실패', error)
    return {
      error: '브라우저 저장소(IndexedDB)를 사용할 수 없습니다. 시크릿 모드이거나 저장 공간이 차단되었는지 확인하세요.',
    }
  }
}

type NameDialogState ={ mode: 'create' } | { mode: 'rename'; project: ProjectSummary }

function NameDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: NameDialogState
  onClose(): void
  onSubmit(name: string): Promise<void>
}) {
  const [name, setName] = useState(state.mode === 'rename' ? state.project.name : DEFAULT_PROJECT_NAME)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{state.mode === 'create' ? '새 프로젝트' : '이름 변경'}</DialogTitle>
            <DialogDescription>프로젝트 이름을 입력하세요.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="프로젝트 이름"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={!trimmed || busy}>
              {state.mode === 'create' ? '만들기' : '변경'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectCard({
  project,
  onRename,
  onDelete,
}: {
  project: ProjectSummary
  onRename(): void
  onDelete(): void
}) {
  const backup = async () => {
    const full = await projectRepository.getById(project.id).catch(() => null)
    if (full) await exportJson(full)
    else toast.error('프로젝트를 읽지 못했습니다.')
  }

  return (
    <li className="group relative rounded-xl border bg-card transition-shadow hover:shadow-md" data-testid="project-card">
      <a
        href={projectPath(project.id)}
        className="flex flex-col gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Presentation className="size-8" />
        </div>
        <div className="min-w-0 pr-8">
          <h2 className="truncate text-sm font-medium">{project.name}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            슬라이드 {project.slideCount}장 · {formatDate(project.updatedAt)}
          </p>
        </div>
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${project.name} 메뉴`} className="absolute right-3 bottom-4">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => navigate(projectPath(project.id))}>
            <FolderOpen /> 열기
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <Pencil /> 이름 변경
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void backup()}>
            <Download /> JSON 백업
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null)
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const applyList = useCallback((result: ListResult) => {
    if ('error' in result) {
      setLoadError(result.error)
    } else {
      setProjects(result.projects)
      setLoadError(null)
    }
  }, [])
  const refresh = async () => applyList(await loadProjects())

  useEffect(() => {
    let cancelled = false
    void loadProjects().then((result) => {
      if (!cancelled) applyList(result)
    })
    return () => {
      cancelled = true
    }
  }, [applyList])

  const submitName = async (name: string) => {
    if (!nameDialog) return
    try {
      if (nameDialog.mode === 'create') {
        const project = createProject(name)
        await projectRepository.save(project)
        setNameDialog(null)
        navigate(projectPath(project.id))
        return
      }
      const stored = await projectRepository.getById(nameDialog.project.id)
      if (stored) await projectRepository.save(renameProject(stored, name))
      setNameDialog(null)
      await refresh()
    } catch (error) {
      console.error('프로젝트 저장 실패', error)
      toast.error(nameDialog.mode === 'create' ? '프로젝트를 만들지 못했습니다.' : '이름을 바꾸지 못했습니다.')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await projectRepository.delete(target.id)
      toast.success(`"${target.name}" 프로젝트를 삭제했습니다.`)
    } catch (error) {
      console.error('프로젝트 삭제 실패', error)
      toast.error('프로젝트를 삭제하지 못했습니다.')
    }
    await refresh()
  }

  const importFile = async (file: File) => {
    setImporting(true)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new ImportError('파일이 너무 큽니다. 300MB 이하의 백업 파일만 가져올 수 있습니다.')
      const parsed = parseBackup(await file.text())
      const project = await restoreBackup(parsed, projectRepository, assetRepository)
      toast.success(`"${project.name}" 프로젝트를 가져왔습니다.`, {
        action: { label: '열기', onClick: () => navigate(projectPath(project.id)) },
      })
      await refresh()
    } catch (error) {
      if (error instanceof ImportError) {
        const details = error.details.slice(0, 3)
        if (error.details.length > details.length) details.push(`외 ${error.details.length - details.length}건`)
        toast.error(error.message, { description: details.length > 0 ? details.join('\n') : undefined, duration: 8000 })
      } else {
        console.error('가져오기 실패', error)
        toast.error('백업 파일을 가져오지 못했습니다.')
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-full bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Presentation className="size-5" />
          <h1 className="text-base font-semibold">ALOHA Slide Studio</h1>
          <div className="flex-1" />
          <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
            <Upload /> {importing ? '가져오는 중…' : '가져오기'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="import-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importFile(file)
            }}
          />
          <Button onClick={() => setNameDialog({ mode: 'create' })}>
            <Plus /> 새 프로젝트
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {loadError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : projects === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            프로젝트를 불러오는 중…
          </p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
            <Presentation className="size-10 text-muted-foreground" />
            <h2 className="text-base font-medium">아직 프로젝트가 없습니다</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              새 프로젝트를 만들거나 JSON 백업 파일을 가져와서 시작하세요. 모든 데이터는 이 브라우저에 저장됩니다.
            </p>
            <Button onClick={() => setNameDialog({ mode: 'create' })}>
              <Plus /> 새 프로젝트
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={() => setNameDialog({ mode: 'rename', project })}
                onDelete={() => setDeleting(project)}
              />
            ))}
          </ul>
        )}
      </main>

      {nameDialog && (
        <NameDialog
          key={nameDialog.mode === 'rename' ? nameDialog.project.id : 'create'}
          state={nameDialog}
          onClose={() => setNameDialog(null)}
          onSubmit={submitName}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" 프로젝트와 포함된 이미지가 이 브라우저에서 삭제됩니다. 삭제한 뒤에는 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
