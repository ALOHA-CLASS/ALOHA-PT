import { DEFAULT_CODE_LANGUAGE, DEFAULT_CODE_THEME, getCodeTheme } from '@/domain/codeLanguages'
import { createId } from '@/domain/ids'
import type {
  AssetReference,
  CanvasConfig,
  CodeElement,
  ImageElement,
  LayoutPlaceholder,
  ShapeElement,
  ShapeKind,
  SlideElement,
  TextElement,
  TextStyle,
  Theme,
} from '@/types/project'

export function nextZIndex(elements: readonly SlideElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.position.zIndex), 0) + 1
}

function centered(canvas: CanvasConfig, width: number, height: number) {
  return {
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
  }
}

export function createTextElement(theme: Theme, canvas: CanvasConfig, zIndex: number): TextElement {
  return {
    id: createId('element'),
    name: '텍스트',
    type: 'text',
    content: '',
    position: { ...centered(canvas, 480, 80), zIndex },
    visible: true,
    locked: false,
    style: {
      fontFamily: theme.typography.bodyFontFamily,
      fontSize: theme.typography.bodySize,
      fontWeight: 'normal',
      color: theme.colors.text,
      textAlign: 'left',
      verticalAlign: 'middle',
      lineHeight: 1.4,
    },
  }
}

export function isLineShape(kind: ShapeKind): boolean {
  return kind === 'line' || kind === 'arrow'
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rectangle: '사각형',
  roundedRectangle: '둥근 사각형',
  ellipse: '타원',
  line: '선',
  arrow: '화살표',
}

export function createShapeElement(
  theme: Theme,
  canvas: CanvasConfig,
  zIndex: number,
  shape: ShapeKind,
): ShapeElement {
  const line = isLineShape(shape)
  return {
    id: createId('element'),
    name: SHAPE_NAMES[shape],
    type: 'shape',
    shape,
    position: { ...(line ? centered(canvas, 320, 24) : centered(canvas, 240, 160)), zIndex },
    visible: true,
    locked: false,
    style: {
      fill: line ? 'transparent' : theme.colors.primary,
      stroke: line ? theme.colors.text : 'transparent',
      strokeWidth: line ? 4 : 0,
      opacity: 1,
      ...(shape === 'roundedRectangle' ? { borderRadius: 16 } : {}),
    },
  }
}

export function createImageElement(
  asset: AssetReference,
  canvas: CanvasConfig,
  zIndex: number,
): ImageElement {
  const naturalWidth = asset.width ?? 480
  const naturalHeight = asset.height ?? 320
  // 캔버스의 60%를 넘지 않도록 비율을 유지해 축소합니다.
  const scale = Math.min(1, (canvas.width * 0.6) / naturalWidth, (canvas.height * 0.6) / naturalHeight)
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  return {
    id: createId('element'),
    name: asset.name,
    type: 'image',
    assetId: asset.id,
    alt: asset.name,
    fit: 'contain',
    opacity: 1,
    position: { ...centered(canvas, width, height), zIndex },
    visible: true,
    locked: false,
  }
}

const SAMPLE_CODE = `public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, ALOHA!");
    }
}`

export function createCodeElement(
  theme: Theme,
  canvas: CanvasConfig,
  zIndex: number,
  code: string = SAMPLE_CODE,
): CodeElement {
  const codeTheme = getCodeTheme(DEFAULT_CODE_THEME)
  return {
    id: createId('element'),
    name: '코드',
    type: 'code',
    code,
    language: DEFAULT_CODE_LANGUAGE,
    theme: codeTheme.id,
    showLineNumbers: true,
    fontSize: 20,
    fontFamily: theme.typography.codeFontFamily,
    lineHeight: 1.5,
    tabSize: 4,
    wordWrap: false,
    backgroundColor: codeTheme.background,
    textColor: codeTheme.foreground,
    padding: 20,
    borderRadius: 12,
    position: { ...centered(canvas, 720, 300), zIndex },
    visible: true,
    locked: false,
  }
}

const TEXT_STYLE_KEYS: (keyof TextStyle)[] = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'color',
  'textAlign',
  'verticalAlign',
  'lineHeight',
  'letterSpacing',
  'backgroundColor',
  'padding',
  'borderRadius',
]

function pickTextStyle(source: Record<string, unknown> | undefined): Partial<TextStyle> {
  if (!source) return {}
  const picked: Record<string, unknown> = {}
  for (const key of TEXT_STYLE_KEYS) {
    if (source[key] !== undefined) picked[key] = source[key]
  }
  return picked as Partial<TextStyle>
}

/** 레이아웃 placeholder를 실제 슬라이드 요소로 만듭니다. 지원하지 않는 종류는 null을 반환합니다. */
export function createElementFromPlaceholder(
  placeholder: LayoutPlaceholder,
  theme: Theme,
  canvas: CanvasConfig,
): SlideElement | null {
  const base = {
    id: createId('element'),
    name: placeholder.name,
    position: { ...placeholder.position },
    visible: true,
    locked: false,
    placeholderId: placeholder.id,
  }
  const { typography, colors } = theme
  const overrides = pickTextStyle(placeholder.defaultStyle)

  switch (placeholder.type) {
    case 'title':
      return {
        ...base,
        type: 'text',
        content: '',
        style: {
          fontFamily: typography.headingFontFamily,
          fontSize: typography.titleSize,
          fontWeight: 'bold',
          color: colors.text,
          textAlign: 'left',
          verticalAlign: 'middle',
          lineHeight: 1.2,
          ...overrides,
        },
      }
    case 'subtitle':
      return {
        ...base,
        type: 'text',
        content: '',
        style: {
          fontFamily: typography.bodyFontFamily,
          fontSize: Math.round(typography.bodySize * 1.2),
          fontWeight: 'normal',
          color: colors.mutedText,
          textAlign: 'left',
          verticalAlign: 'middle',
          lineHeight: 1.3,
          ...overrides,
        },
      }
    case 'body':
    case 'custom':
      return {
        ...base,
        type: 'text',
        content: '',
        style: {
          fontFamily: typography.bodyFontFamily,
          fontSize: typography.bodySize,
          fontWeight: 'normal',
          color: colors.text,
          textAlign: 'left',
          verticalAlign: 'top',
          lineHeight: 1.5,
          ...overrides,
        },
      }
    case 'code':
      return {
        ...createCodeElement(theme, canvas, placeholder.position.zIndex, ''),
        ...base,
      }
    case 'image':
      return null
  }
}

/** 요소에 사용자가 입력한 콘텐츠가 있는지 확인합니다. */
export function hasContent(element: SlideElement): boolean {
  switch (element.type) {
    case 'text':
      return element.content.trim().length > 0
    case 'code':
      return element.code.trim().length > 0
    case 'image':
      return Boolean(element.assetId || element.sourceUrl)
    case 'shape':
      return true
  }
}
