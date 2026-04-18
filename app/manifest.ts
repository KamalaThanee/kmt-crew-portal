import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KMT Crew Portal',
    short_name: 'KMT Portal',
    description: 'KMT PPE Inventory & Request Management System',
    start_url: '/',
    display: 'standalone', // ทำให้เหมือนแอปมือถือ 100% ไม่มีแถบ URL
    background_color: '#020617',
    theme_color: '#020617',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ],
  }
}
