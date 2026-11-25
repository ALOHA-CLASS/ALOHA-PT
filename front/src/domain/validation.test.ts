import { describe, expect, it } from 'vitest'
import fixtureV1 from '@/domain/__fixtures__/project.v1.json'
import { CURRENT_SCHEMA_VERSION } from '@/domain/constants'
import { migrateProject, UnsupportedVersionError } from '@/domain/migrations'
import { createProject } from '@/domain/projectOps'
import { validateProject } from '@/domain/validation'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function errorsOf(data: unknown): string[] {
  const result = validateProject(data)
  return result.ok ? [] : result.errors
}

describe('validateProject', () => {
  it('DATA_MODEL.md의 v1 예시 데이터를 받아들인다', () => {
    const result = validateProject(migrateProject(fixtureV1))
    expect(result.ok).toBe(true)
  })

  it('필수 필드가 없으면 거부한다', () => {
    const data = clone(fixtureV1) as Record<string, unknown>
    delete data.slides
    expect(errorsOf(data).join('\n')).toContain('slides')
  })

  it('알 수 없는 요소 타입을 거부한다', () => {
    const data = clone(fixtureV1)
    ;(data.slides[0].elements[0] as { type: string }).type = 'video'
    expect(validateProject(data).ok).toBe(false)
  })

  it('음수 크기와 0 이하 캔버스를 거부한다', () => {
    const negative = clone(fixtureV1)
    negative.slides[0].elements[0].position.width = -1
    expect(validateProject(negative).ok).toBe(false)

    const canvas = clone(fixtureV1)
    canvas.canvas.height = 0
    expect(validateProject(canvas).ok).toBe(false)
  })

  it('중복 ID를 찾아낸다', () => {
    const project = createProject('p')
    const slide = project.slides[0]
    const dup = { ...project, slides: [slide, { ...slide }] }
    expect(errorsOf(dup).some((e) => e.includes('중복된 ID'))).toBe(true)
  })

  it('존재하지 않는 참조를 찾아낸다', () => {
    const project = createProject('p')
    const slide = project.slides[0]

    expect(errorsOf({ ...project, activeThemeId: 'theme_x' })[0]).toContain('activeThemeId')
    expect(errorsOf({ ...project, slides: [{ ...slide, layoutId: 'layout_x' }] })[0]).toContain('레이아웃')
    expect(errorsOf({ ...project, slides: [{ ...slide, masterId: 'master_x' }] })[0]).toContain('마스터')
    expect(
      errorsOf({
        ...project,
        slides: [{ ...slide, elements: [{ ...slide.elements[0], placeholderId: 'placeholder_x' }] }],
      })[0],
    ).toContain('placeholder')
    expect(
      errorsOf({
        ...project,
        slides: [
          {
            ...slide,
            animations: [
              { id: 'a1', elementId: 'nope', effect: 'fadeIn', trigger: 'onClick', duration: 1, delay: 0, order: 0 },
            ],
          },
        ],
      })[0],
    ).toContain('애니메이션')
    expect(
      errorsOf({
        ...project,
        slides: [
          {
            ...slide,
            elements: [
              {
                id: 'img',
                type: 'image',
                assetId: 'asset_x',
                alt: '',
                fit: 'cover',
                position: { x: 0, y: 0, width: 1, height: 1, zIndex: 1 },
                visible: true,
                locked: false,
              },
            ],
          },
        ],
      })[0],
    ).toContain('Asset')
  })

  it('http(s)가 아닌 이미지 URL을 거부한다', () => {
    const project = createProject('p')
    const image = {
      id: 'img',
      type: 'image',
      sourceUrl: 'javascript:alert(1)',
      alt: '',
      fit: 'cover',
      position: { x: 0, y: 0, width: 1, height: 1, zIndex: 1 },
      visible: true,
      locked: false,
    }
    const bad = { ...project, slides: [{ ...project.slides[0], elements: [image] }] }
    expect(validateProject(bad).ok).toBe(false)
    const good = {
      ...project,
      slides: [{ ...project.slides[0], elements: [{ ...image, sourceUrl: 'https://example.com/a.png' }] }],
    }
    expect(validateProject(good).ok).toBe(true)
  })
})

describe('migrateProject', () => {
  it('현재 버전 데이터는 내용을 유지하고 원본을 변경하지 않는다', () => {
    const original = clone(fixtureV1)
    const migrated = migrateProject(original)
    expect(migrated).toEqual(fixtureV1)
    expect(migrated).not.toBe(original)
  })

  it('더 높은 버전은 열지 않는다', () => {
    const future = { ...clone(fixtureV1), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }
    expect(() => migrateProject(future)).toThrow(UnsupportedVersionError)
    expect(() => migrateProject(future)).toThrow(/최신 버전/)
  })

  it('버전 정보가 없거나 잘못되면 거부한다', () => {
    expect(() => migrateProject({ ...clone(fixtureV1), schemaVersion: '1' })).toThrow(UnsupportedVersionError)
    expect(() => migrateProject({ name: 'x' })).toThrow(UnsupportedVersionError)
  })
})
