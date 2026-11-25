import {
  ASSET_STORE,
  requestToPromise,
  transactionDone,
  type DatabaseProvider,
} from '@/services/storage/db'

interface AssetRecord {
  storageKey: string
  projectId: string
  blob: Blob
}

export interface AssetRepository {
  put(projectId: string, storageKey: string, blob: Blob): Promise<void>
  get(storageKey: string): Promise<Blob | null>
  delete(storageKeys: readonly string[]): Promise<void>
}

export class IndexedDbAssetRepository implements AssetRepository {
  private readonly getDb: DatabaseProvider

  constructor(getDb: DatabaseProvider) {
    this.getDb = getDb
  }

  async put(projectId: string, storageKey: string, blob: Blob): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction(ASSET_STORE, 'readwrite')
    const record: AssetRecord = { storageKey, projectId, blob }
    tx.objectStore(ASSET_STORE).put(record)
    await transactionDone(tx)
  }

  async get(storageKey: string): Promise<Blob | null> {
    const db = await this.getDb()
    const tx = db.transaction(ASSET_STORE, 'readonly')
    const record = await requestToPromise<AssetRecord | undefined>(tx.objectStore(ASSET_STORE).get(storageKey))
    return record?.blob ?? null
  }

  async delete(storageKeys: readonly string[]): Promise<void> {
    if (storageKeys.length === 0) return
    const db = await this.getDb()
    const tx = db.transaction(ASSET_STORE, 'readwrite')
    const store = tx.objectStore(ASSET_STORE)
    for (const key of storageKeys) store.delete(key)
    await transactionDone(tx)
  }
}
