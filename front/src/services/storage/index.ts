import { IndexedDbAssetRepository, type AssetRepository } from '@/services/storage/assetRepository'
import { createDatabaseProvider } from '@/services/storage/db'
import { IndexedDbProjectRepository, type ProjectRepository } from '@/services/storage/projectRepository'

const getDb = createDatabaseProvider()

// UI와 스토어는 이 인터페이스에만 의존합니다. 서버 저장소가 생기면 구현체만 교체합니다.
export const projectRepository: ProjectRepository = new IndexedDbProjectRepository(getDb)
export const assetRepository: AssetRepository = new IndexedDbAssetRepository(getDb)

export type { AssetRepository, ProjectRepository }
