import { CURRENT_SCHEMA_VERSION } from '@/domain/constants'

type RawProject = Record<string, unknown>
type Migration = (project: RawProject) => RawProject

// 키는 "변환 전 버전"입니다. 예: MIGRATIONS[1]은 v1 → v2 변환 함수.
const MIGRATIONS: Record<number, Migration> = {}

export class UnsupportedVersionError extends Error {
  readonly version: unknown

  constructor(version: unknown) {
    super(
      typeof version === 'number' && version > CURRENT_SCHEMA_VERSION
        ? `이 파일은 더 최신 버전(스키마 v${version})에서 만들어져 현재 버전(v${CURRENT_SCHEMA_VERSION})에서 열 수 없습니다.`
        : '지원하지 않는 프로젝트 스키마 버전입니다.',
    )
    this.name = 'UnsupportedVersionError'
    this.version = version
  }
}

/**
 * 구버전 프로젝트 데이터를 현재 스키마로 순차 변환합니다. 입력 객체는 변경하지 않습니다.
 * 더 높은 버전이거나 버전 정보가 올바르지 않으면 UnsupportedVersionError를 던집니다.
 */
export function migrateProject(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const version = (raw as RawProject).schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedVersionError(version)
  }

  let current = structuredClone(raw) as RawProject
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) throw new UnsupportedVersionError(v)
    current = { ...migrate(current), schemaVersion: v + 1 }
  }
  return current
}
