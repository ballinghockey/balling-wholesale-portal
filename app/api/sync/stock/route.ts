import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchShopifyInventory(shop: string, accessToken: string): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>()
  let cursor: string | null = null

  do {
    const afterClause: string = cursor ? `, after: "${cursor}"` : ''
    const query = `{
      productVariants(first: 250${afterClause}) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            sku
            inventoryQuantity
          }
        }
      }
    }`

    const res = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json()
    const variants = data?.data?.productVariants

    if (!variants) {
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`)
    }

    for (const edge of variants.edges) {
      const { sku, inventoryQuantity } = edge.node
      if (sku && inventoryQuantity !== null) {
        stockMap.set(sku, (stockMap.get(sku) ?? 0) + inventoryQuantity)
      }
    }

    cursor = variants.pageInfo.hasNextPage ? variants.pageInfo.endCursor : null
  } while (cursor)

  return stockMap
}

async function upsertStock(table: 'stock_uk' | 'stock_eu', stockMap: Map<string, number>) {
  const rows = Array.from(stockMap.entries()).map(([sku, stock]) => ({ sku, stock }))

  const batchSize = 200
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'sku' })

    if (error) throw new Error(`Supabase upsert error on ${table}: ${error.message}`)
  }

  return rows.length
}

export async function GET(req: NextRequest) {
  // Allow Vercel cron invocations (they include x-vercel-cron-schedule header)
  const isVercelCron = req.headers.get('x-vercel-cron-schedule') !== null

  if (!isVercelCron) {
    // For manual/external calls, require the CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results: Record<string, { status: string; synced?: number; error?: string }> = {}

  try {
    const ukToken = process.env.SHOPIFY_UK_ACCESS_TOKEN!
    const ukStock = await fetchShopifyInventory('balling-eu-manegit.myshopify.com', ukToken)
    const ukCount = await upsertStock('stock_uk', ukStock)
    results.uk = { synced: ukCount, status: 'ok' }
  } catch (err: unknown) {
    results.uk = { status: 'error', error: err instanceof Error ? err.message : String(err) }
  }

  try {
    const euToken = process.env.SHOPIFY_EU_ACCESS_TOKEN!
    const euStock = await fetchShopifyInventory('balling-hockey-global.myshopify.com', euToken)
    const euCount = await upsertStock('stock_eu', euStock)
    results.eu = { synced: euCount, status: 'ok' }
  } catch (err: unknown) {
    results.eu = { status: 'error', error: err instanceof Error ? err.message : String(err) }
  }

  const allOk = Object.values(results).every((r) => r.status === 'ok')

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  }, { status: allOk ? 200 : 207 })
}
