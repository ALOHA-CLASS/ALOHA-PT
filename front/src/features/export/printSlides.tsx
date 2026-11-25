// PDF 내보내기: 모든 슬라이드를 인쇄용 페이지로 그린 뒤 브라우저 인쇄 기능을 엽니다.
import { createRoot } from 'react-dom/client'
import { PrintDocument } from '@/features/export/PrintDocument'
import type { PresentationProject } from '@/types/project'

const READY_TIMEOUT_MS = 8000

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** 이미지와 구문 강조가 모두 그려질 때까지 기다립니다. 제한 시간이 지나면 그대로 진행합니다. */
async function waitUntilReady(host: HTMLElement, expectedImages: number): Promise<void> {
  const deadline = performance.now() + READY_TIMEOUT_MS
  while (performance.now() < deadline) {
    await nextFrame()
    const images = [...host.querySelectorAll('img')]
    const ready =
      host.querySelector('.print-page') !== null &&
      host.querySelector('[data-code-pending]') === null &&
      images.length >= expectedImages &&
      images.every((image) => image.complete)
    if (ready) return
  }
}

let cleanupPrevious: (() => void) | null = null

export async function printSlides(project: PresentationProject): Promise<void> {
  cleanupPrevious?.()

  const { width, height } = project.canvas
  const host = document.createElement('div')
  host.className = 'print-root'
  const pageStyle = document.createElement('style')
  pageStyle.textContent = `@page { size: ${width}px ${height}px; margin: 0; }`
  document.head.appendChild(pageStyle)
  document.body.appendChild(host)

  const root = createRoot(host)
  const previousTitle = document.title
  const cleanup = () => {
    if (cleanupPrevious !== cleanup) return
    cleanupPrevious = null
    window.removeEventListener('afterprint', cleanup)
    document.title = previousTitle
    root.unmount()
    host.remove()
    pageStyle.remove()
  }
  cleanupPrevious = cleanup

  root.render(<PrintDocument project={project} />)
  const assetIds = new Set(project.assetRefs.map((ref) => ref.id))
  const expectedImages = project.slides
    .flatMap((slide) => slide.elements)
    .filter((el) => el.visible && el.type === 'image' && el.assetId && assetIds.has(el.assetId)).length
  await waitUntilReady(host, expectedImages)

  // 인쇄 대화상자의 기본 파일 이름으로 프로젝트 이름이 쓰이게 합니다.
  document.title = project.name
  window.addEventListener('afterprint', cleanup)
  window.print()
}
