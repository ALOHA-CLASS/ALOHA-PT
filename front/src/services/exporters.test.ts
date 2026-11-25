import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parseRoute, projectPath } from '@/app/router'
import { createCodeElement, createShapeElement, createTextElement } from '@/domain/elements'
import { addElement, createProject, getActiveTheme, setAnimations, updateSlide } from '@/domain/projectOps'
import { PptxExporter } from '@/services/export/pptxExporter'
import {
  monospaceFontFace,
  normalizeRotation,
  primaryFontFace,
  pxToInch,
  pxToPoint,
  toPptxColor,
} from '@/services/export/pptxUnits'
import { fitRect } from '@/services/export/rasterizeImage'
import type { AssetRepository } from '@/services/storage/assetRepository'
import type { PresentationProject } from '@/types/project'

describe('pptxUnits', () => {
  it('px를 inch·pt로 바꾼다', () => {
    expect(pxToInch(1280)).toBeCloseTo(13.333, 3)
    expect(pxToInch(720)).toBe(7.5)
    expect(pxToPoint(24)).toBe(18)
  })

  it('CSS 색상을 PPTX 색상과 투명도로 바꾼다', () => {
    expect(toPptxColor('#abc')).toEqual({ color: 'AABBCC', transparency: 0 })
    expect(toPptxColor('#2563EB')).toEqual({ color: '2563EB', transparency: 0 })
    expect(toPptxColor('#00000080')).toEqual({ color: '000000', transparency: 50 })
    expect(toPptxColor('rgba(255, 0, 0, 0.25)')).toEqual({ color: 'FF0000', transparency: 75 })
    expect(toPptxColor('rgb(0 128 255 / 50%)')).toEqual({ color: '0080FF', transparency: 50 })
    expect(toPptxColor('#ffffff', 0.5)).toEqual({ color: 'FFFFFF', transparency: 50 })
  })

  it('투명하거나 해석할 수 없는 색은 null로 돌려준다', () => {
    expect(toPptxColor('transparent')).toBeNull()
    expect(toPptxColor(undefined)).toBeNull()
    expect(toPptxColor('#12345')).toBeNull()
    expect(toPptxColor('rebeccapurple')).toBeNull()
    expect(toPptxColor('#ff0000', 0)).toBeNull()
  })

  it('font-family 목록에서 PPTX에 쓸 글꼴을 고른다', () => {
    expect(primaryFontFace("Pretendard, 'Noto Sans KR', sans-serif", 'Arial')).toBe('Pretendard')
    expect(primaryFontFace('sans-serif', 'Arial')).toBe('Arial')
    expect(primaryFontFace(undefined, 'Arial')).toBe('Arial')
    expect(monospaceFontFace("'JetBrains Mono', 'D2Coding', Consolas, 'Courier New', monospace")).toBe('Consolas')
    expect(monospaceFontFace("'Courier New', monospace")).toBe('Courier New')
    expect(monospaceFontFace(undefined)).toBe('Consolas')
  })

  it('회전 각도를 0~359로 맞춘다', () => {
    expect(normalizeRotation(undefined)).toBe(0)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(450)).toBe(90)
  })
})

describe('fitRect', () => {
  it('object-fit 규칙대로 그릴 영역을 계산한다', () => {
    expect(fitRect(200, 100, 100, 100, 'contain')).toEqual({ x: 0, y: 25, width: 100, height: 50 })
    expect(fitRect(200, 100, 100, 100, 'cover')).toEqual({ x: -50, y: 0, width: 200, height: 100 })
    expect(fitRect(200, 100, 100, 100, 'fill')).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })
})

describe('router', () => {
  it('해시를 경로로 해석한다', () => {
    expect(parseRoute('')).toEqual({ name: 'projects' })
    expect(parseRoute('#/')).toEqual({ name: 'projects' })
    expect(parseRoute('#/p/project_abc')).toEqual({ name: 'editor', projectId: 'project_abc' })
    expect(parseRoute(projectPath('a b/c'))).toEqual({ name: 'editor', projectId: 'a b/c' })
  })
})

const noAssets: AssetRepository = {
  put: async () => {},
  get: async () => null,
  delete: async () => {},
}

function sampleProject(): PresentationProject {
  let project = createProject('PPTX 테스트')
  const theme = getActiveTheme(project)
  const first = project.slides[0].id
  const text = { ...createTextElement(theme, project.canvas, 10), content: '안녕하세요 & <ALOHA>\n둘째 줄' }
  const shape = createShapeElement(theme, project.canvas, 11, 'arrow')
  const code = { ...createCodeElement(theme, project.canvas, 12), code: 'int x = 1;\n\nreturn x;', showLineNumbers: true }
  project = addElement(project, first, text)
  project = addElement(project, first, shape)
  project = addElement(project, first, code)
  project = updateSlide(project, first, { speakerNotes: '발표자 노트 내용' })
  project = setAnimations(project, first, [
    { id: 'animation_1', elementId: text.id, effect: 'fadeIn', trigger: 'onClick', duration: 500, delay: 0, order: 0 },
  ])
  return project
}

describe('PptxExporter', () => {
  it('슬라이드·텍스트·도형·코드·노트를 담은 PPTX 파일을 만든다', async () => {
    const project = sampleProject()
    const exporter = new PptxExporter(noAssets)
    const blob = await exporter.export(project)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())

    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    expect(slideFiles).toHaveLength(project.slides.length)

    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string')
    expect(xml).toContain('안녕하세요 &amp; &lt;ALOHA&gt;')
    expect(xml).toContain('둘째 줄')
    expect(xml).toContain('int')
    expect(xml).toContain('return')
    expect(xml).toContain('tailEnd type="triangle"')
    expect(xml).toContain('typeface="Consolas"')

    const presentation = await zip.file('ppt/presentation.xml')!.async('string')
    // 1280×720px = 13.333×7.5in = 12192000×6858000 EMU
    expect(presentation).toContain('cx="12192000" cy="6858000"')

    const notes = await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string')
    expect(notes).toContain('발표자 노트 내용')

    expect(exporter.warnings).toEqual(['애니메이션과 전환 효과는 PPTX에 포함되지 않습니다.'])
  })

  it('외부 URL 이미지는 건너뛰고 경고를 남긴다', async () => {
    let project = createProject('p')
    project = addElement(project, project.slides[0].id, {
      id: 'element_external',
      type: 'image',
      sourceUrl: 'https://example.com/a.png',
      alt: '',
      fit: 'contain',
      visible: true,
      locked: false,
      position: { x: 0, y: 0, width: 100, height: 100, zIndex: 20 },
    })
    const exporter = new PptxExporter(noAssets)
    const blob = await exporter.export(project)
    expect(blob.size).toBeGreaterThan(0)
    expect(exporter.warnings).toEqual(['슬라이드 1: 외부 URL 이미지는 PPTX에 포함되지 않습니다.'])
  })
})
