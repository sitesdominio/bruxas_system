/**
 * Valida o parâmetro `next` dos links de autenticação.
 *
 * Só aceita caminhos relativos ao próprio site (ex.: "/redefinir-senha").
 * Qualquer outra coisa (URL absoluta, "//dominio", barra invertida, caracteres
 * de controle) cai no `fallback`, impedindo redirecionamento para sites externos.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  // Navegadores tratam "\" como "/"; caracteres de controle permitem burlar filtros.
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return fallback

  try {
    const base = 'http://localhost'
    const url = new URL(next, base)
    if (url.origin !== base) return fallback
    const normalized = url.pathname + url.search + url.hash
    // A normalização de "../" pode produzir "//dominio" (ex.: "/a/../..//evil.com"),
    // que o navegador interpreta como URL externa. Revalida o resultado final.
    if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback
    return normalized
  } catch {
    return fallback
  }
}
