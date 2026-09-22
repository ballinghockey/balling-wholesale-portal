import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type VariantData = {
  sku: string
  stock: number
  price: number
  compareAtPrice: number | null
}

async function fetchShopifyData(shop: string, accessToken: string): Promise<VariantData[]> {
  const variants: VariantData[] = []
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
            price
            compareAtPrice
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

    const pageInfo = data?.data?.productVariants?.pageInfo
    const edges = data?.data?.productVariants?.edges ?? []

    for (const edge of edges) {
      const node = edge.node
      if (!node.sku) continue
      variants.push({
        sku: node.sku,
        stock: Math.max(0, node.inventoryQuantity ?? 0),
        price: parseFloat(node.price ?? '0'),
        compareAtPrice: node.compareAtPrice ? parseFloat(node.compareAtPrice) : null,
      })
    }

    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null
  } while (cursor)

  return variants
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ukShop = 'balling-eu-manegit.myshopify.com'
    const euShop = 'balling-hockey-global.myshopify.com'

    const [ukVariants, euVariants] = await Promise.all([
      fetchShopifyData(ukShop, process.env.SHOPIFY_UK_ACCESS_TOKEN!),
      fetchShopifyData(euShop, process.env.SHOPIFY_EU_ACCESS_TOKEN!),
    ])

    // Update UK stock
    const ukStockRows = ukVariants.map(v => ({ sku: v.sku, stock: v.stock }))
    if (ukStockRows.length > 0) {
      const { error: ukError } = await supabase
        .from('stock_uk')
        .upsert(ukStockRows, { onConflict: 'sku' })
      if (ukError) console.error('[UK stock] Error:', ukError.message)
    }

    // Update EU stock
    const euStockRows = euVariants.map(v => ({ sku: v.sku, stock: v.stock }))
    if (euStockRows.length > 0) {
      const { error: euError } = await supabase
        .from('stock_eu')
        .upsert(euStockRows, { onConflict: 'sku' })
      if (euError) console.error('[EU stock] Error:', euError.message)
    }

    // Update prices from UK store (GBP) — price = RRP, wholesale = price / 2
    // If compareAtPrice exists, product is on sale: compareAtPrice = RRP, price = sale price
    const priceUpdates: { sku: string; rrp_gbp: number; base_price_gbp: number; on_sale: boolean }[] = []

    for (const v of ukVariants) {
      if (!v.price || v.price === 0) continue
      const isOnSale = v.compareAtPrice !== null && v.compareAtPrice > v.price
      const rrp = isOnSale ? v.compareAtPrice! : v.price
      const wholesale = Math.round((rrp / 2) * 100) / 100
      priceUpdates.push({
        sku: v.sku,
        rrp_gbp: Math.round(rrp * 100) / 100,
        base_price_gbp: wholesale,
        on_sale: isOnSale,
      })
    }

    // Update prices from EU store (EUR)
    const eurPriceUpdates: { sku: string; rrp_eur: number; base_price_eur: number; on_sale: boolean }[] = []

    for (const v of euVariants) {
      if (!v.price || v.price === 0) continue
      const isOnSale = v.compareAtPrice !== null && v.compareAtPrice > v.price
      const rrp = isOnSale ? v.compareAtPrice! : v.price
      const wholesale = Math.round((rrp / 2) * 100) / 100
      eurPriceUpdates.push({
        sku: v.sku,
        rrp_eur: Math.round(rrp * 100) / 100,
        base_price_eur: wholesale,
        on_sale: isOnSale,
      })
    }

    // Batch update prices in Supabase (50 at a time)
    let pricesUpdated = 0
    for (let i = 0; i < priceUpdates.length; i += 50) {
      const batch = priceUpdates.slice(i, i + 50)
      for (const p of batch) {
        await supabase
          .from('products')
          .update({ rrp_gbp: p.rrp_gbp, base_price_gbp: p.base_price_gbp, on_sale: p.on_sale })
          .eq('sku', p.sku)
        pricesUpdated++
      }
    }

    for (const p of eurPriceUpdates) {
      await supabase
        .from('products')
        .update({ rrp_eur: p.rrp_eur, base_price_eur: p.base_price_eur, on_sale: p.on_sale })
        .eq('sku', p.sku)
    }

    console.log(`[sync] UK: ${ukVariants.length} variants, EU: ${euVariants.length} variants, ${pricesUpdated} prices updated`)

    return NextResponse.json({
      ok: true,
      uk_variants: ukVariants.length,
      eu_variants: euVariants.length,
      prices_updated: pricesUpdated,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync] Fatal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
