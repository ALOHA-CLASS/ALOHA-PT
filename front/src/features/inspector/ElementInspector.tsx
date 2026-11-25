import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bold,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Pencil,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CODE_LANGUAGES, CODE_THEMES, getCodeTheme } from '@/domain/codeLanguages'
import { MIN_ELEMENT_SIZE } from '@/domain/constants'
import type { AlignMode } from '@/domain/geometry'
import { getActiveTheme } from '@/domain/projectOps'
import {
  alignSelection,
  deleteSelection,
  duplicateSelection,
  patchSelectedPosition,
  reorderSelection,
  updateElementById,
} from '@/features/editor/actions'
import { AnimationSection } from '@/features/inspector/AnimationSection'
import { CheckRow, ColorField, IconToggle, NumberField, Row, Section, SelectField } from '@/features/inspector/fields'
import { elementLabel } from '@/features/inspector/labels'
import { useEditorStore } from '@/stores/editorStore'
import type {
  CodeElement,
  ImageElement,
  ImageFit,
  PresentationProject,
  ShapeElement,
  ShapeStyle,
  Slide,
  SlideElement,
  TextElement,
  TextStyle,
} from '@/types/project'

const ALIGN_BUTTONS: { mode: AlignMode; label: string; icon: typeof AlignStartVertical }[] = [
  { mode: 'left', label: '왼쪽 맞춤', icon: AlignStartVertical },
  { mode: 'center', label: '가로 가운데 맞춤', icon: AlignCenterVertical },
  { mode: 'right', label: '오른쪽 맞춤', icon: AlignEndVertical },
  { mode: 'top', label: '위쪽 맞춤', icon: AlignStartHorizontal },
  { mode: 'middle', label: '세로 가운데 맞춤', icon: AlignCenterHorizontal },
  { mode: 'bottom', label: '아래쪽 맞춤', icon: AlignEndHorizontal },
]

function ArrangeSection({ multiple }: { multiple: boolean }) {
  return (
    <Section title="정렬·순서">
      <Row label={multiple ? '요소 정렬' : '캔버스 정렬'}>
        {ALIGN_BUTTONS.map(({ mode, label, icon: Icon }) => (
          <IconToggle key={mode} label={label} onClick={() => alignSelection(mode)}>
            <Icon />
          </IconToggle>
        ))}
      </Row>
      <Row label="순서">
        <IconToggle label="맨 앞으로" onClick={() => reorderSelection('front')}>
          <ArrowUpToLine />
        </IconToggle>
        <IconToggle label="앞으로" onClick={() => reorderSelection('forward')}>
          <ArrowUp />
        </IconToggle>
        <IconToggle label="뒤로" onClick={() => reorderSelection('backward')}>
          <ArrowDown />
        </IconToggle>
        <IconToggle label="맨 뒤로" onClick={() => reorderSelection('back')}>
          <ArrowDownToLine />
        </IconToggle>
      </Row>
    </Section>
  )
}

function PositionSection({ element }: { element: SlideElement }) {
  const { x, y, width, height, rotation } = element.position
  const disabled = element.locked
  return (
    <Section title="위치·크기">
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField
          ariaLabel="X 좌표"
          prefix="X"
          value={x}
          disabled={disabled}
          onChange={(value) => patchSelectedPosition({ x: value }, 'pos:x')}
        />
        <NumberField
          ariaLabel="Y 좌표"
          prefix="Y"
          value={y}
          disabled={disabled}
          onChange={(value) => patchSelectedPosition({ y: value }, 'pos:y')}
        />
        <NumberField
          ariaLabel="너비"
          prefix="W"
          value={width}
          min={MIN_ELEMENT_SIZE}
          disabled={disabled}
          onChange={(value) => patchSelectedPosition({ width: value }, 'pos:w')}
        />
        <NumberField
          ariaLabel="높이"
          prefix="H"
          value={height}
          min={MIN_ELEMENT_SIZE}
          disabled={disabled}
          onChange={(value) => patchSelectedPosition({ height: value }, 'pos:h')}
        />
      </div>
      <Row label="회전">
        <NumberField
          ariaLabel="회전 각도"
          suffix="°"
          value={rotation ?? 0}
          min={-360}
          max={360}
          disabled={disabled}
          onChange={(value) => patchSelectedPosition({ rotation: value }, 'pos:r')}
        />
      </Row>
    </Section>
  )
}

function TextSection({ project, element }: { project: PresentationProject; element: TextElement }) {
  const { style } = element
  const theme = getActiveTheme(project)
  const update = (patch: Partial<TextStyle>, key: string) =>
    updateElementById(
      element.id,
      (el) => (el.type === 'text' ? { ...el, style: { ...el.style, ...patch } } : el),
      `text:${key}`,
    )

  const fontOptions = [
    { value: theme.typography.headingFontFamily, label: '테마 제목 글꼴' },
    { value: theme.typography.bodyFontFamily, label: '테마 본문 글꼴' },
    { value: theme.typography.codeFontFamily, label: '테마 코드 글꼴' },
    { value: "Georgia, 'Nanum Myeongjo', 'Batang', serif", label: '명조 (Serif)' },
    { value: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", label: '시스템 고딕' },
  ].filter((option, index, all) => all.findIndex((other) => other.value === option.value) === index)
  const fontFamily = style.fontFamily ?? theme.typography.bodyFontFamily
  if (!fontOptions.some((option) => option.value === fontFamily)) {
    fontOptions.push({ value: fontFamily, label: '사용자 지정' })
  }
  const bold = style.fontWeight === 'bold' || (typeof style.fontWeight === 'number' && style.fontWeight >= 600)

  return (
    <Section
      title="텍스트"
      action={
        <Button
          variant="ghost"
          size="xs"
          disabled={element.locked}
          onClick={() => useEditorStore.getState().setEditingText(element.id)}
        >
          <Pencil /> 내용 편집
        </Button>
      }
    >
      <Row label="글꼴">
        <SelectField
          ariaLabel="글꼴"
          value={fontFamily}
          options={fontOptions}
          onChange={(value) => update({ fontFamily: value }, 'font')}
        />
      </Row>
      <Row label="크기">
        <NumberField
          ariaLabel="글자 크기"
          value={style.fontSize}
          min={4}
          max={400}
          onChange={(value) => update({ fontSize: value }, 'size')}
        />
        <IconToggle label="굵게" pressed={bold} onClick={() => update({ fontWeight: bold ? 400 : 700 }, 'weight')}>
          <Bold />
        </IconToggle>
      </Row>
      <Row label="색상">
        <ColorField ariaLabel="글자 색" value={style.color} onChange={(value) => update({ color: value }, 'color')} />
      </Row>
      <Row label="가로 정렬">
        {(
          [
            ['left', '왼쪽', TextAlignStart],
            ['center', '가운데', TextAlignCenter],
            ['right', '오른쪽', TextAlignEnd],
            ['justify', '양쪽', TextAlignJustify],
          ] as const
        ).map(([value, label, Icon]) => (
          <IconToggle
            key={value}
            label={`${label} 정렬`}
            pressed={(style.textAlign ?? 'left') === value}
            onClick={() => update({ textAlign: value }, 'align')}
          >
            <Icon />
          </IconToggle>
        ))}
      </Row>
      <Row label="세로 정렬">
        {(
          [
            ['top', '위', AlignVerticalJustifyStart],
            ['middle', '가운데', AlignVerticalJustifyCenter],
            ['bottom', '아래', AlignVerticalJustifyEnd],
          ] as const
        ).map(([value, label, Icon]) => (
          <IconToggle
            key={value}
            label={`세로 ${label} 정렬`}
            pressed={(style.verticalAlign ?? 'top') === value}
            onClick={() => update({ verticalAlign: value }, 'valign')}
          >
            <Icon />
          </IconToggle>
        ))}
      </Row>
      <Row label="줄 간격">
        <NumberField
          ariaLabel="줄 간격"
          value={style.lineHeight ?? 1.4}
          min={0.5}
          max={5}
          step={0.1}
          onChange={(value) => update({ lineHeight: value }, 'lineHeight')}
        />
      </Row>
      <Row label="배경">
        <ColorField
          ariaLabel="텍스트 배경색"
          value={style.backgroundColor}
          onChange={(value) => update({ backgroundColor: value }, 'bg')}
          onClear={() => update({ backgroundColor: undefined }, 'bg')}
        />
      </Row>
      <Row label="안쪽 여백">
        <NumberField
          ariaLabel="안쪽 여백"
          value={style.padding ?? 0}
          min={0}
          max={200}
          onChange={(value) => update({ padding: value }, 'padding')}
        />
        <NumberField
          ariaLabel="모서리 둥글기"
          prefix="R"
          value={style.borderRadius ?? 0}
          min={0}
          max={400}
          onChange={(value) => update({ borderRadius: value }, 'radius')}
        />
      </Row>
    </Section>
  )
}

function ShapeSection({ element }: { element: ShapeElement }) {
  const { style } = element
  const line = element.shape === 'line' || element.shape === 'arrow'
  const update = (patch: Partial<ShapeStyle>, key: string) =>
    updateElementById(
      element.id,
      (el) => (el.type === 'shape' ? { ...el, style: { ...el.style, ...patch } } : el),
      `shape:${key}`,
    )

  return (
    <Section title="도형">
      {!line && (
        <Row label="채우기">
          <ColorField
            ariaLabel="채우기 색"
            value={style.fill}
            onChange={(value) => update({ fill: value }, 'fill')}
            onClear={() => update({ fill: 'transparent' }, 'fill')}
          />
        </Row>
      )}
      <Row label="선 색">
        <ColorField
          ariaLabel="선 색"
          value={style.stroke}
          onChange={(value) => update({ stroke: value, strokeWidth: style.strokeWidth || 2 }, 'stroke')}
          onClear={line ? undefined : () => update({ stroke: 'transparent', strokeWidth: 0 }, 'stroke')}
        />
      </Row>
      <Row label="선 두께">
        <NumberField
          ariaLabel="선 두께"
          value={style.strokeWidth}
          min={line ? 1 : 0}
          max={100}
          onChange={(value) => update({ strokeWidth: value }, 'strokeWidth')}
        />
      </Row>
      {element.shape === 'roundedRectangle' && (
        <Row label="모서리">
          <NumberField
            ariaLabel="모서리 둥글기"
            value={style.borderRadius ?? 16}
            min={0}
            max={400}
            onChange={(value) => update({ borderRadius: value }, 'radius')}
          />
        </Row>
      )}
      <Row label="불투명도">
        <NumberField
          ariaLabel="불투명도"
          suffix="%"
          value={Math.round((style.opacity ?? 1) * 100)}
          min={0}
          max={100}
          onChange={(value) => update({ opacity: value / 100 }, 'opacity')}
        />
      </Row>
    </Section>
  )
}

const FIT_OPTIONS: { value: ImageFit; label: string }[] = [
  { value: 'contain', label: '전체 보이기' },
  { value: 'cover', label: '영역 채우기 (잘림)' },
  { value: 'fill', label: '늘려서 채우기' },
]

function ImageSection({ element }: { element: ImageElement }) {
  const update = (patch: Partial<ImageElement>, key: string) =>
    updateElementById(element.id, (el) => (el.type === 'image' ? { ...el, ...patch } : el), `image:${key}`)

  return (
    <Section title="이미지">
      <Row label="맞춤">
        <SelectField
          ariaLabel="이미지 맞춤"
          value={element.fit}
          options={FIT_OPTIONS}
          onChange={(value) => update({ fit: value }, 'fit')}
        />
      </Row>
      <Row label="불투명도">
        <NumberField
          ariaLabel="불투명도"
          suffix="%"
          value={Math.round((element.opacity ?? 1) * 100)}
          min={0}
          max={100}
          onChange={(value) => update({ opacity: value / 100 }, 'opacity')}
        />
      </Row>
      <Row label="모서리">
        <NumberField
          ariaLabel="모서리 둥글기"
          value={element.borderRadius ?? 0}
          min={0}
          max={400}
          onChange={(value) => update({ borderRadius: value }, 'radius')}
        />
      </Row>
      <Row label="대체 텍스트">
        <input
          aria-label="대체 텍스트"
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          value={element.alt}
          maxLength={500}
          placeholder="이미지 설명"
          onChange={(event) => update({ alt: event.target.value }, 'alt')}
        />
      </Row>
    </Section>
  )
}

function CodeSection({ element }: { element: CodeElement }) {
  const update = (patch: Partial<CodeElement>, key: string) =>
    updateElementById(element.id, (el) => (el.type === 'code' ? { ...el, ...patch } : el), `code:${key}`)

  return (
    <Section
      title="코드"
      action={
        <Button
          variant="ghost"
          size="xs"
          disabled={element.locked}
          onClick={() => useEditorStore.getState().setEditingCode(element.id)}
        >
          <Pencil /> 코드 편집
        </Button>
      }
    >
      <Row label="언어">
        <SelectField
          ariaLabel="코드 언어"
          value={element.language}
          options={CODE_LANGUAGES.map((language) => ({ value: language.id, label: language.label }))}
          onChange={(value) => update({ language: value }, 'language')}
        />
      </Row>
      <Row label="테마">
        <SelectField
          ariaLabel="코드 테마"
          value={element.theme}
          options={CODE_THEMES.map((theme) => ({ value: theme.id, label: theme.label }))}
          onChange={(value) => {
            const theme = getCodeTheme(value)
            update({ theme: theme.id, backgroundColor: theme.background, textColor: theme.foreground }, 'theme')
          }}
        />
      </Row>
      <Row label="글자 크기">
        <NumberField
          ariaLabel="코드 글자 크기"
          value={element.fontSize}
          min={6}
          max={120}
          onChange={(value) => update({ fontSize: value }, 'fontSize')}
        />
      </Row>
      <Row label="줄 간격">
        <NumberField
          ariaLabel="코드 줄 간격"
          value={element.lineHeight ?? 1.5}
          min={1}
          max={3}
          step={0.1}
          onChange={(value) => update({ lineHeight: value }, 'lineHeight')}
        />
      </Row>
      <Row label="여백·모서리">
        <NumberField
          ariaLabel="안쪽 여백"
          prefix="P"
          value={element.padding}
          min={0}
          max={200}
          onChange={(value) => update({ padding: value }, 'padding')}
        />
        <NumberField
          ariaLabel="모서리 둥글기"
          prefix="R"
          value={element.borderRadius ?? 0}
          min={0}
          max={200}
          onChange={(value) => update({ borderRadius: value }, 'radius')}
        />
      </Row>
      <Row label="배경">
        <ColorField
          ariaLabel="코드 배경색"
          value={element.backgroundColor}
          onChange={(value) => update({ backgroundColor: value }, 'bg')}
        />
      </Row>
      <CheckRow
        label="줄 번호 표시"
        checked={element.showLineNumbers}
        onChange={(checked) => update({ showLineNumbers: checked }, 'lineNumbers')}
      />
      <CheckRow
        label="자동 줄바꿈"
        checked={element.wordWrap}
        onChange={(checked) => update({ wordWrap: checked }, 'wordWrap')}
      />
    </Section>
  )
}

interface Props {
  project: PresentationProject
  slide: Slide
  elements: SlideElement[]
}

export function ElementInspector({ project, slide, elements }: Props) {
  if (elements.length > 1) {
    return (
      <>
        <Section title={`${elements.length}개 요소 선택됨`}>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1" onClick={duplicateSelection}>
              <Copy /> 복제
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={deleteSelection}>
              <Trash2 /> 삭제
            </Button>
          </div>
        </Section>
        <ArrangeSection multiple />
      </>
    )
  }

  const element = elements[0]
  const toggle = (key: 'locked' | 'visible') =>
    updateElementById(element.id, (el) => ({ ...el, [key]: !el[key] }))

  return (
    <>
      <Section
        title={elementLabel(element)}
        action={
          <div className="flex">
            <IconToggle label={element.locked ? '잠금 해제' : '잠금'} pressed={element.locked} onClick={() => toggle('locked')}>
              {element.locked ? <Lock /> : <LockOpen />}
            </IconToggle>
            <IconToggle label={element.visible ? '숨기기' : '표시'} pressed={!element.visible} onClick={() => toggle('visible')}>
              {element.visible ? <Eye /> : <EyeOff />}
            </IconToggle>
            <IconToggle label="복제" onClick={duplicateSelection}>
              <Copy />
            </IconToggle>
            <IconToggle label="삭제" onClick={deleteSelection}>
              <Trash2 />
            </IconToggle>
          </div>
        }
      >
        {element.locked && <p className="text-xs text-muted-foreground">잠긴 요소는 이동하거나 크기를 바꿀 수 없습니다.</p>}
      </Section>
      <PositionSection element={element} />
      <ArrangeSection multiple={false} />
      {element.type === 'text' && <TextSection project={project} element={element} />}
      {element.type === 'shape' && <ShapeSection element={element} />}
      {element.type === 'image' && <ImageSection element={element} />}
      {element.type === 'code' && <CodeSection element={element} />}
      <AnimationSection slide={slide} element={element} />
    </>
  )
}
