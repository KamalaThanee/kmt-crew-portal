import { NextResponse } from 'next/server'
import { isAiUseCase, type AiProvider } from '@/lib/aiModels'
import { getAiModels, requireAdminRequest } from '@/lib/serverAiModels'

const isProvider = (value: unknown): value is AiProvider => value === 'google' || value === 'openrouter'
const fail = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'AI model settings request failed'
  return NextResponse.json({ error: message }, { status: message === 'Admin authentication required' ? 401 : 500 })
}

export async function GET(req: Request) {
  try {
    await requireAdminRequest(req)
    const useCase = new URL(req.url).searchParams.get('useCase')
    if (!isAiUseCase(useCase)) return NextResponse.json({ error: 'Invalid AI use case' }, { status: 400 })
    return NextResponse.json({ models: await getAiModels(useCase, true) })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, admin } = await requireAdminRequest(req)
    const body = await req.json()
    if (!isAiUseCase(body.useCase) || !isProvider(body.provider) || !String(body.modelId || '').trim()) {
      return NextResponse.json({ error: 'Use case, provider, and model ID are required' }, { status: 400 })
    }
    const { error } = await supabase.from('ai_model_configs').insert({
      use_case: body.useCase,
      provider: body.provider,
      model_id: String(body.modelId).trim(),
      label: String(body.label || body.modelId).trim(),
      priority: Math.max(1, Number(body.priority) || 1),
      enabled: body.enabled !== false,
      free_tier: body.freeTier !== false,
      updated_by: admin.full_name || admin.id,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, admin } = await requireAdminRequest(req)
    const body = await req.json()
    if (!Array.isArray(body.models) || body.models.length === 0) {
      return NextResponse.json({ error: 'No model settings supplied' }, { status: 400 })
    }
    for (const [index, model] of body.models.entries()) {
      if (!Number.isInteger(model.id) || !isAiUseCase(model.useCase) || !isProvider(model.provider) || !String(model.modelId || '').trim()) {
        return NextResponse.json({ error: 'Invalid AI model settings' }, { status: 400 })
      }
      const { error } = await supabase
        .from('ai_model_configs')
        .update({
          provider: model.provider,
          model_id: String(model.modelId).trim(),
          label: String(model.label || model.modelId).trim(),
          priority: index + 1,
          enabled: model.enabled !== false,
          free_tier: model.freeTier !== false,
          updated_by: admin.full_name || admin.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', model.id)
        .eq('use_case', model.useCase)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase } = await requireAdminRequest(req)
    const id = Number(new URL(req.url).searchParams.get('id'))
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 })
    const { error } = await supabase.from('ai_model_configs').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
