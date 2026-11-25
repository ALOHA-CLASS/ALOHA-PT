import { getSlideMaster } from '@/domain/projectOps'
import { SlideView } from '@/features/canvas/SlideView'
import type { PresentationProject } from '@/types/project'

/** 인쇄(PDF)용으로 모든 슬라이드를 한 페이지에 한 장씩 그립니다. */
export function PrintDocument({ project }: { project: PresentationProject }) {
  return (
    <>
      {project.slides.map((slide) => (
        <div key={slide.id} className="print-page" style={{ width: project.canvas.width, height: project.canvas.height }}>
          <SlideView
            slide={slide}
            canvas={project.canvas}
            master={getSlideMaster(project, slide)}
            assets={project.assetRefs}
            mode="present"
          />
        </div>
      ))}
    </>
  )
}
