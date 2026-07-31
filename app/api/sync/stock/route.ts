import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron-schedule') !== null

  if (!isVercelCron) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const debug: Record<string, unknown> = {}

  // Test UK token
  const ukToken = process.env.SHOPIFY_UK_ACCESS_TOKEN ?? 'MISSING'
  debug.uk_token_present = ukToken !== 'MISSING'
  debug.uk_token_prefix = ukToken.substring(0, 10)

  try {
    const res = await fetch('https://balling-eu-manegit.myshopify.com/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ukToken,
      },
      body: JSON.stringify({
        query: `{ productVariants(first: 3) { edges { node { sku inventoryQuantity } } } }`
      }),
    })

    debug.uk_status = res.status
    const ukData = await res.json()
    debug.uk_response = ukData
  } catch (err: unknown) {
    debug.uk_error = err instanceof Error ? err.message : String(err)
  }

  // Test EU token
  const euToken = process.env.SHOPIFY_EU_ACCESS_TOKEN ?? 'MISSING'
  debug.eu_token_present = euToken !== 'MISSING'
  debug.eu_token_prefix = euToken.substring(0, 10)

  try {
    const res = await fetch('https://balling-hockey-global.myshopify.com/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': euToken,
      },
      body: JSON.stringify({
        query: `{ productVariants(first: 3) { edges { node { sku inventoryQuantity } } } }`
      }),
    })

    debug.eu_status = res.status
    const euData = await res.json()
    debug.eu_response = euData
  } catch (err: unknown) {
    debug.eu_error = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(debug)
}
