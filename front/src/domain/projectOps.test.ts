import { describe, expect, it } from 'vitest'
import { createElementFromPlaceholder, createShapeElement, createTextElement } from '@/domain/elements'
import {
  addAssetRef,
  addElement,
  addSlide,
  applyLayout,
  createProject,
  deleteSlide,
  duplicateElements,
  duplicateSlide,
  findPlaceholder,
  getActiveTheme,
  moveSlide,
  pruneUnusedAssets,
  removeElements,
  reorderElement,
  setActiveTheme,
  setAnimations,
  updateElement,
} from '@/domain/projectOps'
import { validateProject } from '@/domain/validation'
import type { PresentationProject, SlideElement, TextElement } from '@/types/project'

function withText(project: PresentationProject, slideId: string, content: string) {
  const el = { ...createTextElement(getActiveTheme(project), project.canvas, 10), content }
  return { project: addElement(project, slideId, el), element: el }
}

describe('createProject', () => {
  it('검증을 통과하는 기본 프로젝트를 만든다', () => {
    const project = createProject('테스트')
    const result = validateProject(project)
    expect(result).toMatchObject({ ok: true })
    expect(project.slides).toHaveLength(1)
    expect(project.canvas).toMatchObject({ width: 1280, height: 720 })
  })

  it('이름이 비어 있으면 기본 이름을 쓴다', () => {
    expect(createProject('   ').name).toBe('제목 없는 프레젠테이션')
  })
})

describe('슬라이드 조작', () => {
  it('지정한 슬라이드 뒤에 새 슬라이드를 추가한다', () => {
    let project = createProject('p')
    const first = project.slides[0].id
    const a = addSlide(project)
    project = a.project
    const b = addSlide(project, { afterSlideId: first, layoutId: 'layout_blank' })
    project = b.project
    expect(project.slides.map((s) => s.id)).toEqual([first, b.slideId, a.slideId])
    expect(project.slides[1].elements).toHaveLength(0)
    expect(validateProject(project).ok).toBe(true)
  })

  it('복제 시 슬라이드·요소·애니메이션 ID를 재발급하고 참조를 다시 연결한다', () => {
    let project = createProject('p')
    const slide = project.slides[0]
    project = setAnimations(project, slide.id, [
      {
        id: 'animation_1',
        elementId: slide.elements[0].id,
        effect: 'fadeIn',
        trigger: 'onClick',
        duration: 400,
        delay: 0,
        order: 0,
      },
    ])
    const result = duplicateSlide(project, slide.id)!
    const copy = result.project.slides[1]
    expect(copy.id).not.toBe(slide.id)
    expect(copy.elements.map((e) => e.id)).not.toEqual(slide.elements.map((e) => e.id))
    expect(copy.animations[0].elementId).toBe(copy.elements[0].id)
    expect(copy.animations[0].id).not.toBe('animation_1')
    expect(validateProject(result.project).ok).toBe(true)
  })

  it('마지막 슬라이드는 삭제하지 않는다', () => {
    const project = createProject('p')
    expect(deleteSlide(project, project.slides[0].id)).toBe(project)
    const two = addSlide(project).project
    expect(deleteSlide(two, two.slides[0].id).slides).toHaveLength(1)
  })

  it('슬라이드 순서를 바꾼다', () => {
    let project = createProject('p')
    project = addSlide(project).project
    project = addSlide(project).project
    const ids = project.slides.map((s) => s.id)
    expect(moveSlide(project, 0, 2).slides.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]])
    expect(moveSlide(project, 0, 9)).toBe(project)
  })
})

describe('요소 조작', () => {
  it('요소 삭제 시 연결된 애니메이션도 제거한다', () => {
    let project = createProject('p')
    const slide = project.slides[0]
    const target = slide.elements[0].id
    project = setAnimations(project, slide.id, [
      { id: 'animation_1', elementId: target, effect: 'appear', trigger: 'onClick', duration: 0, delay: 0, order: 0 },
    ])
    project = removeElements(project, slide.id, [target])
    expect(project.slides[0].elements.some((e) => e.id === target)).toBe(false)
    expect(project.slides[0].animations).toHaveLength(0)
  })

  it('복제한 요소는 새 ID와 가장 높은 zIndex를 갖고 placeholder 연결이 끊긴다', () => {
    const project = createProject('p')
    const slide = project.slides[0]
    const source = slide.elements[0]
    const { project: next, newIds } = duplicateElements(project, slide.id, [source.id])
    const copy = next.slides[0].elements.find((e) => e.id === newIds[0])!
    expect(copy.id).not.toBe(source.id)
    expect(copy.placeholderId).toBeUndefined()
    expect(copy.position.x).toBe(source.position.x + 20)
    expect(copy.position.zIndex).toBeGreaterThan(Math.max(...slide.elements.map((e) => e.position.zIndex)))
  })

  it('레이어 순서를 바꾸면 zIndex가 1..n으로 정규화된다', () => {
    let project = createProject('p')
    const slideId = project.slides[0].id
    const theme = getActiveTheme(project)
    const shape = createShapeElement(theme, project.canvas, 99, 'rectangle')
    project = addElement(project, slideId, shape)
    project = reorderElement(project, slideId, shape.id, 'back')
    const zs = project.slides[0].elements.map((e) => e.position.zIndex).sort((a, b) => a - b)
    expect(zs).toEqual([1, 2, 3])
    expect(project.slides[0].elements.find((e) => e.id === shape.id)!.position.zIndex).toBe(1)
    expect(reorderElement(project, slideId, shape.id, 'backward')).toBe(project)
  })

  it('변경이 없으면 같은 프로젝트 참조를 돌려준다', () => {
    const project = createProject('p')
    expect(updateElement(project, project.slides[0].id, 'missing', (e) => ({ ...e }))).toBe(project)
  })
})

describe('applyLayout', () => {
  it('같은 종류의 placeholder 콘텐츠를 보존하고 새 위치로 옮긴다', () => {
    let project = createProject('p')
    const slideId = project.slides[0].id
    const title = project.slides[0].elements.find(
      (e) => findPlaceholder(project, e.placeholderId!)?.type === 'title',
    )!
    project = updateElement(project, slideId, title.id, (e) => ({ ...(e as TextElement), content: '안녕하세요' }))
    const { project: withFree, element: free } = withText(project, slideId, '자유 텍스트')

    const next = applyLayout(withFree, slideId, 'layout_title_code')
    const slide = next.slides[0]
    const movedTitle = slide.elements.find((e) => e.id === title.id) as TextElement
    expect(movedTitle.content).toBe('안녕하세요')
    expect(movedTitle.placeholderId).toBe('placeholder_tc_title')
    expect(movedTitle.position.y).toBe(48)
    expect(slide.elements.some((e) => e.type === 'code')).toBe(true)
    // 비어 있던 부제목은 제거되고, 자유 요소는 남는다
    expect(slide.elements.some((e) => e.placeholderId === 'placeholder_title_sub')).toBe(false)
    expect(slide.elements.some((e) => e.id === free.id)).toBe(true)
    expect(slide.layoutId).toBe('layout_title_code')
    expect(validateProject(next).ok).toBe(true)
  })

  it('새 레이아웃에 자리가 없어도 내용이 있는 요소는 일반 요소로 남긴다', () => {
    let project = createProject('p')
    const slideId = project.slides[0].id
    const subtitle = project.slides[0].elements.find((e) => e.placeholderId === 'placeholder_title_sub')!
    project = updateElement(project, slideId, subtitle.id, (e) => ({ ...(e as TextElement), content: '부제' }))
    const next = applyLayout(project, slideId, 'layout_blank')
    const kept = next.slides[0].elements.find((e) => e.id === subtitle.id) as TextElement
    expect(kept.content).toBe('부제')
    expect(kept.placeholderId).toBeUndefined()
    expect(next.slides[0].elements).toHaveLength(1)
  })
})

describe('setActiveTheme', () => {
  it('이전 테마 색을 쓰던 값만 새 테마 색으로 바꾼다', () => {
    let project = createProject('p')
    const slideId = project.slides[0].id
    const before = getActiveTheme(project)
    const custom: SlideElement = {
      ...createTextElement(before, project.canvas, 20),
      content: '사용자 색',
      style: { fontSize: 20, color: '#123456' },
    }
    project = addElement(project, slideId, custom)

    const next = setActiveTheme(project, 'theme_dark')
    const after = getActiveTheme(next)
    expect(after.id).toBe('theme_dark')
    expect(next.canvas.backgroundColor).toBe(after.colors.background)
    const title = next.slides[0].elements[0] as TextElement
    expect(title.style.color).toBe(after.colors.text)
    expect((next.slides[0].elements.find((e) => e.id === custom.id) as TextElement).style.color).toBe('#123456')
    const bar = next.masters[0].elements[0]
    expect(bar.type === 'shape' && bar.style.fill).toBe(after.colors.primary)
  })

  it('없는 테마이면 변경하지 않는다', () => {
    const project = createProject('p')
    expect(setActiveTheme(project, 'theme_none')).toBe(project)
  })
})

describe('pruneUnusedAssets', () => {
  it('참조되지 않는 Asset만 제거한다', () => {
    let project = createProject('p')
    const slideId = project.slides[0].id
    const ref = (id: string) => ({
      id,
      name: `${id}.png`,
      mimeType: 'image/png',
      size: 1,
      storageKey: `${project.id}/${id}`,
      createdAt: project.createdAt,
    })
    project = addAssetRef(addAssetRef(project, ref('asset_used')), ref('asset_orphan'))
    project = addElement(project, slideId, {
      id: 'element_img',
      type: 'image',
      assetId: 'asset_used',
      alt: '',
      fit: 'contain',
      position: { x: 0, y: 0, width: 10, height: 10, zIndex: 50 },
      visible: true,
      locked: false,
    })
    const { project: pruned, removed } = pruneUnusedAssets(project)
    expect(removed.map((r) => r.id)).toEqual(['asset_orphan'])
    expect(pruned.assetRefs.map((r) => r.id)).toEqual(['asset_used'])
  })
})

describe('createElementFromPlaceholder', () => {
  it('defaultStyle을 텍스트 스타일에 반영한다', () => {
    const project = createProject('p')
    const placeholder = findPlaceholder(project, 'placeholder_title_main')!
    const el = createElementFromPlaceholder(placeholder, getActiveTheme(project), project.canvas) as TextElement
    expect(el.style.textAlign).toBe('center')
    expect(el.style.fontSize).toBe(64)
    expect(el.placeholderId).toBe('placeholder_title_main')
  })
})
