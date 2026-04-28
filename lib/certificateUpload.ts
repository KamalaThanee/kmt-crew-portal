export const AI_MODELS = [
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', provider: 'openrouter', label: 'Nvidia Nemotron (Free)' },
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash (AI Studio)' },
  { id: 'google/gemma-4-31b-it:free', provider: 'openrouter', label: 'Gemma 4 31B (Backup Free)' },
]

export const compressImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxWidth = 1000
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
    }
  })
