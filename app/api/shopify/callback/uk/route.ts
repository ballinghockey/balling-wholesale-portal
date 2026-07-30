import { NextRequest, NextResponse } from 'next/server'

// This route handles the OAuth callback from Shopify UK store.
// After authorizing, Shopify redirects here with a ?code= param.
// We exchange that code for a permanent access token and display it
// so it can be saved as a Vercel environment variable.

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
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 500 })
  }

  // Display the token so it can be saved to Vercel env vars.
  // This page is only ever seen by you (the admin), never by customers.
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
