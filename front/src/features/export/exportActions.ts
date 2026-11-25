// 내보내기 명령. 프로젝트 목록과 편집기 툴바가 함께 사용합니다.
import { toast } from 'sonner'
import { JsonExporter } from '@/services/export/jsonBackup'
import { assetRepository } from '@/services/storage'
import type { PresentationProject } from '@/types/project'
import { downloadBlob, sanitizeFilename } from '@/utils/download'

const MAX_WARNINGS_SHOWN = 4

export async function exportJson(project: PresentationProject): Promise<void> {
  try {
    const blob = await new JsonExporter(assetRepository).export(project)
    downloadBlob(blob, `${sanitizeFilename(project.name)}.json`)
    toast.success('JSON 백업 파일을 내보냈습니다.')
  } catch (error) {
    console.error('JSON 내보내기 실패', error)
    toast.error('JSON 백업을 만들지 못했습니다.', {
      description: error instanceof Error ? error.message : undefined,
    })
  }
}

export async function exportPptx(project: PresentationProject): Promise<void> {
  const toastId = toast.loading('PPTX 파일을 만드는 중…')
  try {
    // PptxGenJS는 용량이 크므로 내보낼 때만 불러옵니다.
    const { PptxExporter } = await import('@/services/export/pptxExporter')
    const exporter = new PptxExporter(assetRepository)
    const blob = await exporter.export(project)
    downloadBlob(blob, `${sanitizeFilename(project.name)}.${exporter.fileExtension}`)

    const { warnings } = exporter
    const shown = warnings.slice(0, MAX_WARNINGS_SHOWN)
    if (warnings.length > shown.length) shown.push(`외 ${warnings.length - shown.length}건`)
    toast.success('PPTX 파일을 내보냈습니다.', {
      id: toastId,
      description: shown.length > 0 ? shown.join('\n') : '글꼴은 파일에 포함되지 않으므로 다른 PC에서는 다르게 보일 수 있습니다.',
      duration: warnings.length > 0 ? 10_000 : 5000,
    })
  } catch (error) {
    console.error('PPTX 내보내기 실패', error)
    toast.error('PPTX 파일을 만들지 못했습니다.', {
      id: toastId,
      description: error instanceof Error ? error.message : undefined,
    })
  }
}

export async function exportPdf(project: PresentationProject): Promise<void> {
  const toastId = toast.loading('인쇄용 페이지를 준비하는 중…')
  try {
    const { printSlides } = await import('@/features/export/printSlides')
    await printSlides(project)
    toast.dismiss(toastId)
  } catch (error) {
    console.error('PDF 내보내기 실패', error)
    toast.error('인쇄 화면을 열지 못했습니다.', { id: toastId })
  }
}
