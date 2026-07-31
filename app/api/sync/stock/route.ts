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

    console.log(`[${shop}] GraphQL status:`, res.status)

    if (!res.ok) {
      const text = await res.text()
      console.error(`[${shop}] Error response:`, text)
      throw new Error(`Shopify API error: ${res.status}`)
    }

    const data = await res.json()

    if (data.errors) {
      console.error(`[${shop}] GraphQL errors:`, JSON.stringify(data.errors))
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
    }

    const variants = data?.data?.productVariants
    if (!variants) {
      throw new Error(`No variants in response`)
    }

    console.log(`[${shop}] Fetched ${variants.edges.length} variants, hasNextPage: ${variants.pageInfo.hasNextPage}`)

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

async function getKnownSkus(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('products')
    .select('sku')
    .eq('active', true)

  if (error) throw new Error(`Failed to fetch SKUs: ${error.message}`)
  return new Set((data ?? []).map((r: { sku: string }) => r.sku))
}

async function upsertStock(table: 'stock_uk' | 'stock_eu', stockMap: Map<string, number>, knownSkus: Set<string>) {
  const rows = Array.from(stockMap.entries())
    .filter(([sku]) => knownSkus.has(sku))
    .map(([sku, stock]) => ({ sku, stock }))

  const skipped = stockMap.size - rows.length
  console.log(`[${table}] Upserting ${rows.length} rows (skipped ${skipped} unknown SKUs)`)

  const batchSize = 200
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'sku' })

    if (error) {
      console.error(`[${table}] Upsert error:`, error.message)
      throw new Error(`Supabase upsert error on ${table}: ${error.message}`)
    }
  }

  console.log(`[${table}] Upsert complete`)
  return rows.length
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron-schedule') !== null

  if (!isVercelCron) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  console.log('[sync-stock] Starting stock sync...')

  // Get all known SKUs from our products table to avoid FK violations
  const knownSkus = await getKnownSkus()
  console.log(`[sync-stock] Known SKUs in products table: ${knownSkus.size}`)

  const results: Record<string, { status: string; synced?: number; error?: string }> = {}

  try {
    const ukToken = process.env.SHOPIFY_UK_ACCESS_TOKEN!
    const ukStock = await fetchShopifyInventory('balling-eu-manegit.myshopify.com', ukToken)
    const ukCount = await upsertStock('stock_uk', ukStock, knownSkus)
    results.uk = { synced: ukCount, status: 'ok' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-stock] UK error:', msg)
    results.uk = { status: 'error', error: msg }
  }

  try {
    const euToken = process.env.SHOPIFY_EU_ACCESS_TOKEN!
    const euStock = await fetchShopifyInventory('balling-hockey-global.myshopify.com', euToken)
    const euCount = await upsertStock('stock_eu', euStock, knownSkus)
    results.eu = { synced: euCount, status: 'ok' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-stock] EU error:', msg)
    results.eu = { status: 'error', error: msg }
  }

  console.log('[sync-stock] Done:', JSON.stringify(results))

  const allOk = Object.values(results).every((r) => r.status === 'ok')
  return NextResponse.json({ timestamp: new Date().toISOString(), results }, { status: allOk ? 200 : 207 })
}
