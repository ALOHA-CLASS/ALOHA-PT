import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, CURRENT_SCHEMA_VERSION } from '@/domain/constants'
import { addAssetRef, addElement, createProject } from '@/domain/projectOps'
import {
  blobToDataUrl,
  buildBackup,
  dataUrlToBlob,
  ImportError,
  JsonExporter,
  parseBackup,
  restoreBackup,
} from '@/services/export/jsonBackup'
import { IndexedDbAssetRepository } from '@/services/storage/assetRepository'
import { createDatabaseProvider } from '@/services/storage/db'
import { IndexedDbProjectRepository } from '@/services/storage/projectRepository'
import type { PresentationProject } from '@/types/project'

// 1×1 투명 PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`

let projects: IndexedDbProjectRepository
let assets: IndexedDbAssetRepository

beforeEach(() => {
  const getDb = createDatabaseProvider(new IDBFactory())
  projects = new IndexedDbProjectRepository(getDb)
  assets = new IndexedDbAssetRepository(getDb)
})

async function projectWithImage(): Promise<PresentationProject> {
  let project = createProject('이미지 프로젝트')
  const blob = dataUrlToBlob(PNG_DATA_URL)
  const storageKey = `${project.id}/asset_1`
  await assets.put(project.id, storageKey, blob)
  project = addAssetRef(project, {
    id: 'asset_1',
    name: 'pixel.png',
    mimeType: 'image/png',
    size: blob.size,
    width: 1,
    height: 1,
    storageKey,
    createdAt: project.createdAt,
  })
  project = addElement(project, project.slides[0].id, {
    id: 'element_img',
    type: 'image',
    assetId: 'asset_1',
    alt: 'pixel',
    fit: 'contain',
    position: { x: 10, y: 10, width: 100, height: 100, zIndex: 9 },
    visible: true,
    locked: false,
  })
  await projects.save(project)
  return project
}

describe('IndexedDB 저장소', () => {
  it('프로젝트를 저장·조회·목록화한다', async () => {
    const a = createProject('A')
    const b = { ...createProject('B'), updatedAt: '2999-01-01T00:00:00.000Z' }
    await projects.save(a)
    await projects.save(b)

    expect(await projects.getById(a.id)).toEqual(a)
    expect(await projects.getById('missing')).toBeNull()
    const list = await projects.list()
    expect(list.map((p) => p.name)).toEqual(['B', 'A'])
    expect(list[0]).toMatchObject({ id: b.id, slideCount: 1 })
  })

  it('같은 ID로 저장하면 덮어쓴다', async () => {
    const project = createProject('before')
    await projects.save(project)
    await projects.save({ ...project, name: 'after' })
    expect((await projects.list()).map((p) => p.name)).toEqual(['after'])
  })

  it('프로젝트를 삭제하면 해당 프로젝트의 Asset만 함께 삭제한다', async () => {
    const project = await projectWithImage()
    await assets.put('project_other', 'project_other/asset_x', new Blob(['x']))

    await projects.delete(project.id)
    expect(await projects.getById(project.id)).toBeNull()
    expect(await assets.get(project.assetRefs[0].storageKey)).toBeNull()
    expect(await assets.get('project_other/asset_x')).not.toBeNull()
  })

  it('Asset Blob을 저장하고 그대로 돌려준다', async () => {
    const blob = dataUrlToBlob(PNG_DATA_URL)
    await assets.put('project_1', 'project_1/asset_1', blob)
    const loaded = await assets.get('project_1/asset_1')
    expect(loaded).not.toBeNull()
    expect(await blobToDataUrl(loaded!, 'image/png')).toBe(PNG_DATA_URL)
    await assets.delete(['project_1/asset_1'])
    expect(await assets.get('project_1/asset_1')).toBeNull()
  })
})

describe('JSON 백업·복원', () => {
  it('이미지를 포함해 내보낸 백업을 새 프로젝트로 복원한다', async () => {
    const original = await projectWithImage()
    const file = await new JsonExporter(assets).export(original)
    const parsed = parseBackup(await file.text())
    const restored = await restoreBackup(parsed, projects, assets)

    expect(restored.id).not.toBe(original.id)
    expect(restored.name).toBe(original.name)
    expect(restored.slides).toEqual(original.slides)
    expect(restored.assetRefs[0].storageKey).toBe(`${restored.id}/asset_1`)

    const stored = await projects.getById(restored.id)
    expect(stored).toEqual(restored)
    const blob = await assets.get(restored.assetRefs[0].storageKey)
    expect(await blobToDataUrl(blob!, 'image/png')).toBe(PNG_DATA_URL)
    // 원본은 그대로 남는다
    expect(await projects.getById(original.id)).toEqual(original)
  })

  it('사용하지 않는 Asset은 백업에 넣지 않는다', async () => {
    const project = await projectWithImage()
    const withoutImage = {
      ...project,
      slides: project.slides.map((s) => ({ ...s, elements: s.elements.filter((e) => e.type !== 'image') })),
    }
    const backup = await buildBackup(withoutImage, assets)
    expect(backup.assets).toHaveLength(0)
    expect(backup.project.assetRefs).toHaveLength(0)
  })

  it('Asset 바이너리가 없으면 내보내기를 실패시킨다', async () => {
    const project = await projectWithImage()
    await assets.delete([project.assetRefs[0].storageKey])
    await expect(buildBackup(project, assets)).rejects.toThrow(/이미지 데이터를 찾을 수 없습니다/)
  })

  function backupText(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: '2026-11-25T00:00:00.000Z',
      project: createProject('p'),
      assets: [],
      ...overrides,
    })
  }

  it('잘못된 입력을 ImportError로 거부한다', () => {
    expect(() => parseBackup('{not json')).toThrow(ImportError)
    expect(() => parseBackup('{not json')).toThrow(/JSON 형식/)
    expect(() => parseBackup('[]')).toThrow(/백업 파일이 아닙니다/)
    expect(() => parseBackup(JSON.stringify({ format: 'other' }))).toThrow(/백업 파일이 아닙니다/)
    expect(() => parseBackup(backupText({ formatVersion: BACKUP_FORMAT_VERSION + 1 }))).toThrow(/최신 버전/)
    expect(() => parseBackup(backupText({ project: { name: 'x' } }))).toThrow(ImportError)
    expect(() =>
      parseBackup(backupText({ project: { ...createProject('p'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 } })),
    ).toThrow(/최신 버전/)
  })

  it('검증 오류의 세부 내용을 details로 전달한다', () => {
    const project = { ...createProject('p'), activeThemeId: 'theme_x' }
    try {
      parseBackup(backupText({ project }))
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError)
      expect((error as ImportError).details[0]).toContain('activeThemeId')
    }
  })

  it('이미지 데이터가 누락되었거나 허용되지 않은 형식이면 거부한다', async () => {
    const project = await projectWithImage()
    expect(() => parseBackup(backupText({ project }))).toThrow(/이미지 데이터가 없습니다/)

    const asset = { id: 'asset_1', name: 'x', mimeType: 'text/html' }
    expect(() =>
      parseBackup(backupText({ project, assets: [{ ...asset, dataUrl: 'data:text/html;base64,PGI+' }] })),
    ).toThrow(/지원하지 않는 이미지 형식/)
    expect(() =>
      parseBackup(backupText({ project, assets: [{ ...asset, dataUrl: 'https://example.com/a.png' }] })),
    ).toThrow(/이미지 데이터 형식/)
  })
})
