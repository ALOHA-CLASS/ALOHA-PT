import { useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Code2,
  Download,
  Home,
  ImagePlus,
  Loader2,
  Minus,
  Play,
  Plus,
  Redo2,
  Shapes,
  Square,
  Type,
  Undo2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { navigate } from '@/app/router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ALLOWED_IMAGE_MIME_TYPES } from '@/domain/constants'
import { renameProject } from '@/domain/projectOps'
import {
  addCode,
  addImageFiles,
  addShape,
  addText,
  redo,
  startPresentation,
  undo,
} from '@/features/editor/actions'
import { exportJson, exportPdf, exportPptx } from '@/features/export/exportActions'
import { MAX_ZOOM, MIN_ZOOM, useEditorStore } from '@/stores/editorStore'
import { flushSave, useProjectStore } from '@/stores/projectStore'
import type { PresentationProject, ShapeKind } from '@/types/project'

const SHAPE_ITEMS: { kind: ShapeKind; label: string; icon: ReactNode }[] = [
  { kind: 'rectangle', label: '사각형', icon: <Square /> },
  { kind: 'roundedRectangle', label: '둥근 사각형', icon: <Square className="rounded-sm" /> },
  { kind: 'ellipse', label: '타원', icon: <Circle /> },
  { kind: 'line', label: '선', icon: <Minus /> },
  { kind: 'arrow', label: '화살표', icon: <ArrowRight /> },
]

const ZOOM_STEP = 1.25

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />
}

function ProjectName({ name }: { name: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  return (
    <input
      aria-label="프로젝트 이름"
      className="h-7 w-48 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/30"
      value={draft ?? name}
      maxLength={100}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (!cancelled.current && draft !== null) {
          useProjectStore.getState().commit((project) => renameProject(project, draft))
        }
        cancelled.current = false
        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function SaveStatus() {
  const status = useProjectStore((state) => state.saveStatus)
  const error = useProjectStore((state) => state.saveError)

  if (status === 'error') {
    return (
      <Tip label={error ? `저장 실패: ${error}` : '저장 실패'}>
        <Button variant="destructive" size="xs" onClick={() => void flushSave()}>
          <AlertCircle /> 저장 실패 · 다시 시도
        </Button>
      </Tip>
    )
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
      role="status"
      data-testid="save-status"
      data-status={status}
    >
      {status === 'saved' ? <Check className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
      {status === 'saved' ? '저장됨' : '저장 중…'}
    </span>
  )
}

function ZoomControls() {
  const zoom = useEditorStore((state) => state.zoom)
  const viewScale = useEditorStore((state) => state.viewScale)
  const setZoom = useEditorStore((state) => state.setZoom)
  const step = (factor: number) => setZoom(Math.round(viewScale * factor * 100) / 100)

  return (
    <div className="flex shrink-0 items-center">
      <Tip label="축소">
        <Button variant="ghost" size="icon-sm" aria-label="축소" disabled={viewScale <= MIN_ZOOM} onClick={() => step(1 / ZOOM_STEP)}>
          <Minus />
        </Button>
      </Tip>
      <Tip label="100%로 보기">
        <Button
          variant="ghost"
          size="sm"
          className="w-13 px-0 tabular-nums"
          aria-label={`확대 비율 ${Math.round(viewScale * 100)}%`}
          onClick={() => setZoom(1)}
        >
          {Math.round(viewScale * 100)}%
        </Button>
      </Tip>
      <Tip label="확대">
        <Button variant="ghost" size="icon-sm" aria-label="확대" disabled={viewScale >= MAX_ZOOM} onClick={() => step(ZOOM_STEP)}>
          <Plus />
        </Button>
      </Tip>
      <Button variant={zoom === 'fit' ? 'secondary' : 'ghost'} size="sm" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>
        맞춤
      </Button>
    </div>
  )
}

export function Toolbar({ project }: { project: PresentationProject }) {
  const canUndo = useProjectStore((state) => state.past.length > 0)
  const canRedo = useProjectStore((state) => state.future.length > 0)
  const fileInput = useRef<HTMLInputElement>(null)
  const current = () => useProjectStore.getState().project ?? project

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-2" role="toolbar" aria-label="편집 도구">
      <Tip label="프로젝트 목록">
        <Button variant="ghost" size="icon-sm" aria-label="프로젝트 목록으로" onClick={() => navigate('#/')}>
          <Home />
        </Button>
      </Tip>
      <ProjectName name={project.name} />
      <SaveStatus />
      <Divider />

      <Tip label="실행 취소 (Ctrl+Z)">
        <Button variant="ghost" size="icon-sm" aria-label="실행 취소" disabled={!canUndo} onClick={undo}>
          <Undo2 />
        </Button>
      </Tip>
      <Tip label="다시 실행 (Ctrl+Shift+Z)">
        <Button variant="ghost" size="icon-sm" aria-label="다시 실행" disabled={!canRedo} onClick={redo}>
          <Redo2 />
        </Button>
      </Tip>
      <Divider />

      <Button variant="ghost" size="sm" onClick={addText}>
        <Type /> 텍스트
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Shapes /> 도형 <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SHAPE_ITEMS.map((item) => (
            <DropdownMenuItem key={item.kind} onSelect={() => addShape(item.kind)}>
              {item.icon} {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
        <ImagePlus /> 이미지
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        multiple
        hidden
        data-testid="image-file-input"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length > 0) void addImageFiles(files)
        }}
      />
      <Button variant="ghost" size="sm" onClick={addCode}>
        <Code2 /> 코드
      </Button>

      <div className="min-w-2 flex-1" />

      <ZoomControls />
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download /> 내보내기 <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onSelect={() => void exportJson(current())}>JSON 백업 (.json)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportPptx(current())}>PowerPoint (.pptx)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportPdf(current())}>PDF (인쇄)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Play /> 발표 <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={() => startPresentation(true)}>
            처음부터 <DropdownMenuShortcut>F5</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startPresentation(false)}>
            현재 슬라이드부터 <DropdownMenuShortcut>Shift+F5</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
