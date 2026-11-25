# TECH_STACK.md

## 1. 기술 선택 목표

- 개발 속도와 유지보수성의 균형
- 캔버스 편집과 코드 편집 경험 지원
- 데이터 모델을 중심으로 한 기능 확장
- 서버 없이 먼저 완성 가능한 Local-first 구조
- PPTX/PDF 내보내기 기능과의 연계

## 2. 기본 기술 스택

| 영역 | 선택 기술 | 적용 목적 | 비고 |
|---|---|---|---|
| 언어 | TypeScript | 데이터 모델과 컴포넌트 타입 안정성 | strict 모드 권장 |
| UI | React | 편집기 및 발표 화면 | 함수형 컴포넌트 |
| 빌드 | Vite | 개발 서버 및 번들링 | React TS 템플릿 |
| 스타일 | Tailwind CSS | 유틸리티 기반 스타일 | 디자인 토큰 정리 |
| UI 컴포넌트 | shadcn/ui | 버튼·대화상자·입력·탭 등 | 필요한 컴포넌트만 도입 |
| 아이콘 | Lucide React | 도구 모음 아이콘 | 일관된 아이콘 세트 |
| 상태 관리 | Zustand | 프로젝트·편집 상태 | 저장 데이터와 UI 상태 분리 |
| 드래그/정렬 | dnd-kit | 요소와 슬라이드의 이동 | 좌표 편집은 별도 처리 필요 |
| 로컬 DB | IndexedDB | 프로젝트와 이미지 Blob 저장 | Repository로 추상화 |
| 코드 편집 | Monaco Editor | 코드 작성 및 편집 | 지연 로딩 권장 |
| 구문 강조 | Shiki | 코드 읽기 전용 렌더링 | Export 지원 확인 필요 |
| 애니메이션 | Motion for React | UI 및 발표 애니메이션 | 효과 범위 제한 |
| PPTX | PptxGenJS | PowerPoint 생성 | 요소별 매핑 구현 |

## 3. 주요 라이브러리 적용 원칙

### React + TypeScript + Vite

프로젝트의 기본 토대입니다. UI와 데이터 모델을 TypeScript로 구성하고, 개발 중 빠른 피드백을 위해 Vite를 사용합니다.

### Tailwind CSS + shadcn/ui

편집기 도구 모음·사이드바·속성 패널·다이얼로그 등 애플리케이션 UI에 사용합니다. 슬라이드 캔버스의 실제 요소 스타일은 데이터 모델에서 계산해 적용하고, Tailwind 클래스에만 의존하지 않도록 합니다.

### Zustand

프로젝트 데이터와 편집기의 임시 상태를 분리합니다. 캔버스 드래그 중 발생하는 고빈도 업데이트는 필요한 구독자만 렌더링하도록 상태 구독 범위를 좁힙니다.

### dnd-kit

슬라이드 목록의 순서 변경, 패널 내 정렬 등 드래그 앤 드롭 상호작용에 사용합니다. 캔버스 요소의 정밀한 이동·크기 조절은 좌표 변환, pointer interaction, resize handle을 별도로 설계합니다.

### Monaco Editor + Shiki

- Monaco Editor: 사용자가 코드 내용을 수정하는 편집 영역
- Shiki: 코드 요소를 읽기 전용으로 표시하는 렌더러 후보
- 코드 원문은 `CodeElement.code`에 저장합니다.
- Monaco Editor 인스턴스와 모델 객체는 프로젝트 JSON에 저장하지 않습니다.
- 두 도구의 언어 ID와 테마 설정을 공통 매핑 계층으로 관리합니다.

### IndexedDB

프로젝트 데이터 및 이미지 Blob을 저장합니다. 직접 API 호출이 UI 곳곳에 흩어지지 않도록 `ProjectRepository`와 `AssetRepository` 인터페이스를 둡니다.

### Motion for React

편집기 UI의 미세한 전환과 발표 화면의 기본 요소 애니메이션에 활용합니다. PPTX로 변환할 수 없는 효과가 존재하므로 웹 애니메이션과 파일 내보내기 애니메이션은 별도 지원 범위로 관리합니다.

### PptxGenJS

PPTX 생성 어댑터에 사용합니다. 텍스트·도형·이미지는 가능한 한 PowerPoint 기본 요소로 변환하고, 변환 품질이 낮거나 복잡한 코드 렌더링은 이미지 대체를 고려합니다.

## 4. 추가 라이브러리 후보

| 기능 | 후보 | 도입 시점 및 판단 기준 |
|---|---|---|
| 리치 텍스트 | Tiptap | 텍스트 요소에 인라인 서식·목록·링크가 필요할 때 |
| 스키마 검증 | Zod | JSON 가져오기·복원·폼 입력 검증 시 |
| ID 생성 | nanoid 또는 crypto.randomUUID | 브라우저 지원 및 테스트 요구에 따라 선택 |
| PDF 생성 | 브라우저 인쇄 CSS, 또는 PDF 변환 라이브러리 | 폰트·페이지 크기·이미지 품질 비교 후 결정 |
| 이미지 처리 | browser canvas 기반 또는 전용 라이브러리 | 리사이즈·압축·썸네일 생성 시 |
| 단위 테스트 | Vitest | 순수 함수 및 스토어 테스트 |
| 컴포넌트 테스트 | React Testing Library | 핵심 편집 UI 테스트 |
| E2E 테스트 | Playwright | 프로젝트 생성부터 저장·복원까지 검증 |

필요가 확인되기 전에는 후보 라이브러리를 모두 설치하지 않습니다. 번들 크기와 유지보수 비용을 고려해 기능 단계별로 도입합니다.

## 5. 캔버스 구현 전략

초기 버전은 HTML/CSS 기반 캔버스를 사용합니다.

- 슬라이드는 고정 논리 크기(1280 × 720)를 갖습니다.
- 브라우저 가용 공간에 맞춰 scale을 적용합니다.
- 텍스트·이미지·도형·코드는 별도 React Renderer로 출력합니다.
- 선택 테두리, 핸들, 정렬 가이드는 콘텐츠와 분리된 오버레이로 표시합니다.

초기부터 Fabric.js와 같은 범용 그래픽 엔진을 도입하지 않습니다. 회전·자유곡선·복잡한 벡터 편집 등 고급 그래픽 기능이 중요해질 경우 별도 PoC를 진행합니다.

## 6. 폴더 구조 기준

```text
src/
├── app/
├── components/
├── features/
│   ├── projects/
│   ├── editor/
│   ├── canvas/
│   ├── slides/
│   ├── masters/
│   ├── elements/
│   ├── code-editor/
│   ├── animations/
│   ├── presentation/
│   └── export/
├── stores/
├── services/
│   ├── storage/
│   └── export/
├── types/
├── hooks/
├── utils/
└── styles/
```

## 7. 개발 도구 및 규칙

- oxlint: 정적 코드 검사
- Prettier: 코드 포맷 통일(프로젝트에서 선택 시)
- TypeScript strict: 타입 안정성 강화
- Vitest: 단위 테스트 (IndexedDB는 fake-indexeddb로 대체)
- Playwright: 주요 사용자 시나리오 검증 (아직 자동화 스크립트는 없음)
- Git: 기능 단위 브랜치와 의미 있는 커밋 메시지 사용

> **ESLint 대신 oxlint를 쓰는 이유**: 프로젝트를 TypeScript 7로 초기화했는데, 도입 시점의 typescript-eslint가 TypeScript 7을 지원하지 않았습니다. oxlint는 TypeScript 버전에 의존하지 않고 React 규칙(hooks, refs, only-export-components 등)을 제공하므로 이를 사용합니다. typescript-eslint가 TypeScript 7을 지원하면 다시 검토합니다.

실제 `package.json`의 스크립트는 다음과 같습니다.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "oxlint",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 구현 과정에서 확정한 사항 (0.2.0)

| 항목 | 결정 | 이유 |
|---|---|---|
| 도메인 계층 | `src/domain/`에 순수 함수로 프로젝트 조작·검증·마이그레이션을 둠 | 스토어·UI와 분리해 단위 테스트하기 위해 |
| 데이터 검증 | Zod 스키마 + 참조 무결성 검사 | JSON 가져오기와 저장소 로딩 시 잘못된 데이터를 걸러내기 위해 |
| 라우팅 | 라우터 라이브러리 없이 해시 라우팅(`#/`, `#/p/:id`) | 화면이 두 개뿐이고 정적 호스팅에서 설정 없이 동작 |
| 텍스트 편집 | 캔버스 위 `textarea` 오버레이 | 텍스트 내용이 일반 문자열이므로 contentEditable이 불필요 |
| Monaco Editor | 필요한 기능·언어만 골라 import, `React.lazy`로 지연 로딩 | 초기 번들에서 제외하고 청크 크기를 줄이기 위해 |
| Shiki | `shiki/core` + JavaScript 정규식 엔진, 언어·테마 지연 로딩 | WASM 없이 동작하고 필요한 문법만 내려받기 위해 |
| PDF 내보내기 | 인쇄 전용 DOM + `@page` 크기 지정 후 `window.print()` | 추가 라이브러리 없이 화면과 같은 렌더링 결과를 얻기 위해 |
| PPTX 이미지 | canvas로 PNG 래스터화 후 삽입 | 맞춤(fit)·둥근 모서리·투명도를 화면과 같게 유지하기 위해 |

## 8. 보류 중인 기술 결정

| 항목 | 현재 기준 | 결정이 필요한 시점 |
|---|---|---|
| 리치 텍스트 내부 포맷 | 일반 문자열로 MVP 시작 | 굵게·목록·링크 편집 구현 전 |
| PDF Export | 브라우저 인쇄 방식으로 구현 | 인쇄 대화상자 없이 파일을 바로 받아야 할 때 재검토 |
| 이미지 포함 백업 | JSON Data URL 방식 초안 | 대용량 파일 테스트 후 ZIP 전환 판단 |
| 캔버스 고급 편집 | HTML/CSS | 다중 선택·그룹·회전 요구 검증 후 |
| 자동 저장 주기 | debounce 기반 | 사용성 테스트로 시간 조정 |
| 서버 확장 | 초기 범위 제외 | 계정·공유·동기화 요구 발생 시 |

## 9. 버전 관리 원칙

- 라이브러리 버전은 실제 도입 시점의 호환성을 확인하고 lockfile에 고정합니다.
- 주요 의존성 업데이트 전 빌드·테스트·내보내기 샘플을 확인합니다.
- 기술 변경이 아키텍처나 데이터 구조에 영향을 주면 이 문서와 `ARCHITECTURE.md`, `DATA_MODEL.md`를 함께 갱신합니다.
