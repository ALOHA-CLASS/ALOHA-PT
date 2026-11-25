import type { PresentationProject } from '@/types/project'

export interface ExportOptions {
  signal?: AbortSignal
}

/** 편집기 상태를 읽거나 수정하지 않고 프로젝트 데이터만으로 파일을 만드는 변환기. */
export interface PresentationExporter {
  readonly fileExtension: string
  export(project: PresentationProject, options?: ExportOptions): Promise<Blob>
}
