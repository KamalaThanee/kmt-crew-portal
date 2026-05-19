'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminApprovalsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/ppe?view=history')
  }, [router])

  return null
}
