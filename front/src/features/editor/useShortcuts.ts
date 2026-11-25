import { useEffect } from 'react'
import {
  addImageFiles,
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  goToSlide,
  nudgeSelection,
  pasteClipboard,
  redo,
  reorderSelection,
  resolveActiveSlide,
  selectAll,
  startPresentation,
  undo,
} from '@/features/editor/actions'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'

/** 입력란·대화상자·메뉴에서 일어난 키 입력은 편집기 단축키로 처리하지 않습니다. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('input, textarea, select, [role="dialog"], [role="alertdialog"], [role="menu"]')) return true
  return false
}

function isBlocked(target: EventTarget | null): boolean {
  const { editingCodeId, presentingFrom } = useEditorStore.getState()
  return editingCodeId !== null || presentingFrom !== null || isTypingTarget(target)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing || isBlocked(event.target)) return
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const editor = useEditorStore.getState()
  const hasSelection = editor.selectedIds.length > 0
  let handled = true

  if (mod && !event.altKey) {
    if (key === 'z') (event.shiftKey ? redo : undo)()
    else if (key === 'y') redo()
    else if (key === 'd') duplicateSelection()
    else if (key === 'a') selectAll()
    else if (key === 'c') handled = copySelection()
    else if (key === 'x') cutSelection()
    else if (key === ']') reorderSelection(event.shiftKey ? 'front' : 'forward')
    else if (key === '[') reorderSelection(event.shiftKey ? 'back' : 'backward')
    else handled = false
  } else if (event.altKey) {
    handled = false
  } else if (key === 'Delete' || key === 'Backspace') {
    if (hasSelection) deleteSelection()
    else handled = false
  } else if (key === 'Escape') {
    if (hasSelection) editor.select([])
    else handled = false
  } else if (key === 'F5') {
    startPresentation(!event.shiftKey)
  } else if (key === 'PageUp') {
    goToSlide(-1)
  } else if (key === 'PageDown') {
    goToSlide(1)
  } else if (key.startsWith('Arrow') && hasSelection) {
    const distance = event.shiftKey ? 10 : 1
    if (key === 'ArrowLeft') nudgeSelection(-distance, 0)
    else if (key === 'ArrowRight') nudgeSelection(distance, 0)
    else if (key === 'ArrowUp') nudgeSelection(0, -distance)
    else nudgeSelection(0, distance)
  } else if (key === 'Enter' && editor.selectedIds.length === 1) {
    // 선택한 텍스트·코드 요소의 내용을 편집합니다.
    const { project } = useProjectStore.getState()
    const element =
      project && resolveActiveSlide(project, editor.activeSlideId).elements.find((el) => el.id === editor.selectedIds[0])
    if (element && !element.locked && element.type === 'text') editor.setEditingText(element.id)
    else if (element && !element.locked && element.type === 'code') editor.setEditingCode(element.id)
    else handled = false
  } else {
    handled = false
  }

  if (handled) event.preventDefault()
}

function onPaste(event: ClipboardEvent): void {
  if (isBlocked(event.target)) return
  const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'))
  if (files.length > 0) {
    event.preventDefault()
    void addImageFiles(files)
  } else if (useEditorStore.getState().clipboard.length > 0) {
    event.preventDefault()
    pasteClipboard()
  }
}

/** 편집기 화면의 전역 단축키를 등록합니다. */
export function useShortcuts(): void {
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}
