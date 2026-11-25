import { projectSchema } from '@/domain/schema'
import type { PresentationProject } from '@/types/project'

export type ValidationResult =
  | { ok: true; project: PresentationProject }
  | { ok: false; errors: string[] }

/** ID 중복과 참조 무결성을 검사해 문제 목록을 반환합니다. */
export function checkIntegrity(project: PresentationProject): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const claim = (id: string, label: string) => {
    if (seen.has(id)) errors.push(`중복된 ID: ${id} (${label})`)
    seen.add(id)
  }

  claim(project.id, '프로젝트')
  for (const theme of project.themes) claim(theme.id, '테마')
  for (const asset of project.assetRefs) claim(asset.id, 'Asset')

  const themeIds = new Set(project.themes.map((t) => t.id))
  const masterIds = new Set(project.masters.map((m) => m.id))
  const layoutIds = new Set(project.layouts.map((l) => l.id))
  const assetIds = new Set(project.assetRefs.map((a) => a.id))
  const placeholderIds = new Set<string>()

  if (!themeIds.has(project.activeThemeId)) {
    errors.push(`activeThemeId가 존재하지 않는 테마를 가리킵니다: ${project.activeThemeId}`)
  }

  for (const master of project.masters) {
    claim(master.id, '마스터')
    for (const el of master.elements) claim(el.id, '마스터 요소')
    if (master.background?.assetId && !assetIds.has(master.background.assetId)) {
      errors.push(`마스터 "${master.name}"의 배경 Asset을 찾을 수 없습니다.`)
    }
  }

  for (const layout of project.layouts) {
    claim(layout.id, '레이아웃')
    if (!masterIds.has(layout.masterId)) {
      errors.push(`레이아웃 "${layout.name}"이 존재하지 않는 마스터를 참조합니다: ${layout.masterId}`)
    }
    for (const placeholder of layout.placeholders) {
      claim(placeholder.id, 'placeholder')
      placeholderIds.add(placeholder.id)
    }
  }

  project.slides.forEach((slide, index) => {
    const label = `슬라이드 ${index + 1}`
    claim(slide.id, label)
    if (slide.masterId && !masterIds.has(slide.masterId)) {
      errors.push(`${label}이 존재하지 않는 마스터를 참조합니다: ${slide.masterId}`)
    }
    if (slide.layoutId && !layoutIds.has(slide.layoutId)) {
      errors.push(`${label}이 존재하지 않는 레이아웃을 참조합니다: ${slide.layoutId}`)
    }
    if (slide.background?.assetId && !assetIds.has(slide.background.assetId)) {
      errors.push(`${label}의 배경 Asset을 찾을 수 없습니다.`)
    }

    const elementIds = new Set<string>()
    for (const el of slide.elements) {
      claim(el.id, `${label} 요소`)
      elementIds.add(el.id)
      if (el.placeholderId && !placeholderIds.has(el.placeholderId)) {
        errors.push(`${label}의 요소가 존재하지 않는 placeholder를 참조합니다: ${el.placeholderId}`)
      }
      if (el.type === 'image' && el.assetId && !assetIds.has(el.assetId)) {
        errors.push(`${label}의 이미지가 존재하지 않는 Asset을 참조합니다: ${el.assetId}`)
      }
    }
    for (const anim of slide.animations) {
      claim(anim.id, `${label} 애니메이션`)
      if (!elementIds.has(anim.elementId)) {
        errors.push(`${label}의 애니메이션이 존재하지 않는 요소를 참조합니다: ${anim.elementId}`)
      }
    }
  })

  return errors
}

/**
 * 스키마와 참조 무결성을 함께 검증합니다.
 * 알 수 없는 요소 타입은 대체 요소로 복원하지 않고 오류로 처리합니다.
 */
export function validateProject(data: unknown): ValidationResult {
  const parsed = projectSchema.safeParse(data)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 20).map((issue) => {
        const path = issue.path.join('.')
        return path ? `${path}: ${issue.message}` : issue.message
      }),
    }
  }
  const integrity = checkIntegrity(parsed.data)
  if (integrity.length > 0) return { ok: false, errors: integrity.slice(0, 20) }
  return { ok: true, project: parsed.data }
}
