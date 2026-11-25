import { useEffect, useSyncExternalStore } from 'react'
import { getAssetUrl, requestAssetUrl, subscribeAssetUrls } from '@/services/storage/assetUrls'
import type { AssetReference } from '@/types/project'

/** assetId에 해당하는 이미지의 표시용 URL을 돌려줍니다. 로딩 중이거나 없으면 undefined. */
export function useAssetUrl(assets: readonly AssetReference[], assetId: string | undefined): string | undefined {
  const storageKey = assetId ? assets.find((asset) => asset.id === assetId)?.storageKey : undefined
  const url = useSyncExternalStore(subscribeAssetUrls, () => (storageKey ? getAssetUrl(storageKey) : undefined))
  useEffect(() => {
    if (storageKey) requestAssetUrl(storageKey)
  }, [storageKey])
  return url
}
