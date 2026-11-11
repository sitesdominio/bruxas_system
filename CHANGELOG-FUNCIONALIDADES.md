# Olho da Bruxa — Registro de alterações de funcionalidades

Resumo curto das mudanças que afetam o que o sistema faz. Mais recentes primeiro.
Legenda: ✅ funciona e foi testado · ⚠️ depende de configuração/migration · 🧪 demonstrativo.

## 2026-11-10 — Controle de produtos
- ✅ **Gestão de produtos** em `/gestao`: adicionar, editar, excluir, ver valor, estoque e vendas.
- ✅ **Botão "No site"** liga/desliga a exibição. Só liga se estoque > 0 (regra na tela **e** no banco).
- ✅ **Esgotou, sai do site**: ao vender o último item o produto é despublicado automaticamente.
- ✅ **Registrar venda** (−1 estoque, +1 venda) de forma atômica; não deixa vender acima do estoque.
- ✅ **Vitrine** (`/` e `/banhos`) lê só produtos publicados e com estoque. Sem estoque/vendas expostos ao público.
- ⚠️ Requer aplicar `supabase/migrations/20261110000000_products_inventory.sql` (não aplicada). Até lá, a vitrine mostra os 3 produtos de demonstração 🧪 e a gestão avisa que a tabela não existe.
- ⚠️ Gestão exige conta com papel em `user_roles` (a primeira conta de equipe é criada manualmente no Supabase).
- Limites atuais: "vendas" são registradas manualmente (o checkout/Mercado Pago ainda não existe); o carrinho não confere estoque; os demais cards de `/gestao` (agenda, pedidos, receita) continuam 🧪 demonstrativos.
- Testes: banco 20/20 (PGlite), validação 6/6, tela com Supabase simulado 17/17. Falta validar no Supabase real.

## 2026-11-10 — Site e carrinho
- ✅ Busca de produtos no header; página `/banhos` só com produtos; produtos já na primeira tela.
- ✅ Carrinho redesenhado (painel acima do header). ⚠️ "Finalizar compra" só abre o login (🧪 sem pagamento).
- Cruz do hero com efeito 3D ligado à rolagem.

## 2026-11-09 — Fundação de usuários e segurança
- ✅ Sessão persistente (`proxy.ts` + cookies) e callback de login seguro (valida `next`).
- ⚠️ Migration `20261109…`: papéis em `user_roles`, RLS e grants de `profiles`/`reservations`. Não aplicada.
- ⚠️ Cadastro/login na tela: ainda sem a correção de feedback e validação; precisa das variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente.

## 2026-11-07 — Base V0/Next.js
- Base oficial do projeto passou a ser a versão V0 (Next.js 16 + Supabase), branch `v0/reservas-supabase`.
