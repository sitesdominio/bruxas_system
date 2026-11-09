import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-redirect'
import { getSupabaseEnv } from '@/lib/supabase/env'

const EMAIL_OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

type PendingCookie = { name: string; value: string; options: CookieOptions }

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e recuperação de senha).
 *
 * Aceita dois formatos:
 *  - `?code=...`                    (fluxo PKCE; exige o mesmo navegador que pediu o e-mail)
 *  - `?token_hash=...&type=...`     (não depende do navegador; requer o modelo de e-mail correspondente)
 *
 * A sessão é gravada nos cookies da resposta de redirecionamento. O parâmetro
 * `next` só é aceito se for um caminho relativo ao próprio site.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const typeParam = searchParams.get('type')
  const type = EMAIL_OTP_TYPES.find((value) => value === typeParam)
  const next = safeNextPath(searchParams.get('next'), type === 'recovery' ? '/redefinir-senha' : '/')

  const failure = () => NextResponse.redirect(new URL('/?auth_error=link_invalido', origin))

  // O Supabase devolve ?error=... quando o link expirou ou já foi usado.
  if (searchParams.get('error') || searchParams.get('error_code')) return failure()
  if (!code && !(tokenHash && type)) return failure()

  const { url, key } = getSupabaseEnv()
  const pendingCookies: PendingCookie[] = []
  let pendingHeaders: Record<string, string> = {}

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet)
        pendingHeaders = { ...pendingHeaders, ...headers }
      },
    },
  })

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash as string })

  if (error) return failure()

  const response = NextResponse.redirect(new URL(next, origin))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  Object.entries(pendingHeaders).forEach(([header, value]) => response.headers.set(header, value))
  return response
}
