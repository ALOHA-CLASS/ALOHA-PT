export type IdPrefix =
  | 'project'
  | 'slide'
  | 'element'
  | 'animation'
  | 'asset'
  | 'theme'
  | 'master'
  | 'layout'
  | 'placeholder'

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
