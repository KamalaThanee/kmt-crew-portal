import { NextResponse } from 'next/server'
import { getAiModels } from '@/lib/serverAiModels'
import { isAiUseCase } from '@/lib/aiModels'

export async function GET(req: Request) {
  const useCase = new URL(req.url).searchParams.get('useCase')
  if (!isAiUseCase(useCase)) {
    return NextResponse.json({ error: 'Invalid AI use case' }, { status: 400 })
  }
  const models = await getAiModels(useCase)
  return NextResponse.json({ models })
}
