export const AI_USE_CASES = ['crew_certificate', 'cv', 'ship_certificate', 'sms'] as const

export type AiUseCase = (typeof AI_USE_CASES)[number]
export type AiProvider = 'google' | 'openrouter'

export type AiModel = {
  id?: number
  useCase: AiUseCase
  provider: AiProvider
  modelId: string
  label: string
  priority: number
  enabled: boolean
  freeTier: boolean
}

const BASE_MODELS: Array<Omit<AiModel, 'useCase' | 'priority'>> = [
  { modelId: 'gemini-3.1-flash-lite-preview', provider: 'google', label: 'Gemini 3.1 Flash Lite Preview (AI Studio)', enabled: true, freeTier: true },
  { modelId: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash (AI Studio)', enabled: true, freeTier: true },
  { modelId: 'gemini-3-flash-preview', provider: 'google', label: 'Gemini 3 Flash Preview (AI Studio)', enabled: true, freeTier: true },
  { modelId: 'google/gemini-2.5-flash-lite', provider: 'openrouter', label: 'Gemini 2.5 Flash Lite (OpenRouter)', enabled: true, freeTier: true },
  { modelId: 'qwen/qwen3-vl-32b-instruct', provider: 'openrouter', label: 'Qwen3 VL 32B Instruct (OpenRouter)', enabled: true, freeTier: true },
]

export const DEFAULT_AI_MODELS = Object.fromEntries(
  AI_USE_CASES.map((useCase) => [
    useCase,
    BASE_MODELS.map((model, index) => ({ ...model, useCase, priority: index + 1 })),
  ]),
) as Record<AiUseCase, AiModel[]>

export const AI_USE_CASE_LABELS: Record<AiUseCase, string> = {
  crew_certificate: 'Crew Certificates',
  cv: 'CV Autofill',
  ship_certificate: 'Ship Certificates',
  sms: 'SMS Library',
}

export function isAiUseCase(value: unknown): value is AiUseCase {
  return AI_USE_CASES.includes(value as AiUseCase)
}

export async function fetchAiModels(useCase: AiUseCase): Promise<AiModel[]> {
  try {
    const response = await fetch(`/api/ai-models?useCase=${encodeURIComponent(useCase)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to load AI model settings')
    const payload = await response.json()
    if (!Array.isArray(payload.models)) throw new Error('Invalid AI model settings')
    return payload.models as AiModel[]
  } catch {
    return DEFAULT_AI_MODELS[useCase]
  }
}
