// 프로젝트 데이터에 대한 순수 변경 함수 모음. React·Zustand·IndexedDB에 의존하지 않습니다.
import { CANVAS_HEIGHT, CANVAS_WIDTH, CURRENT_SCHEMA_VERSION } from '@/domain/constants'
import {
  createDefaultLayouts,
  createDefaultMasters,
  createDefaultThemes,
  DEFAULT_LAYOUT_ID,
  DEFAULT_THEME_ID,
  TITLE_LAYOUT_ID,
} from '@/domain/defaults'
import { createElementFromPlaceholder, hasContent, nextZIndex } from '@/domain/elements'
import { createId, nowIso } from '@/domain/ids'
import type {
  AssetReference,
  ElementAnimation,
  ElementPosition,
  LayoutPlaceholder,
  MasterElement,
  PresentationProject,
  ProjectSummary,
  Slide,
  SlideElement,
  SlideLayout,
  SlideMaster,
  Theme,
  ThemeColors,
} from '@/types/project'

type Project = PresentationProject

function touch(project: Project): Project {
  return { ...project, updatedAt: nowIso() }
}

export function getActiveTheme(project: Project): Theme {
  return project.themes.find((t) => t.id === project.activeThemeId) ?? project.themes[0]
}

export function findSlide(project: Project, slideId: string): Slide | undefined {
  return project.slides.find((s) => s.id === slideId)
}

/** 슬라이드에 적용되는 마스터를 찾습니다: 슬라이드 지정 → 레이아웃의 마스터 → 첫 번째 마스터. */
export function getSlideMaster(project: Project, slide: Slide): SlideMaster | undefined {
  const masterId = slide.masterId ?? project.layouts.find((l) => l.id === slide.layoutId)?.masterId
  return project.masters.find((m) => m.id === masterId) ?? project.masters[0]
}

export function findPlaceholder(project: Project, placeholderId: string): LayoutPlaceholder | undefined {
  for (const layout of project.layouts) {
    const found = layout.placeholders.find((p) => p.id === placeholderId)
    if (found) return found
  }
  return undefined
}

export function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    slideCount: project.slides.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

/** 슬라이드 목록 등에 표시할 제목. 명시적 제목이 없으면 제목 placeholder의 내용을 사용합니다. */
export function getSlideDisplayTitle(project: Project, slide: Slide): string {
  if (slide.title.trim()) return slide.title
  for (const el of slide.elements) {
    if (el.type !== 'text' || !el.placeholderId || !el.content.trim()) continue
    if (findPlaceholder(project, el.placeholderId)?.type === 'title') return el.content.trim()
  }
  return '제목 없음'
}

// ── 프로젝트 ────────────────────────────────────────────────────────────

function buildSlide(project: Pick<Project, 'layouts' | 'canvas'>, theme: Theme, layoutId: string): Slide {
  const layout = project.layouts.find((l) => l.id === layoutId)
  const now = nowIso()
  const elements: SlideElement[] = []
  for (const placeholder of layout?.placeholders ?? []) {
    const element = createElementFromPlaceholder(placeholder, theme, project.canvas)
    if (element) elements.push(element)
  }
  return {
    id: createId('slide'),
    title: '',
    masterId: layout?.masterId,
    layoutId: layout?.id,
    elements,
    animations: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createProject(name: string): Project {
  const themes = createDefaultThemes()
  const theme = themes.find((t) => t.id === DEFAULT_THEME_ID) ?? themes[0]
  const now = nowIso()
  const base = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: createId('project'),
    name: name.trim() || '제목 없는 프레젠테이션',
    createdAt: now,
    updatedAt: now,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: theme.colors.background },
    activeThemeId: theme.id,
    themes,
    masters: createDefaultMasters(theme),
    layouts: createDefaultLayouts(),
    assetRefs: [],
  }
  return { ...base, slides: [buildSlide(base, theme, TITLE_LAYOUT_ID)] }
}

export function renameProject(project: Project, name: string): Project {
  const trimmed = name.trim()
  if (!trimmed || trimmed === project.name) return project
  return touch({ ...project, name: trimmed })
}

// ── 슬라이드 ────────────────────────────────────────────────────────────

export function addSlide(
  project: Project,
  options: { layoutId?: string; afterSlideId?: string } = {},
): { project: Project; slideId: string } {
  const layoutId =
    options.layoutId ??
    (project.layouts.some((l) => l.id === DEFAULT_LAYOUT_ID) ? DEFAULT_LAYOUT_ID : project.layouts[0]?.id)
  const slide = buildSlide(project, getActiveTheme(project), layoutId ?? '')
  const index = project.slides.findIndex((s) => s.id === options.afterSlideId)
  const slides = [...project.slides]
  slides.splice(index === -1 ? slides.length : index + 1, 0, slide)
  return { project: touch({ ...project, slides }), slideId: slide.id }
}

function cloneElements(elements: readonly SlideElement[]): { elements: SlideElement[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  const cloned = elements.map((el) => {
    const id = createId('element')
    idMap.set(el.id, id)
    return { ...structuredClone(el), id }
  })
  return { elements: cloned, idMap }
}

export function duplicateSlide(project: Project, slideId: string): { project: Project; slideId: string } | null {
  const index = project.slides.findIndex((s) => s.id === slideId)
  if (index === -1) return null
  const source = project.slides[index]
  const { elements, idMap } = cloneElements(source.elements)
  const now = nowIso()
  const copy: Slide = {
    ...structuredClone(source),
    id: createId('slide'),
    elements,
    animations: source.animations.flatMap((anim) => {
      const elementId = idMap.get(anim.elementId)
      return elementId ? [{ ...anim, id: createId('animation'), elementId }] : []
    }),
    createdAt: now,
    updatedAt: now,
  }
  const slides = [...project.slides]
  slides.splice(index + 1, 0, copy)
  return { project: touch({ ...project, slides }), slideId: copy.id }
}

/** 마지막 한 장은 삭제하지 않습니다. */
export function deleteSlide(project: Project, slideId: string): Project {
  if (project.slides.length <= 1) return project
  const slides = project.slides.filter((s) => s.id !== slideId)
  if (slides.length === project.slides.length) return project
  return touch({ ...project, slides })
}

export function moveSlide(project: Project, fromIndex: number, toIndex: number): Project {
  const count = project.slides.length
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= count || toIndex >= count) {
    return project
  }
  const slides = [...project.slides]
  const [moved] = slides.splice(fromIndex, 1)
  slides.splice(toIndex, 0, moved)
  return touch({ ...project, slides })
}

function mapSlide(project: Project, slideId: string, fn: (slide: Slide) => Slide): Project {
  let changed = false
  const slides = project.slides.map((slide) => {
    if (slide.id !== slideId) return slide
    const next = fn(slide)
    if (next === slide) return slide
    changed = true
    return { ...next, updatedAt: nowIso() }
  })
  return changed ? touch({ ...project, slides }) : project
}

export type SlidePatch = Partial<Pick<Slide, 'title' | 'background' | 'speakerNotes' | 'transition'>>

export function updateSlide(project: Project, slideId: string, patch: SlidePatch): Project {
  return mapSlide(project, slideId, (slide) => ({ ...slide, ...patch }))
}

export function setAnimations(project: Project, slideId: string, animations: ElementAnimation[]): Project {
  return mapSlide(project, slideId, (slide) => ({
    ...slide,
    animations: animations.map((anim, index) => ({ ...anim, order: index })),
  }))
}

// ── 요소 ────────────────────────────────────────────────────────────────

export function addElement(project: Project, slideId: string, element: SlideElement): Project {
  return mapSlide(project, slideId, (slide) => ({ ...slide, elements: [...slide.elements, element] }))
}

export function updateElement(
  project: Project,
  slideId: string,
  elementId: string,
  fn: (element: SlideElement) => SlideElement,
): Project {
  return mapSlide(project, slideId, (slide) => {
    let changed = false
    const elements = slide.elements.map((el) => {
      if (el.id !== elementId) return el
      const next = fn(el)
      if (next !== el) changed = true
      return next
    })
    return changed ? { ...slide, elements } : slide
  })
}

export function patchElementPositions(
  project: Project,
  slideId: string,
  patches: Record<string, Partial<ElementPosition>>,
): Project {
  return mapSlide(project, slideId, (slide) => ({
    ...slide,
    elements: slide.elements.map((el) => {
      const patch = patches[el.id]
      return patch ? ({ ...el, position: { ...el.position, ...patch } } as SlideElement) : el
    }),
  }))
}

export function removeElements(project: Project, slideId: string, elementIds: readonly string[]): Project {
  const ids = new Set(elementIds)
  return mapSlide(project, slideId, (slide) => {
    const elements = slide.elements.filter((el) => !ids.has(el.id))
    if (elements.length === slide.elements.length) return slide
    return {
      ...slide,
      elements,
      animations: slide.animations.filter((anim) => !ids.has(anim.elementId)),
    }
  })
}

/** 요소 사본을 슬라이드에 추가합니다. 붙여넣기와 복제에 함께 사용합니다. */
export function insertElementCopies(
  project: Project,
  slideId: string,
  sources: readonly SlideElement[],
  offset = 20,
): { project: Project; newIds: string[] } {
  const slide = findSlide(project, slideId)
  if (!slide || sources.length === 0) return { project, newIds: [] }
  let z = nextZIndex(slide.elements)
  const ordered = [...sources].sort((a, b) => a.position.zIndex - b.position.zIndex)
  const { elements: copies } = cloneElements(ordered)
  const placed = copies.map((copy) => {
    const { placeholderId: _placeholderId, ...rest } = copy
    return {
      ...rest,
      locked: false,
      position: { ...copy.position, x: copy.position.x + offset, y: copy.position.y + offset, zIndex: z++ },
    } as SlideElement
  })
  const next = mapSlide(project, slideId, (s) => ({ ...s, elements: [...s.elements, ...placed] }))
  return { project: next, newIds: placed.map((el) => el.id) }
}

export function duplicateElements(
  project: Project,
  slideId: string,
  elementIds: readonly string[],
): { project: Project; newIds: string[] } {
  const ids = new Set(elementIds)
  const sources = findSlide(project, slideId)?.elements.filter((el) => ids.has(el.id)) ?? []
  return insertElementCopies(project, slideId, sources)
}

export type ReorderDirection = 'front' | 'back' | 'forward' | 'backward'

/** 레이어 순서를 바꾸고 zIndex를 1..n으로 다시 매깁니다. */
export function reorderElement(
  project: Project,
  slideId: string,
  elementId: string,
  direction: ReorderDirection,
): Project {
  return mapSlide(project, slideId, (slide) => {
    const ordered = [...slide.elements].sort((a, b) => a.position.zIndex - b.position.zIndex)
    const from = ordered.findIndex((el) => el.id === elementId)
    if (from === -1) return slide
    const last = ordered.length - 1
    const to =
      direction === 'front'
        ? last
        : direction === 'back'
          ? 0
          : direction === 'forward'
            ? Math.min(last, from + 1)
            : Math.max(0, from - 1)
    if (to === from) return slide
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    const zById = new Map(ordered.map((el, index) => [el.id, index + 1]))
    return {
      ...slide,
      elements: slide.elements.map(
        (el) => ({ ...el, position: { ...el.position, zIndex: zById.get(el.id) ?? el.position.zIndex } }) as SlideElement,
      ),
    }
  })
}

// ── Asset ───────────────────────────────────────────────────────────────

export function addAssetRef(project: Project, ref: AssetReference): Project {
  return touch({ ...project, assetRefs: [...project.assetRefs, ref] })
}

export function collectUsedAssetIds(project: Project): Set<string> {
  const used = new Set<string>()
  for (const master of project.masters) {
    if (master.background?.assetId) used.add(master.background.assetId)
  }
  for (const slide of project.slides) {
    if (slide.background?.assetId) used.add(slide.background.assetId)
    for (const el of slide.elements) {
      if (el.type === 'image' && el.assetId) used.add(el.assetId)
    }
  }
  return used
}

/** 어떤 슬라이드에서도 참조하지 않는 Asset 참조를 제거합니다. */
export function pruneUnusedAssets(project: Project): { project: Project; removed: AssetReference[] } {
  const used = collectUsedAssetIds(project)
  const removed = project.assetRefs.filter((ref) => !used.has(ref.id))
  if (removed.length === 0) return { project, removed }
  return { project: { ...project, assetRefs: project.assetRefs.filter((ref) => used.has(ref.id)) }, removed }
}

// ── 레이아웃·테마 ───────────────────────────────────────────────────────

/**
 * 슬라이드의 레이아웃을 바꿉니다. 같은 종류의 placeholder에 연결된 기존 요소는 새 위치로 옮기고,
 * 새 레이아웃에 자리가 없는 요소는 콘텐츠가 있으면 일반 요소로 남기고 비어 있으면 제거합니다.
 */
export function applyLayout(project: Project, slideId: string, layoutId: string): Project {
  const layout: SlideLayout | undefined = project.layouts.find((l) => l.id === layoutId)
  if (!layout) return project
  const theme = getActiveTheme(project)

  return mapSlide(project, slideId, (slide) => {
    const free: SlideElement[] = []
    const bound: { element: SlideElement; type: string }[] = []
    for (const el of slide.elements) {
      const placeholder = el.placeholderId ? findPlaceholder(project, el.placeholderId) : undefined
      if (placeholder) bound.push({ element: el, type: placeholder.type })
      else free.push(el)
    }

    const result: SlideElement[] = [...free]
    for (const placeholder of layout.placeholders) {
      const matchIndex = bound.findIndex((b) => b.type === placeholder.type)
      if (matchIndex !== -1) {
        const [{ element }] = bound.splice(matchIndex, 1)
        result.push({
          ...element,
          placeholderId: placeholder.id,
          position: { ...element.position, ...placeholder.position, zIndex: element.position.zIndex },
        } as SlideElement)
      } else {
        const created = createElementFromPlaceholder(placeholder, theme, project.canvas)
        if (created) {
          created.position.zIndex = nextZIndex(result.concat(bound.map((b) => b.element)))
          result.push(created)
        }
      }
    }
    for (const { element } of bound) {
      if (!hasContent(element)) continue
      const { placeholderId: _placeholderId, ...rest } = element
      result.push(rest as SlideElement)
    }

    const keptIds = new Set(result.map((el) => el.id))
    return {
      ...slide,
      layoutId: layout.id,
      masterId: layout.masterId,
      elements: result,
      animations: slide.animations.filter((anim) => keptIds.has(anim.elementId)),
    }
  })
}

// 텍스트 계열 역할이 나중에 오도록 해, 이전 테마에서 색이 겹칠 때 텍스트 색 매핑이 우선합니다.
const COLOR_ROLE_ORDER: (keyof ThemeColors)[] = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'border',
  'mutedText',
  'text',
]

function buildRemap<K extends string>(keys: readonly K[], from: Record<K, string>, to: Record<K, string>) {
  const map = new Map<string, string>()
  for (const key of keys) map.set(from[key].toLowerCase(), to[key])
  return <V extends string | undefined>(value: V): V =>
    value === undefined ? value : ((map.get(value.toLowerCase()) ?? value) as V)
}

/**
 * 활성 테마를 바꿉니다. 이전 테마의 색·글꼴을 그대로 쓰고 있던 값만 새 테마 값으로 바꾸므로
 * 사용자가 직접 지정한 스타일은 유지됩니다.
 */
export function setActiveTheme(project: Project, themeId: string): Project {
  const next = project.themes.find((t) => t.id === themeId)
  const prev = getActiveTheme(project)
  if (!next || next.id === prev.id) return project

  const color = buildRemap(COLOR_ROLE_ORDER, prev.colors, next.colors)
  const font = buildRemap(
    ['headingFontFamily', 'bodyFontFamily', 'codeFontFamily'] as const,
    prev.typography,
    next.typography,
  )

  function remapElement<T extends SlideElement | MasterElement>(el: T): T {
    switch (el.type) {
      case 'text':
        return {
          ...el,
          style: {
            ...el.style,
            color: color(el.style.color),
            backgroundColor: color(el.style.backgroundColor),
            fontFamily: font(el.style.fontFamily),
          },
        }
      case 'shape':
        return { ...el, style: { ...el.style, fill: color(el.style.fill), stroke: color(el.style.stroke) } }
      case 'code':
        return { ...el, fontFamily: font(el.fontFamily) }
      default:
        return el
    }
  }

  return touch({
    ...project,
    activeThemeId: next.id,
    canvas: { ...project.canvas, backgroundColor: color(project.canvas.backgroundColor) },
    masters: project.masters.map((master) => ({
      ...master,
      background: master.background && { ...master.background, color: color(master.background.color) },
      elements: master.elements.map(remapElement),
    })),
    slides: project.slides.map((slide) => ({
      ...slide,
      background: slide.background && { ...slide.background, color: color(slide.background.color) },
      elements: slide.elements.map(remapElement),
    })),
  })
}
