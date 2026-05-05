export const AI_MODELS = [
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash (AI Studio)' },
  { id: 'gemini-3-flash-preview', provider: 'google', label: 'Gemini 3 Flash Preview (AI Studio)' },
  { id: 'gemini-3.1-flash-lite-preview', provider: 'google', label: 'Gemini 3.1 Flash Lite Preview (AI Studio)' },
  { id: 'qwen/qwen3-vl-32b-instruct', provider: 'openrouter', label: 'Qwen3 VL 32B Instruct (OpenRouter)' },
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', label: 'Gemini 2.5 Flash Lite (OpenRouter)' },
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
