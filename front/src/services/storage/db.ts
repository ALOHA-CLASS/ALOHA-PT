const DB_NAME = 'aloha-slide-studio'
const DB_VERSION = 1

export const PROJECT_STORE = 'projects'
export const ASSET_STORE = 'assets'
export const ASSET_PROJECT_INDEX = 'projectId'

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 요청에 실패했습니다.'))
  })
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 트랜잭션에 실패했습니다.'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 트랜잭션이 중단되었습니다.'))
  })
}

export type DatabaseProvider = () => Promise<IDBDatabase>

/** 연결을 한 번만 열어 재사용하는 provider를 만듭니다. 테스트에서는 factory를 교체할 수 있습니다. */
export function createDatabaseProvider(factory?: IDBFactory, name: string = DB_NAME): DatabaseProvider {
  let opening: Promise<IDBDatabase> | null = null

  return () => {
    if (opening) return opening
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = factory ?? globalThis.indexedDB
      if (!idb) {
        reject(new Error('이 브라우저에서는 IndexedDB를 사용할 수 없습니다.'))
        return
      }
      const request = idb.open(name, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          const assets = db.createObjectStore(ASSET_STORE, { keyPath: 'storageKey' })
          assets.createIndex(ASSET_PROJECT_INDEX, 'projectId', { unique: false })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        // 다른 탭에서 스키마를 올리면 연결을 닫아 업그레이드를 막지 않도록 합니다.
        db.onversionchange = () => {
          db.close()
          opening = null
        }
        resolve(db)
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열 수 없습니다.'))
      request.onblocked = () => reject(new Error('다른 탭에서 데이터베이스를 사용 중입니다.'))
    }).catch((error) => {
      opening = null
      throw error
    })
    return opening
  }
}
