export function sanitizeFilename(name: string, fallback = 'presentation'): string {
  // 파일 이름에 쓸 수 없는 제어 문자도 함께 바꿉니다.
  // oxlint-disable-next-line no-control-regex
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 100)
  return cleaned || fallback
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 다운로드가 시작된 뒤 해제합니다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
