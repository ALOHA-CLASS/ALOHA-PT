# DATA_MODEL.md

## 1. 목적

이 문서는 ALOHA Slide Studio의 프로젝트 데이터 구조를 정의합니다. 실제 코드 구현 시 TypeScript 타입과 런타임 검증 스키마(Zod 등)를 함께 관리합니다.

## 2. 모델링 원칙

- 프로젝트 데이터는 JSON으로 직렬화할 수 있어야 합니다.
- 에디터의 일시적인 UI 상태는 프로젝트 데이터에 넣지 않습니다.
- 요소는 공통 식별자와 위치 정보를 가지며, 타입별 속성은 분리합니다.
- 내부 저장 데이터와 외부 백업 파일 포맷을 구분합니다.
- 스키마 변경 시 `schemaVersion`을 올리고 마이그레이션 함수를 제공합니다.

## 3. 최상위 구조

```ts
export interface PresentationProject {
  schemaVersion: number;
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  canvas: CanvasConfig;
  activeThemeId: string;
  themes: Theme[];
  masters: SlideMaster[];
  layouts: SlideLayout[];
  slides: Slide[];
  assetRefs: AssetReference[];
  metadata?: Record<string, unknown>;
}

export interface CanvasConfig {
  width: number;       // 기본값 1280
  height: number;      // 기본값 720
  backgroundColor: string;
}
```

기본 캔버스는 1280 × 720으로 시작합니다. 추후 사용자 지정 비율이 추가되더라도 요소 좌표는 캔버스 논리 좌표계를 기준으로 관리합니다.

## 4. 테마(Theme)

```ts
export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  };
  typography: {
    headingFontFamily: string;
    bodyFontFamily: string;
    codeFontFamily: string;
    titleSize: number;
    bodySize: number;
  };
}
```

테마는 기본 디자인 토큰입니다. 슬라이드 요소에 직접 지정된 스타일은 테마의 기본값보다 우선합니다.

## 5. 마스터와 레이아웃

```ts
export interface SlideMaster {
  id: string;
  name: string;
  background?: Background;
  elements: MasterElement[];
}

export interface SlideLayout {
  id: string;
  name: string;
  masterId: string;
  placeholders: LayoutPlaceholder[];
}

export interface LayoutPlaceholder {
  id: string;
  name: string;
  type: 'title' | 'subtitle' | 'body' | 'image' | 'code' | 'custom';
  position: ElementPosition;
  defaultStyle?: Record<string, unknown>;
  required?: boolean;
}

export type MasterElement =
  | (BaseElement & { type: 'text'; content: string; style: TextStyle })
  | (BaseElement & { type: 'shape'; shape: ShapeKind; style: ShapeStyle });
```

마스터 요소는 공통 장식 요소를 중심으로 사용합니다. 마스터 요소를 편집 화면에서 개별 슬라이드 콘텐츠와 구분해 표시하며, 슬라이드별 편집을 허용할지는 추후 정책으로 결정합니다.

## 6. 슬라이드(Slide)

```ts
export interface Slide {
  id: string;
  title: string;
  masterId?: string;
  layoutId?: string;
  background?: Background;
  elements: SlideElement[];
  animations: ElementAnimation[];
  transition?: SlideTransition;
  speakerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// 발표 모드에서 이 슬라이드로 들어올 때의 전환 효과 (0.2.0에서 추가)
export interface SlideTransition {
  type: 'none' | 'fade' | 'slide';
  duration: number; // milliseconds
}

// 프로젝트 목록 화면용 요약. 저장하지 않고 저장소 조회 시 계산합니다. (0.2.0에서 추가)
export interface ProjectSummary {
  id: string;
  name: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Background {
  color?: string;
  assetId?: string;
  fit?: 'cover' | 'contain' | 'fill';
}
```

슬라이드 순서는 `slides` 배열의 순서로 관리합니다. 별도의 `order` 속성을 중복 저장하지 않습니다.

## 7. 공통 요소 구조

```ts
export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
}

export interface BaseElement {
  id: string;
  name?: string;
  position: ElementPosition;
  visible: boolean;
  locked: boolean;
  placeholderId?: string;
}

export type SlideElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | CodeElement;
```

`x`, `y`, `width`, `height`는 1280 × 720 논리 캔버스 좌표 기준 CSS 픽셀 값입니다. `zIndex`는 슬라이드 안에서 렌더링 순서를 정합니다.

## 8. 요소별 구조

### TextElement

```ts
export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  style: TextStyle;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number | 'normal' | 'bold';
  color: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
}
```

초기 구현은 일반 문자열을 지원합니다. 굵게·기울임·링크 등 인라인 서식이 필요해지면 `content`를 Tiptap JSON 또는 별도 RichTextDocument 구조로 확장합니다. HTML 문자열을 무검증 상태로 저장·렌더링하지 않습니다.

### ImageElement

```ts
export interface ImageElement extends BaseElement {
  type: 'image';
  assetId?: string;
  sourceUrl?: string;
  alt: string;
  fit: 'cover' | 'contain' | 'fill';
  opacity?: number;
  borderRadius?: number;
}
```

로컬 업로드 이미지는 `assetId`로 참조하고, 외부 이미지 URL은 `sourceUrl`로 관리합니다. 두 속성을 동시에 사용할 경우 우선순위를 명확히 정의해야 하며, 기본 정책은 로컬 Asset 참조를 우선합니다.

### ShapeElement

```ts
export type ShapeKind = 'rectangle' | 'roundedRectangle' | 'ellipse' | 'line' | 'arrow';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  style: ShapeStyle;
}

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  borderRadius?: number;
}
```

### CodeElement

```ts
export interface CodeElement extends BaseElement {
  type: 'code';
  code: string;
  language: string;
  theme: string;
  showLineNumbers: boolean;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  tabSize?: number;
  wordWrap: boolean;
  backgroundColor: string;
  textColor?: string;
  padding: number;
  borderRadius?: number;
}
```

`language`는 Monaco 및 구문 강조 엔진에서 사용하는 언어 식별자를 저장합니다. 예: `java`, `python`, `javascript`, `typescript`, `sql`, `html`, `css`, `json`, `bash`.

## 9. 애니메이션

```ts
export interface ElementAnimation {
  id: string;
  elementId: string;
  effect: 'fadeIn' | 'fadeOut' | 'slideIn' | 'zoomIn' | 'appear';
  trigger: 'onClick' | 'withPrevious' | 'afterPrevious';
  duration: number; // milliseconds
  delay: number;    // milliseconds
  order: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}
```

애니메이션은 요소 데이터에 직접 넣기보다 슬라이드 단위 배열로 관리합니다. 한 요소에 여러 애니메이션을 연결할 수 있으며, 실제 지원 효과는 발표 렌더러에서 검증합니다.

## 10. 이미지 Asset

내부 저장소는 바이너리를 IndexedDB에 저장하고 프로젝트에서는 참조 ID만 보유합니다.

```ts
export interface AssetReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  storageKey: string;
  createdAt: string;
}
```

Asset 바이너리는 프로젝트 JSON에 직접 포함하지 않는 것이 기본 정책입니다. 외부 백업 시에는 아래 교환 포맷에 Asset 데이터를 포함합니다.

## 11. JSON 백업 파일 포맷

```ts
export interface ProjectBackup {
  format: 'aloha-slide-studio-project';
  formatVersion: number;
  exportedAt: string;
  project: PresentationProject;
  assets: Array<{
    id: string;
    name: string;
    mimeType: string;
    dataUrl: string;
  }>;
}
```

예시의 `dataUrl`은 이미지 등의 바이너리를 백업 파일에 포함하기 위한 교환용 필드입니다. 내부 IndexedDB 레코드에는 Data URL 대신 Blob을 저장합니다. 이미지가 많거나 용량이 큰 프로젝트는 ZIP 번들 포맷을 도입할 수 있습니다.

## 12. 최소 예시 데이터

```json
{
  "schemaVersion": 1,
  "id": "project_demo",
  "name": "Java 기초 강의",
  "createdAt": "2026-11-25T00:00:00.000Z",
  "updatedAt": "2026-11-25T00:00:00.000Z",
  "canvas": {
    "width": 1280,
    "height": 720,
    "backgroundColor": "#FFFFFF"
  },
  "activeThemeId": "theme_default",
  "themes": [
    {
      "id": "theme_default",
      "name": "기본 테마",
      "colors": {
        "primary": "#2563EB",
        "secondary": "#64748B",
        "accent": "#F59E0B",
        "background": "#FFFFFF",
        "surface": "#F8FAFC",
        "text": "#172033",
        "mutedText": "#64748B",
        "border": "#E2E8F0"
      },
      "typography": {
        "headingFontFamily": "Pretendard, sans-serif",
        "bodyFontFamily": "Pretendard, sans-serif",
        "codeFontFamily": "Consolas, monospace",
        "titleSize": 48,
        "bodySize": 24
      }
    }
  ],
  "masters": [],
  "layouts": [],
  "slides": [
    {
      "id": "slide_001",
      "title": "Java 변수와 자료형",
      "elements": [
        {
          "id": "element_001",
          "type": "text",
          "content": "Java 변수와 자료형",
          "position": {
            "x": 80,
            "y": 70,
            "width": 900,
            "height": 100,
            "zIndex": 1
          },
          "visible": true,
          "locked": false,
          "style": {
            "fontSize": 48,
            "fontWeight": "bold",
            "color": "#172033",
            "textAlign": "left",
            "verticalAlign": "middle"
          }
        }
      ],
      "animations": [],
      "createdAt": "2026-11-25T00:00:00.000Z",
      "updatedAt": "2026-11-25T00:00:00.000Z"
    }
  ],
  "assetRefs": []
}
```

위 예시는 구조 설명용 최소 데이터입니다. 실제 앱은 기본 테마와 기본 마스터를 생성하며, 가져오기 시 필수 필드와 ID 참조 무결성을 검증해야 합니다.

## 13. 데이터 검증 규칙

- `schemaVersion`은 지원하는 양의 정수여야 합니다.
- 프로젝트·슬라이드·요소·테마·마스터·레이아웃 ID는 프로젝트 내에서 중복되지 않아야 합니다.
- 캔버스 너비와 높이는 0보다 커야 합니다.
- 요소의 너비와 높이는 음수가 될 수 없습니다.
- `assetId`, `masterId`, `layoutId`, `placeholderId`, `elementId` 참조는 존재 여부를 검증합니다.
- 알 수 없는 요소 타입은 가져오기 오류로 처리하거나 대체 요소로 복원하는 정책을 구현에서 명시합니다.
- 외부 URL과 Data URL은 허용 정책 및 크기 제한을 검증합니다.

## 14. 마이그레이션 정책

- 저장 데이터에는 `schemaVersion`을 반드시 둡니다.
- 버전별 순차 마이그레이션 함수(예: v1 → v2)를 작성합니다.
- 가져오기 전 원본 파일은 변경하지 않습니다.
- 지원하지 않는 더 높은 버전은 덮어쓰지 않고 사용자에게 안내합니다.
- 마이그레이션 테스트용 JSON fixture를 버전별로 보관합니다.
