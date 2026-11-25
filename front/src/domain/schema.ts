// 런타임 검증 스키마. src/types/project.ts의 타입과 함께 관리합니다.
import { z } from 'zod'
import type { PresentationProject } from '@/types/project'

const id = z.string().min(1).max(200)
const shortText = z.string().max(500)
const cssValue = z.string().max(300)
const isoDate = z.string().min(1).max(64)

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(0),
  height: z.number().min(0),
  rotation: z.number().optional(),
  zIndex: z.number(),
})

const baseElement = {
  id,
  name: shortText.optional(),
  position: positionSchema,
  visible: z.boolean(),
  locked: z.boolean(),
  placeholderId: id.optional(),
}

const textStyleSchema = z.object({
  fontFamily: cssValue.optional(),
  fontSize: z.number().positive(),
  fontWeight: z.union([z.number(), z.enum(['normal', 'bold'])]).optional(),
  color: cssValue,
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  backgroundColor: cssValue.optional(),
  padding: z.number().min(0).optional(),
  borderRadius: z.number().min(0).optional(),
})

const shapeStyleSchema = z.object({
  fill: cssValue,
  stroke: cssValue,
  strokeWidth: z.number().min(0),
  opacity: z.number().min(0).max(1).optional(),
  borderRadius: z.number().min(0).optional(),
})

const imageFit = z.enum(['cover', 'contain', 'fill'])

const textElementSchema = z.object({
  ...baseElement,
  type: z.literal('text'),
  content: z.string(),
  style: textStyleSchema,
})

const shapeElementSchema = z.object({
  ...baseElement,
  type: z.literal('shape'),
  shape: z.enum(['rectangle', 'roundedRectangle', 'ellipse', 'line', 'arrow']),
  style: shapeStyleSchema,
})

const imageElementSchema = z.object({
  ...baseElement,
  type: z.literal('image'),
  assetId: id.optional(),
  sourceUrl: z.string().max(2048).refine(isHttpUrl, 'http(s) URL만 허용됩니다.').optional(),
  alt: z.string().max(1000),
  fit: imageFit,
  opacity: z.number().min(0).max(1).optional(),
  borderRadius: z.number().min(0).optional(),
})

const codeElementSchema = z.object({
  ...baseElement,
  type: z.literal('code'),
  code: z.string(),
  language: z.string().min(1).max(50),
  theme: z.string().min(1).max(100),
  showLineNumbers: z.boolean(),
  fontSize: z.number().positive(),
  fontFamily: cssValue.optional(),
  lineHeight: z.number().positive().optional(),
  tabSize: z.number().int().min(1).max(16).optional(),
  wordWrap: z.boolean(),
  backgroundColor: cssValue,
  textColor: cssValue.optional(),
  padding: z.number().min(0),
  borderRadius: z.number().min(0).optional(),
})

const slideElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  shapeElementSchema,
  imageElementSchema,
  codeElementSchema,
])

const masterElementSchema = z.discriminatedUnion('type', [textElementSchema, shapeElementSchema])

const backgroundSchema = z.object({
  color: cssValue.optional(),
  assetId: id.optional(),
  fit: imageFit.optional(),
})

const animationSchema = z.object({
  id,
  elementId: id,
  effect: z.enum(['fadeIn', 'fadeOut', 'slideIn', 'zoomIn', 'appear']),
  trigger: z.enum(['onClick', 'withPrevious', 'afterPrevious']),
  duration: z.number().min(0).max(60_000),
  delay: z.number().min(0).max(60_000),
  order: z.number(),
  direction: z.enum(['left', 'right', 'top', 'bottom']).optional(),
})

const slideSchema = z.object({
  id,
  title: shortText,
  masterId: id.optional(),
  layoutId: id.optional(),
  background: backgroundSchema.optional(),
  elements: z.array(slideElementSchema),
  animations: z.array(animationSchema),
  transition: z
    .object({ type: z.enum(['none', 'fade', 'slide']), duration: z.number().min(0).max(10_000) })
    .optional(),
  speakerNotes: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

const themeSchema = z.object({
  id,
  name: shortText,
  colors: z.object({
    primary: cssValue,
    secondary: cssValue,
    accent: cssValue,
    background: cssValue,
    surface: cssValue,
    text: cssValue,
    mutedText: cssValue,
    border: cssValue,
  }),
  typography: z.object({
    headingFontFamily: cssValue,
    bodyFontFamily: cssValue,
    codeFontFamily: cssValue,
    titleSize: z.number().positive(),
    bodySize: z.number().positive(),
  }),
})

const masterSchema = z.object({
  id,
  name: shortText,
  background: backgroundSchema.optional(),
  elements: z.array(masterElementSchema),
})

const layoutSchema = z.object({
  id,
  name: shortText,
  masterId: id,
  placeholders: z.array(
    z.object({
      id,
      name: shortText,
      type: z.enum(['title', 'subtitle', 'body', 'image', 'code', 'custom']),
      position: positionSchema,
      defaultStyle: z.record(z.string(), z.unknown()).optional(),
      required: z.boolean().optional(),
    }),
  ),
})

const assetRefSchema = z.object({
  id,
  name: shortText,
  mimeType: z.string().min(1).max(100),
  size: z.number().min(0),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  storageKey: z.string().min(1).max(300),
  createdAt: isoDate,
})

export const projectSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id,
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    backgroundColor: cssValue,
  }),
  activeThemeId: id,
  themes: z.array(themeSchema).min(1),
  masters: z.array(masterSchema),
  layouts: z.array(layoutSchema),
  slides: z.array(slideSchema).min(1),
  assetRefs: z.array(assetRefSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
}) satisfies z.ZodType<PresentationProject>

export const backupAssetSchema = z.object({
  id,
  name: shortText,
  mimeType: z.string().min(1).max(100),
  dataUrl: z.string().min(1),
})
