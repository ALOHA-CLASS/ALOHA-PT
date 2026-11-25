// IndexedDB의 Asset Blob을 화면 표시용 object URL로 바꿔 캐시합니다.
import { assetRepository } from '@/services/storage'

const urls = new Map<string, string>()
const pending = new Set<string>()
const missing = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeAssetUrls(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAssetUrl(storageKey: string): string | undefined {
  return urls.get(storageKey)
}

/** 아직 캐시에 없으면 Blob을 읽어 URL을 만듭니다. 완료되면 구독자에게 알립니다. */
export function requestAssetUrl(storageKey: string): void {
  if (urls.has(storageKey) || pending.has(storageKey) || missing.has(storageKey)) return
  pending.add(storageKey)
  assetRepository
    .get(storageKey)
    .then((blob) => {
      if (blob) urls.set(storageKey, URL.createObjectURL(blob))
      else missing.add(storageKey)
    })
    .catch((error) => {
      console.error('Asset 로드 실패', storageKey, error)
      missing.add(storageKey)
    })
    .finally(() => {
      pending.delete(storageKey)
      emit()
    })
}

/** 방금 업로드한 Blob을 저장소 왕복 없이 바로 표시할 수 있게 등록합니다. */
export function primeAssetUrl(storageKey: string, blob: Blob): void {
  if (urls.has(storageKey)) return
  missing.delete(storageKey)
  urls.set(storageKey, URL.createObjectURL(blob))
  emit()
}

export function releaseAssetUrls(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
  missing.clear()
  emit()
}
