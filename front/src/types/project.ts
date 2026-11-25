// 프로젝트 데이터 모델. DOCS/DATA_MODEL.md와 함께 관리합니다.

export interface PresentationProject {
  schemaVersion: number
  id: string
  name: string
  description?: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  canvas: CanvasConfig
  activeThemeId: string
  themes: Theme[]
  masters: SlideMaster[]
  layouts: SlideLayout[]
  slides: Slide[]
  assetRefs: AssetReference[]
  metadata?: Record<string, unknown>
}

export interface ProjectSummary {
  id: string
  name: string
  slideCount: number
  createdAt: string
  updatedAt: string
}

export interface CanvasConfig {
  width: number
  height: number
  backgroundColor: string
}

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  mutedText: string
  border: string
}

export interface ThemeTypography {
  headingFontFamily: string
  bodyFontFamily: string
  codeFontFamily: string
  titleSize: number
  bodySize: number
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
  typography: ThemeTypography
}

export interface SlideMaster {
  id: string
  name: string
  background?: Background
  elements: MasterElement[]
}

export interface SlideLayout {
  id: string
  name: string
  masterId: string
  placeholders: LayoutPlaceholder[]
}

export type PlaceholderType = 'title' | 'subtitle' | 'body' | 'image' | 'code' | 'custom'

export interface LayoutPlaceholder {
  id: string
  name: string
  type: PlaceholderType
  position: ElementPosition
  defaultStyle?: Record<string, unknown>
  required?: boolean
}

export type MasterElement = TextElement | ShapeElement

export type SlideTransitionType = 'none' | 'fade' | 'slide'

export interface SlideTransition {
  type: SlideTransitionType
  duration: number // milliseconds
}

export interface Slide {
  id: string
  title: string
  masterId?: string
  layoutId?: string
  background?: Background
  elements: SlideElement[]
  animations: ElementAnimation[]
  transition?: SlideTransition
  speakerNotes?: string
  createdAt: string
  updatedAt: string
}

export interface Background {
  color?: string
  assetId?: string
  fit?: ImageFit
}

export interface ElementPosition {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zIndex: number
}

export interface BaseElement {
  id: string
  name?: string
  position: ElementPosition
  visible: boolean
  locked: boolean
  placeholderId?: string
}

export type SlideElement = TextElement | ImageElement | ShapeElement | CodeElement
export type ElementType = SlideElement['type']

export interface TextElement extends BaseElement {
  type: 'text'
  content: string
  style: TextStyle
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface TextStyle {
  fontFamily?: string
  fontSize: number
  fontWeight?: number | 'normal' | 'bold'
  color: string
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
  lineHeight?: number
  letterSpacing?: number
  backgroundColor?: string
  padding?: number
  borderRadius?: number
}

export type ImageFit = 'cover' | 'contain' | 'fill'

export interface ImageElement extends BaseElement {
  type: 'image'
  assetId?: string
  sourceUrl?: string
  alt: string
  fit: ImageFit
  opacity?: number
  borderRadius?: number
}

export type ShapeKind = 'rectangle' | 'roundedRectangle' | 'ellipse' | 'line' | 'arrow'

export interface ShapeElement extends BaseElement {
  type: 'shape'
  shape: ShapeKind
  style: ShapeStyle
}

export interface ShapeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  opacity?: number
  borderRadius?: number
}

export interface CodeElement extends BaseElement {
  type: 'code'
  code: string
  language: string
  theme: string
  showLineNumbers: boolean
  fontSize: number
  fontFamily?: string
  lineHeight?: number
  tabSize?: number
  wordWrap: boolean
  backgroundColor: string
  textColor?: string
  padding: number
  borderRadius?: number
}

export type AnimationEffect = 'fadeIn' | 'fadeOut' | 'slideIn' | 'zoomIn' | 'appear'
export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious'
export type AnimationDirection = 'left' | 'right' | 'top' | 'bottom'

export interface ElementAnimation {
  id: string
  elementId: string
  effect: AnimationEffect
  trigger: AnimationTrigger
  duration: number // milliseconds
  delay: number // milliseconds
  order: number
  direction?: AnimationDirection
}

export interface AssetReference {
  id: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  storageKey: string
  createdAt: string
}

export interface BackupAsset {
  id: string
  name: string
  mimeType: string
  dataUrl: string
}

export interface ProjectBackup {
  format: 'aloha-slide-studio-project'
  formatVersion: number
  exportedAt: string
  project: PresentationProject
  assets: BackupAsset[]
}
