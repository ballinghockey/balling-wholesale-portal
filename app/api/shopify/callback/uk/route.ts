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

  const shop = 'balling-eu-manegit.myshopify.com'
  const clientId = 'b1ee73251b7cbd7868119c580ef6c6e9'
  const clientSecret = process.env.SHOPIFY_UK_CLIENT_SECRET!
  const redirectUri = 'https://balling-wholesale-portal.vercel.app/api/shopify/callback/uk'

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  const raw = await tokenRes.text()

  let tokenData: any
  try {
    tokenData = JSON.parse(raw)
  } catch {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px">
        <h2>❌ Shopify returned unexpected response</h2>
        <p>Status: ${tokenRes.status}</p>
        <pre style="background:#f5f5f5;padding:16px;overflow:auto">${raw}</pre>
        <p>Check that SHOPIFY_UK_CLIENT_SECRET is correctly set in Vercel.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!tokenData.access_token) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px">
        <h2>❌ Token exchange failed</h2>
        <pre style="background:#f5f5f5;padding:16px">${JSON.stringify(tokenData, null, 2)}</pre>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:40px;max-width:600px">
      <h2>✅ Shopify UK Access Token Generated</h2>
      <p>Copy this token and add it as a Vercel environment variable named <strong>SHOPIFY_UK_ACCESS_TOKEN</strong>:</p>
      <textarea rows="4" style="width:100%;padding:8px;font-size:13px">${tokenData.access_token}</textarea>
      <p style="margin-top:20px;color:#666;font-size:13px">
        Once saved in Vercel, you can close this page. The token does not expire.
      </p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
