import { toSummary } from '@/domain/projectOps'
import {
  ASSET_PROJECT_INDEX,
  ASSET_STORE,
  PROJECT_STORE,
  requestToPromise,
  transactionDone,
  type DatabaseProvider,
} from '@/services/storage/db'
import type { PresentationProject, ProjectSummary } from '@/types/project'

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>
  getById(id: string): Promise<PresentationProject | null>
  save(project: PresentationProject): Promise<void>
  /** 프로젝트와 그 프로젝트에 속한 Asset을 함께 삭제합니다. */
  delete(id: string): Promise<void>
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private readonly getDb: DatabaseProvider

  constructor(getDb: DatabaseProvider) {
    this.getDb = getDb
  }

  async list(): Promise<ProjectSummary[]> {
    const db = await this.getDb()
    const tx = db.transaction(PROJECT_STORE, 'readonly')
    const projects = await requestToPromise<PresentationProject[]>(tx.objectStore(PROJECT_STORE).getAll())
    return projects.map(toSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getById(id: string): Promise<PresentationProject | null> {
    const db = await this.getDb()
    const tx = db.transaction(PROJECT_STORE, 'readonly')
    const project = await requestToPromise<PresentationProject | undefined>(tx.objectStore(PROJECT_STORE).get(id))
    return project ?? null
  }

  async save(project: PresentationProject): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction(PROJECT_STORE, 'readwrite')
    tx.objectStore(PROJECT_STORE).put(project)
    await transactionDone(tx)
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
    tx.objectStore(PROJECT_STORE).delete(id)
    const index = tx.objectStore(ASSET_STORE).index(ASSET_PROJECT_INDEX)
    const cursorRequest = index.openKeyCursor(id)
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) return
      tx.objectStore(ASSET_STORE).delete(cursor.primaryKey)
      cursor.continue()
    }
    await transactionDone(tx)
  }
}
