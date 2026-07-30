import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: 'No code received from Shopify' }, { status: 400 })
  }

  const shop = 'balling-hockey-global.myshopify.com'
  const clientId = '51b17c06883f569712acaa9bf721bd5e'
  const clientSecret = process.env.SHOPIFY_EU_CLIENT_SECRET!
  const redirectUri = 'https://balling-wholesale-portal.vercel.app/api/shopify/callback/eu'

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 500 })
  }

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:40px;max-width:600px">
      <h2>✅ Shopify EU Access Token Generated</h2>
      <p>Copy this token and add it as a Vercel environment variable named <strong>SHOPIFY_EU_ACCESS_TOKEN</strong>:</p>
      <textarea rows="4" style="width:100%;padding:8px;font-size:13px">${tokenData.access_token}</textarea>
      <p style="margin-top:20px;color:#666;font-size:13px">
        Once saved in Vercel, you can close this page. The token does not expire.
      </p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
