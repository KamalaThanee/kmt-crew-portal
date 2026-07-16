import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_AI_MODELS, isAiUseCase, type AiModel, type AiProvider, type AiUseCase } from '@/lib/aiModels'
import { isAdminRole } from '@/lib/roles'

type AiModelRow = {
  id: number
  use_case: AiUseCase
  provider: AiProvider
  model_id: string
  label: string
  priority: number
  enabled: boolean
  free_tier: boolean
}

const toAiModel = (row: AiModelRow): AiModel => ({
  id: row.id,
  useCase: row.use_case,
  provider: row.provider,
  modelId: row.model_id,
  label: row.label,
  priority: row.priority,
  enabled: row.enabled,
  freeTier: row.free_tier,
})

export function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase server configuration')
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getAiModels(useCase: AiUseCase, includeDisabled = false): Promise<AiModel[]> {
  try {
    const supabase = createServiceSupabase()
    let query = supabase
      .from('ai_model_configs')
      .select('id,use_case,provider,model_id,label,priority,enabled,free_tier')
      .eq('use_case', useCase)
      .order('priority', { ascending: true })
      .order('id', { ascending: true })
    if (!includeDisabled) query = query.eq('enabled', true)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => toAiModel(row as AiModelRow))
  } catch (error) {
    if (includeDisabled) throw error
    return DEFAULT_AI_MODELS[useCase]
  }
}

export async function resolveAiModel(
  useCaseValue: unknown,
  modelIdValue: unknown,
  providerValue: unknown,
): Promise<AiModel> {
  const useCase = isAiUseCase(useCaseValue) ? useCaseValue : 'crew_certificate'
  const modelId = String(modelIdValue || '')
  const provider = String(providerValue || '')
  const models = await getAiModels(useCase)
  const model = models.find((item) => item.modelId === modelId && item.provider === provider)
  if (!model) throw new Error('This AI model is disabled or not configured for this task')
  return model
}

export async function requireAdminRequest(req: Request) {
  const crewId = req.headers.get('x-kmt-user-id') || ''
  const pin = (req.headers.get('x-kmt-pin') || '').replace(/\D/g, '').slice(0, 6)
  if (!crewId || pin.length !== 6) throw new Error('Admin authentication required')

  const supabase = createServiceSupabase()
  const { data, error } = await supabase
    .from('crews')
    .select('id,full_name,position,is_active,resigned_at')
    .eq('id', crewId)
    .eq('pin', pin)
    .maybeSingle()

  if (error || !data || data.is_active === false || data.resigned_at || !isAdminRole(data.position)) {
    throw new Error('Admin authentication required')
  }
  return { supabase, admin: data }
}
