// ============================================================
// Script para crear los usuarios de autenticación y vincularlos
// a los clientes ya cargados en la tabla `customers`.
//
// CÓMO USARLO (una sola vez):
// 1. Asegurate de tener SUPABASE_SERVICE_ROLE_KEY en tu .env.local
//    (la "Secret key" que copiaste de Supabase, la pegás vos
//    directamente en el archivo .env.local de tu compu, NUNCA en el chat)
// 2. Corré en la terminal, desde la carpeta del proyecto:
//      node scripts/create-users.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Carga manual del .env.local (sin dependencias extra)
const envFile = readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim()
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// Clientes a crear: email + contraseña temporal que cada uno
// debería cambiar en su primer ingreso (a futuro se puede
// agregar flujo de "olvidé mi contraseña" / invitación por email)
const CUSTOMERS = [
  { customer_id: 'C001', email: 'orders@jumbo.nl', password: 'Balling2026!' },
  { customer_id: 'C002', email: 'jaime@ch.com', password: 'Balling2026!' },
  { customer_id: 'C003', email: 'martin@fullhockey.com', password: 'Balling2026!' },
]

async function run() {
  for (const c of CUSTOMERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: c.email,
      password: c.password,
      email_confirm: true,
    })

    if (error) {
      console.error(`Error creando usuario ${c.email}:`, error.message)
      continue
    }

    const authUserId = data.user.id

    const { error: updateError } = await supabase
      .from('customers')
      .update({ auth_user_id: authUserId })
      .eq('customer_id', c.customer_id)

    if (updateError) {
      console.error(`Error vinculando ${c.customer_id}:`, updateError.message)
    } else {
      console.log(`✓ ${c.customer_id} (${c.email}) creado y vinculado.`)
    }
  }
}

run()
