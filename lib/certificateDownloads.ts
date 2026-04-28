export const safeFileName = (value: string) => String(value || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')

export const getFileExtension = (url: string, contentType?: string | null) => {
  const mimeExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }

  if (contentType) {
    const matched = Object.entries(mimeExt).find(([mime]) => contentType.includes(mime))
    if (matched) return matched[1]
  }

  try {
    const path = new URL(url).pathname
    const ext = path.split('.').pop()?.split('?')[0]
    if (ext && ext.length <= 5) return ext
  } catch {}

  return 'pdf'
}

export const triggerDownload = (href: string, filename: string) => {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const crc32 = (data: Uint8Array) => {
  let crc = -1
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ -1) >>> 0
}

export const createZipBlob = (files: Array<{ name: string; data: Uint8Array }>) => {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  const writeHeader = (size: number, writer: (view: DataView) => void) => {
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    writer(view)
    return new Uint8Array(buffer)
  }

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name)
    const checksum = crc32(file.data)
    const localOffset = offset

    const localHeader = writeHeader(30, (view) => {
      view.setUint32(0, 0x04034b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 0, true)
      view.setUint16(8, 0, true)
      view.setUint16(10, 0, true)
      view.setUint16(12, 0, true)
      view.setUint32(14, checksum, true)
      view.setUint32(18, file.data.length, true)
      view.setUint32(22, file.data.length, true)
      view.setUint16(26, nameBytes.length, true)
      view.setUint16(28, 0, true)
    })

    chunks.push(localHeader, nameBytes, file.data)
    offset += localHeader.length + nameBytes.length + file.data.length

    const centralHeader = writeHeader(46, (view) => {
      view.setUint32(0, 0x02014b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 20, true)
      view.setUint16(8, 0, true)
      view.setUint16(10, 0, true)
      view.setUint16(12, 0, true)
      view.setUint16(14, 0, true)
      view.setUint32(16, checksum, true)
      view.setUint32(20, file.data.length, true)
      view.setUint32(24, file.data.length, true)
      view.setUint16(28, nameBytes.length, true)
      view.setUint16(30, 0, true)
      view.setUint16(32, 0, true)
      view.setUint16(34, 0, true)
      view.setUint16(36, 0, true)
      view.setUint32(38, 0, true)
      view.setUint32(42, localOffset, true)
    })

    centralChunks.push(centralHeader, nameBytes)
  })

  const centralOffset = offset
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const endHeader = writeHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(4, 0, true)
    view.setUint16(6, 0, true)
    view.setUint16(8, files.length, true)
    view.setUint16(10, files.length, true)
    view.setUint32(12, centralSize, true)
    view.setUint32(16, centralOffset, true)
    view.setUint16(20, 0, true)
  })

  const allChunks = [...chunks, ...centralChunks, endHeader]
  const totalLength = allChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const zipBytes = new Uint8Array(totalLength)
  let cursor = 0
  allChunks.forEach((chunk) => {
    zipBytes.set(chunk, cursor)
    cursor += chunk.length
  })

  return new Blob([zipBytes.buffer], { type: 'application/zip' })
}
