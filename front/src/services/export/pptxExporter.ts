// 프로젝트 데이터를 PPTX로 변환합니다. 편집기 상태에 의존하지 않습니다.
import type PptxGenJS from 'pptxgenjs'
import { getSlideMaster } from '@/domain/projectOps'
import { highlightCode, type CodeToken } from '@/features/code-editor/highlighter'
import {
  monospaceFontFace,
  normalizeRotation,
  primaryFontFace,
  pxToInch,
  pxToPoint,
  toPptxColor,
} from '@/services/export/pptxUnits'
import { rasterizeImage, type RasterizeImage } from '@/services/export/rasterizeImage'
import type { ExportOptions, PresentationExporter } from '@/services/export/types'
import type { AssetRepository } from '@/services/storage/assetRepository'
import type {
  Background,
  CodeElement,
  ElementPosition,
  ImageElement,
  PresentationProject,
  ShapeElement,
  Slide,
  TextElement,
} from '@/types/project'

type PptxSlide = PptxGenJS.Slide

const LAYOUT_NAME = 'ALOHA_CANVAS'
const DEFAULT_FONT = 'Malgun Gothic'
// CSS line-height는 글자 크기 기준이고 PowerPoint 줄 간격 배수는 글꼴의 기본 줄 높이(약 1.2배) 기준입니다.
const FONT_LINE_RATIO = 1.2

function frame(position: ElementPosition) {
  return {
    x: pxToInch(position.x),
    y: pxToInch(position.y),
    w: pxToInch(position.width),
    h: pxToInch(position.height),
    rotate: normalizeRotation(position.rotation),
  }
}

function isBold(weight: TextElement['style']['fontWeight']): boolean {
  return weight === 'bold' || (typeof weight === 'number' && weight >= 600)
}

export class PptxExporter implements PresentationExporter {
  readonly fileExtension = 'pptx'
  /** 마지막 내보내기에서 PPTX로 그대로 옮기지 못한 항목 */
  warnings: string[] = []

  private readonly assets: AssetRepository
  private readonly rasterize: RasterizeImage

  constructor(assets: AssetRepository, rasterize: RasterizeImage = rasterizeImage) {
    this.assets = assets
    this.rasterize = rasterize
  }

  async export(project: PresentationProject, options?: ExportOptions): Promise<Blob> {
    const warnings = new Set<string>()
    const { default: Pptx } = await import('pptxgenjs')
    const pptx = new Pptx()
    pptx.title = project.name
    pptx.defineLayout({
      name: LAYOUT_NAME,
      width: pxToInch(project.canvas.width),
      height: pxToInch(project.canvas.height),
    })
    pptx.layout = LAYOUT_NAME

    for (const [index, slide] of project.slides.entries()) {
      options?.signal?.throwIfAborted()
      const label = `슬라이드 ${index + 1}`
      const target = pptx.addSlide()
      const master = getSlideMaster(project, slide)
      await this.applyBackground(target, project, slide.background ?? master?.background, label, warnings)

      const elements = [
        ...(master?.elements ?? []).toSorted((a, b) => a.position.zIndex - b.position.zIndex),
        ...slide.elements.toSorted((a, b) => a.position.zIndex - b.position.zIndex),
      ]
      for (const element of elements) {
        if (!element.visible) continue
        switch (element.type) {
          case 'text':
            this.addText(pptx, target, element)
            break
          case 'shape':
            this.addShape(pptx, target, element)
            break
          case 'image':
            await this.addImage(target, project, element, label, warnings)
            break
          case 'code':
            await this.addCode(pptx, target, element, label, warnings)
            break
        }
      }
      if (slide.speakerNotes?.trim()) target.addNotes(slide.speakerNotes)
      this.collectSlideWarnings(slide, warnings)
    }

    this.warnings = [...warnings]
    return (await pptx.write({ outputType: 'blob' })) as Blob
  }

  private collectSlideWarnings(slide: Slide, warnings: Set<string>): void {
    if (slide.animations.length > 0 || (slide.transition && slide.transition.type !== 'none')) {
      warnings.add('애니메이션과 전환 효과는 PPTX에 포함되지 않습니다.')
    }
  }

  private async applyBackground(
    target: PptxSlide,
    project: PresentationProject,
    background: Background | undefined,
    label: string,
    warnings: Set<string>,
  ): Promise<void> {
    const color = toPptxColor(background?.color ?? project.canvas.backgroundColor)
    if (color) target.background = { color: color.color, transparency: color.transparency }

    const ref = background?.assetId ? project.assetRefs.find((asset) => asset.id === background.assetId) : undefined
    if (!ref) return
    try {
      const blob = await this.assets.get(ref.storageKey)
      if (!blob) throw new Error('이미지 데이터 없음')
      const { width, height } = project.canvas
      const data = await this.rasterize(blob, {
        width,
        height,
        fit: background?.fit ?? 'cover',
        backgroundColor: background?.color ?? project.canvas.backgroundColor,
      })
      target.background = { data }
    } catch (error) {
      console.error('배경 이미지 변환 실패', error)
      warnings.add(`${label}: 배경 이미지를 넣지 못했습니다.`)
    }
  }

  private addText(pptx: PptxGenJS, target: PptxSlide, element: TextElement): void {
    const { style } = element
    const fill = toPptxColor(style.backgroundColor)
    if (!element.content && !fill) return

    const lines = element.content.split('\n')
    const runs: PptxGenJS.TextProps[] = lines.map((line, index) => ({
      text: line,
      options: { breakLine: index < lines.length - 1 },
    }))
    const rounded = fill && style.borderRadius ? style.borderRadius : 0

    target.addText(runs, {
      ...frame(element.position),
      shape: rounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
      rectRadius: rounded ? pxToInch(rounded) : undefined,
      fill: fill ? { color: fill.color, transparency: fill.transparency } : undefined,
      fontFace: primaryFontFace(style.fontFamily, DEFAULT_FONT),
      fontSize: pxToPoint(style.fontSize),
      bold: isBold(style.fontWeight),
      color: toPptxColor(style.color)?.color ?? '000000',
      align: style.textAlign ?? 'left',
      valign: style.verticalAlign ?? 'top',
      margin: pxToPoint(style.padding ?? 0),
      lineSpacingMultiple: (style.lineHeight ?? 1.4) / FONT_LINE_RATIO,
      charSpacing: style.letterSpacing ? pxToPoint(style.letterSpacing) : undefined,
      fit: 'none',
      wrap: true,
    })
  }

  private addShape(pptx: PptxGenJS, target: PptxSlide, element: ShapeElement): void {
    const { style, position } = element
    const opacity = style.opacity ?? 1
    const stroke = style.strokeWidth > 0 ? toPptxColor(style.stroke, opacity) : null
    const line: PptxGenJS.ShapeLineProps | undefined = stroke
      ? { color: stroke.color, transparency: stroke.transparency, width: pxToPoint(style.strokeWidth) }
      : undefined

    if (element.shape === 'line' || element.shape === 'arrow') {
      if (!line) return
      // 선은 요소 영역의 세로 가운데를 지나는 가로선입니다.
      target.addShape(pptx.ShapeType.line, {
        ...frame({ ...position, y: position.y + position.height / 2, height: 0 }),
        line: element.shape === 'arrow' ? { ...line, endArrowType: 'triangle' } : line,
      })
      return
    }

    const fill = toPptxColor(style.fill, opacity)
    if (!fill && !line) return
    // 화면에서는 테두리를 요소 안쪽에 그리므로 선 두께의 절반만큼 줄입니다.
    const inset = line ? style.strokeWidth / 2 : 0
    const box = {
      ...position,
      x: position.x + inset,
      y: position.y + inset,
      width: Math.max(1, position.width - inset * 2),
      height: Math.max(1, position.height - inset * 2),
    }
    const radius = element.shape === 'roundedRectangle' ? (style.borderRadius ?? 16) : 0
    const shapeType =
      element.shape === 'ellipse'
        ? pptx.ShapeType.ellipse
        : radius > 0
          ? pptx.ShapeType.roundRect
          : pptx.ShapeType.rect

    target.addShape(shapeType, {
      ...frame(box),
      fill: fill ? { color: fill.color, transparency: fill.transparency } : undefined,
      line,
      rectRadius: radius > 0 ? pxToInch(Math.min(radius, box.width / 2, box.height / 2)) : undefined,
    })
  }

  private async addImage(
    target: PptxSlide,
    project: PresentationProject,
    element: ImageElement,
    label: string,
    warnings: Set<string>,
  ): Promise<void> {
    const ref = element.assetId ? project.assetRefs.find((asset) => asset.id === element.assetId) : undefined
    if (!ref) {
      if (element.sourceUrl) warnings.add(`${label}: 외부 URL 이미지는 PPTX에 포함되지 않습니다.`)
      return
    }
    try {
      const blob = await this.assets.get(ref.storageKey)
      if (!blob) throw new Error('이미지 데이터 없음')
      // 맞춤 방식·투명도·모서리를 화면과 같게 유지하기 위해 PNG로 다시 그립니다.
      const data = await this.rasterize(blob, {
        width: element.position.width,
        height: element.position.height,
        fit: element.fit,
        opacity: element.opacity,
        borderRadius: element.borderRadius,
      })
      target.addImage({ ...frame(element.position), data, altText: element.alt || undefined })
    } catch (error) {
      console.error('이미지 변환 실패', error)
      warnings.add(`${label}: 이미지 "${ref.name}"을(를) 넣지 못했습니다.`)
    }
  }

  private async addCode(
    pptx: PptxGenJS,
    target: PptxSlide,
    element: CodeElement,
    label: string,
    warnings: Set<string>,
  ): Promise<void> {
    const code = element.code.replaceAll('\t', ' '.repeat(element.tabSize ?? 4))
    let lines: CodeToken[][]
    try {
      lines = await highlightCode(code, element.language, element.theme)
    } catch (error) {
      console.error('구문 강조 실패', error)
      lines = code.split('\n').map((line) => [{ content: line }])
    }

    const textColor = toPptxColor(element.textColor)?.color ?? 'E1E4E8'
    const numberWidth = String(lines.length).length
    const runs: PptxGenJS.TextProps[] = []
    lines.forEach((tokens, index) => {
      const lineRuns: PptxGenJS.TextProps[] = []
      if (element.showLineNumbers) {
        lineRuns.push({
          text: `${String(index + 1).padStart(numberWidth, ' ')}  `,
          options: { color: textColor, transparency: 55 },
        })
      }
      for (const token of tokens) {
        if (!token.content) continue
        lineRuns.push({
          text: token.content,
          options: {
            color: toPptxColor(token.color)?.color ?? textColor,
            bold: token.fontStyle === 'bold',
            italic: token.fontStyle === 'italic',
          },
        })
      }
      // 빈 줄도 한 줄을 차지하도록 공백 하나를 넣습니다.
      if (lineRuns.length === 0) lineRuns.push({ text: ' ', options: {} })
      if (index < lines.length - 1) lineRuns[lineRuns.length - 1].options!.breakLine = true
      runs.push(...lineRuns)
    })

    const lineHeight = element.lineHeight ?? 1.5
    if (lines.length * element.fontSize * lineHeight + element.padding * 2 > element.position.height + 1) {
      warnings.add(`${label}: 코드가 상자보다 길어 PPTX에서 상자 밖으로 넘칠 수 있습니다.`)
    }

    const fill = toPptxColor(element.backgroundColor)
    const radius = element.borderRadius ?? 0
    target.addText(runs, {
      ...frame(element.position),
      shape: radius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
      rectRadius: radius > 0 ? pxToInch(radius) : undefined,
      fill: fill ? { color: fill.color, transparency: fill.transparency } : undefined,
      fontFace: monospaceFontFace(element.fontFamily),
      fontSize: pxToPoint(element.fontSize),
      color: textColor,
      align: 'left',
      valign: 'top',
      margin: pxToPoint(element.padding),
      lineSpacingMultiple: lineHeight / FONT_LINE_RATIO,
      fit: 'none',
      wrap: element.wordWrap,
    })
  }
}
