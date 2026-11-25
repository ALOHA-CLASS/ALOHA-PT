// 해시 기반의 가벼운 라우터. 정적 호스팅에서도 새로고침이 동작합니다.
import { useSyncExternalStore } from 'react'

export type Route = { name: 'projects' } | { name: 'editor'; projectId: string }

export function parseRoute(hash: string): Route {
  const match = /^#\/p\/([^/?#]+)/.exec(hash)
  if (match) return { name: 'editor', projectId: decodeURIComponent(match[1]) }
  return { name: 'projects' }
}

export function projectPath(projectId: string): string {
  return `#/p/${encodeURIComponent(projectId)}`
}

export function navigate(hash: string): void {
  window.location.hash = hash
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

/** 현재 주소의 해시를 구독합니다. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}
