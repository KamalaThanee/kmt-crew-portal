import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { user, subscription } = await request.json()
    const endpoint = subscription?.endpoint

    if (!user?.id || !endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        crew_id: user.id,
        crew_name: user.full_name || null,
        role: user.position || null,
        endpoint,
        subscription,
        user_agent: request.headers.get('user-agent') || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to save subscription' }, { status: 500 })
  }
}
