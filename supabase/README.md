# Supabase — migrations e guia de configuração

> Nenhuma migration deste diretório é aplicada automaticamente. Aplique sempre
> primeiro em um projeto de **desenvolvimento** e só depois no definitivo.

## Migrations

| Arquivo | O que faz |
|---|---|
| `20261107000000_baseline_v0_schema.sql` | Documenta o schema criado pelo V0 (`profiles`, `services`, `reservations`, trigger). Idempotente. **Sem** políticas, grants ou dados de exemplo. |
| `20261109000000_auth_foundation_security.sql` | Cria `user_roles`, `is_staff()`/`is_admin()`, substitui TODAS as políticas e grants de `profiles`, `services` e `reservations`, reforça o trigger de perfil, cria perfis faltantes e limites de tamanho. Não apaga tabelas, colunas nem dados. |

**Ordem de aplicação**

- Projeto `hyxz…` (já tem o schema do V0): basta a migration `20261109…`. A baseline é inofensiva se também for executada.
- Projeto novo (Preview/Desenvolvimento): baseline e depois `20261109…`.

## Antes de aplicar (consultas somente leitura, no SQL Editor)

```sql
-- 1) Quem tem papel elevado hoje? Revise: se alguém não deveria ter, o papel foi autoconcedido (falha P1).
select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id where p.role <> 'customer';

-- 2) Contas sem perfil (a migration cria os perfis que faltam).
select count(*) from auth.users u left join public.profiles p on p.id = u.id where p.id is null;

-- 3) Há reservas com status alterado indevidamente?
select status, count(*) from public.reservations group by status;
```

A migration **não** copia `profiles.role` para `user_roles` de propósito: se a falha
P1 tiver sido explorada, a cópia automática legitimaria um papel indevido. A
partir da migration, `profiles.role` deixa de conceder qualquer acesso.

## Conceder o primeiro administrador (manual, no SQL Editor)

```sql
-- Troque pelo UUID da conta (Authentication > Users). Papéis: 'staff' ou 'admin'.
insert into public.user_roles (user_id, role) values ('<UUID-DA-CONTA>', 'admin');
```

## Configuração manual no painel do Supabase (Authentication)

1. **URL Configuration → Site URL**: a URL de produção definitiva.
2. **Redirect URLs**: `https://<dominio-final>/**`, `http://localhost:3000/**` e o curinga dos previews da Vercel, no formato `https://*-<slug-da-conta-vercel>.vercel.app/**`.
3. **Providers → Email**: manter a confirmação de e-mail ligada; definir tamanho mínimo de senha.
4. **SMTP**: configurar um provedor próprio antes de enviar e-mails a clientes reais (o SMTP padrão tem limite baixo).
5. **Email Templates** (opcional, recomendado): usar o formato `token_hash`, que não depende de abrir o e-mail no mesmo navegador:
   - Confirmação: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
   - Recuperação: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`
6. Confirmar, em **Table Editor / Database → Tables**, que `profiles`, `services`, `reservations` e `user_roles` estão com RLS ativo.

## Variáveis de ambiente (nomes; os valores ficam só no painel da Vercel / `.env.local`)

| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Um projeto Supabase por ambiente (Preview/Dev separados do definitivo) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development | Chave publicável; pode ir ao navegador |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | **Somente Development** | Não definir em Preview/Production |
| `SUPABASE_SERVICE_ROLE_KEY` | **Não usar nesta etapa** | Nunca com prefixo `NEXT_PUBLIC_`; só em código de servidor, se um dia for necessário |

## Testes de RLS (local, sem conectar ao Supabase)

`node supabase/tests/rls-pglite.mjs` executa as migrations em um Postgres local
(PGlite) com os papéis do Supabase emulados e verifica o isolamento entre
usuários. Requer `pnpm add -D @electric-sql/pglite` (não incluído no
`package.json`). É uma emulação: repita a validação em um projeto Supabase real.
