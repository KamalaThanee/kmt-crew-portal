import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: 'Email delivery is handled by Google Apps Script. Use /api/ship-cert-email-summary instead.',
  })
}

export async function POST() {
  return GET()
}
