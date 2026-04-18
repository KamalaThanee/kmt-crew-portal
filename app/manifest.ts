import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KMT Crew Portal',
    short_name: 'KMT Portal',
    description: 'KMT PPE Inventory & Request Management System',
    start_url: '/',
    display: 'standalone', // 🎯 ตัวนี้สำคัญ ทำให้เปิดมาไม่มีแถบ URL
    background_color: '#020617', // สี slate-950
    theme_color: '#020617',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
