export const CURRENT_SCHEMA_VERSION = 1

export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

export const BACKUP_FORMAT = 'aloha-slide-studio-project'
export const BACKUP_FORMAT_VERSION = 1

export const MIN_ELEMENT_SIZE = 8

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
