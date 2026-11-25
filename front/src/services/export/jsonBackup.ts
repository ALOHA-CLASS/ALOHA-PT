import {
  ALLOWED_IMAGE_MIME_TYPES,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  MAX_IMAGE_BYTES,
} from '@/domain/constants'
import { createId, nowIso } from '@/domain/ids'
import { migrateProject, UnsupportedVersionError } from '@/domain/migrations'
import { pruneUnusedAssets } from '@/domain/projectOps'
import { backupAssetSchema } from '@/domain/schema'
import { validateProject } from '@/domain/validation'
import type { ExportOptions, PresentationExporter } from '@/services/export/types'
import type { AssetRepository } from '@/services/storage/assetRepository'
import type { ProjectRepository } from '@/services/storage/projectRepository'
import type { BackupAsset, PresentationProject, ProjectBackup } from '@/types/project'

export class ImportError extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'ImportError'
    this.details = details
  }
}

const DATA_URL_PATTERN = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/i

export async function blobToDataUrl(blob: Blob, mimeType: string = blob.type): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

/** 허용된 이미지 형식의 base64 Data URL만 Blob으로 변환합니다. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = DATA_URL_PATTERN.exec(dataUrl)
  if (!match) throw new ImportError('이미지 데이터 형식이 올바르지 않습니다.')
  const mimeType = match[1].toLowerCase()
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ImportError(`지원하지 않는 이미지 형식입니다: ${mimeType}`)
  }
  if ((match[2].length * 3) / 4 > MAX_IMAGE_BYTES) {
    throw new ImportError('이미지 크기가 허용 한도(10MB)를 초과합니다.')
  }
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

/** 프로젝트와 실제로 사용 중인 Asset을 하나의 백업 객체로 묶습니다. */
export async function buildBackup(project: PresentationProject, assets: AssetRepository): Promise<ProjectBackup> {
  const { project: pruned } = pruneUnusedAssets(project)
  const backupAssets: BackupAsset[] = []
  for (const ref of pruned.assetRefs) {
    const blob = await assets.get(ref.storageKey)
    if (!blob) throw new Error(`이미지 데이터를 찾을 수 없습니다: ${ref.name}`)
    backupAssets.push({
      id: ref.id,
      name: ref.name,
      mimeType: ref.mimeType,
      dataUrl: await blobToDataUrl(blob, ref.mimeType),
    })
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    project: pruned,
    assets: backupAssets,
  }
}

export class JsonExporter implements PresentationExporter {
  readonly fileExtension = 'json'
  private readonly assets: AssetRepository

  constructor(assets: AssetRepository) {
    this.assets = assets
  }

  async export(project: PresentationProject, _options?: ExportOptions): Promise<Blob> {
    const backup = await buildBackup(project, this.assets)
    return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  }
}

export interface ParsedBackup {
  project: PresentationProject
  assets: Map<string, Blob>
}

/** 백업 파일 내용을 검증합니다: 포맷 식별 → 버전 확인 → 마이그레이션 → 데이터 검증 → Asset 검증. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('JSON 형식이 올바르지 않습니다.')
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new ImportError('ALOHA Slide Studio 백업 파일이 아닙니다.')
  }
  const backup = raw as Partial<Record<keyof ProjectBackup, unknown>>
  if (typeof backup.formatVersion !== 'number' || backup.formatVersion < 1) {
    throw new ImportError('백업 파일의 버전 정보가 올바르지 않습니다.')
  }
  if (backup.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new ImportError('더 최신 버전에서 만든 백업 파일이라 현재 버전에서 열 수 없습니다.')
  }

  let migrated: unknown
  try {
    migrated = migrateProject(backup.project)
  } catch (error) {
    if (error instanceof UnsupportedVersionError) throw new ImportError(error.message)
    throw error
  }

  const validation = validateProject(migrated)
  if (!validation.ok) throw new ImportError('프로젝트 데이터가 올바르지 않습니다.', validation.errors)
  const project = validation.project

  const parsedAssets = backupAssetSchema.array().safeParse(backup.assets ?? [])
  if (!parsedAssets.success) throw new ImportError('백업 파일의 이미지 목록이 올바르지 않습니다.')
  const byId = new Map(parsedAssets.data.map((asset) => [asset.id, asset]))

  const assets = new Map<string, Blob>()
  for (const ref of project.assetRefs) {
    const asset = byId.get(ref.id)
    if (!asset) throw new ImportError(`백업 파일에 이미지 데이터가 없습니다: ${ref.name}`)
    assets.set(ref.id, dataUrlToBlob(asset.dataUrl))
  }
  return { project, assets }
}

/**
 * 검증된 백업을 새 프로젝트로 저장합니다.
 * 기존 프로젝트를 덮어쓰지 않도록 프로젝트 ID와 Asset 저장 키를 새로 발급합니다.
 */
export async function restoreBackup(
  parsed: ParsedBackup,
  projects: ProjectRepository,
  assets: AssetRepository,
): Promise<PresentationProject> {
  const projectId = createId('project')
  const project: PresentationProject = {
    ...parsed.project,
    id: projectId,
    updatedAt: nowIso(),
    assetRefs: parsed.project.assetRefs.map((ref) => {
      const blob = parsed.assets.get(ref.id)!
      return { ...ref, mimeType: blob.type, size: blob.size, storageKey: `${projectId}/${ref.id}` }
    }),
  }
  try {
    for (const ref of project.assetRefs) {
      await assets.put(projectId, ref.storageKey, parsed.assets.get(ref.id)!)
    }
    await projects.save(project)
  } catch (error) {
    await projects.delete(projectId).catch(() => {})
    throw error
  }
  return project
}
