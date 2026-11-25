import type { SlideLayout, SlideMaster, Theme } from '@/types/project'

const SANS_STACK = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
const CODE_STACK = "'JetBrains Mono', 'D2Coding', Consolas, 'Courier New', monospace"

const typography = {
  headingFontFamily: SANS_STACK,
  bodyFontFamily: SANS_STACK,
  codeFontFamily: CODE_STACK,
  titleSize: 48,
  bodySize: 24,
}

export const DEFAULT_THEME_ID = 'theme_default'
export const DEFAULT_MASTER_ID = 'master_default'
export const DEFAULT_LAYOUT_ID = 'layout_title_body'
export const TITLE_LAYOUT_ID = 'layout_title'

export function createDefaultThemes(): Theme[] {
  return [
    {
      id: DEFAULT_THEME_ID,
      name: 'ALOHA 라이트',
      colors: {
        primary: '#2563EB',
        secondary: '#64748B',
        accent: '#F59E0B',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#172033',
        mutedText: '#64748B',
        border: '#E2E8F0',
      },
      typography: { ...typography },
    },
    {
      id: 'theme_dark',
      name: 'ALOHA 다크',
      colors: {
        primary: '#38BDF8',
        secondary: '#94A3B8',
        accent: '#FBBF24',
        background: '#0F172A',
        surface: '#1E293B',
        text: '#F1F5F9',
        mutedText: '#9AA9BD',
        border: '#334155',
      },
      typography: { ...typography },
    },
    {
      id: 'theme_forest',
      name: '포레스트',
      colors: {
        primary: '#047857',
        secondary: '#57715F',
        accent: '#D97706',
        background: '#F7FAF5',
        surface: '#E8F0E4',
        text: '#1C2B22',
        mutedText: '#5B6F62',
        border: '#CFDCCB',
      },
      typography: { ...typography },
    },
  ]
}

export function createDefaultMasters(theme: Theme): SlideMaster[] {
  return [
    {
      id: DEFAULT_MASTER_ID,
      name: '기본 마스터',
      elements: [
        {
          id: 'element_master_bar',
          name: '하단 강조선',
          type: 'shape',
          shape: 'rectangle',
          position: { x: 0, y: 712, width: 1280, height: 8, zIndex: 1 },
          visible: true,
          locked: true,
          style: { fill: theme.colors.primary, stroke: 'transparent', strokeWidth: 0 },
        },
      ],
    },
  ]
}

const titlePosition = { x: 80, y: 48, width: 1120, height: 96, zIndex: 1 }

export function createDefaultLayouts(): SlideLayout[] {
  return [
    {
      id: TITLE_LAYOUT_ID,
      name: '제목 슬라이드',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [
        {
          id: 'placeholder_title_main',
          name: '제목',
          type: 'title',
          position: { x: 80, y: 230, width: 1120, height: 130, zIndex: 1 },
          defaultStyle: { textAlign: 'center', fontSize: 64 },
          required: true,
        },
        {
          id: 'placeholder_title_sub',
          name: '부제목',
          type: 'subtitle',
          position: { x: 80, y: 380, width: 1120, height: 70, zIndex: 2 },
          defaultStyle: { textAlign: 'center' },
        },
      ],
    },
    {
      id: DEFAULT_LAYOUT_ID,
      name: '제목 및 본문',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [
        { id: 'placeholder_tb_title', name: '제목', type: 'title', position: titlePosition, required: true },
        {
          id: 'placeholder_tb_body',
          name: '본문',
          type: 'body',
          position: { x: 80, y: 168, width: 1120, height: 500, zIndex: 2 },
        },
      ],
    },
    {
      id: 'layout_title_code',
      name: '제목 및 코드',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [
        { id: 'placeholder_tc_title', name: '제목', type: 'title', position: titlePosition, required: true },
        {
          id: 'placeholder_tc_code',
          name: '코드',
          type: 'code',
          position: { x: 80, y: 168, width: 1120, height: 500, zIndex: 2 },
        },
      ],
    },
    {
      id: 'layout_body_code',
      name: '본문 + 코드',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [
        { id: 'placeholder_bc_title', name: '제목', type: 'title', position: titlePosition, required: true },
        {
          id: 'placeholder_bc_body',
          name: '본문',
          type: 'body',
          position: { x: 80, y: 168, width: 500, height: 500, zIndex: 2 },
        },
        {
          id: 'placeholder_bc_code',
          name: '코드',
          type: 'code',
          position: { x: 610, y: 168, width: 590, height: 500, zIndex: 3 },
        },
      ],
    },
    {
      id: 'layout_title_only',
      name: '제목만',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [
        { id: 'placeholder_to_title', name: '제목', type: 'title', position: titlePosition, required: true },
      ],
    },
    {
      id: 'layout_blank',
      name: '빈 화면',
      masterId: DEFAULT_MASTER_ID,
      placeholders: [],
    },
  ]
}
