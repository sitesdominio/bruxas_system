# Olho da Bruxa — Registro de alterações de funcionalidades

Resumo curto das mudanças que afetam o que o sistema faz. Mais recentes primeiro.
Legenda: ✅ funciona e foi testado · ⚠️ depende de configuração/migration · 🧪 demonstrativo.

## 2026-11-10 — Controle de produtos
- ✅ **Gestão de produtos** em `/gestao`: adicionar, editar, excluir, ver valor, estoque e vendas.
- ✅ **Botão "No site"** liga/desliga a exibição. Só liga se estoque > 0 (regra na tela **e** no banco).
- ✅ **Esgotou, sai do site**: ao vender o último item o produto é despublicado automaticamente.
- ✅ **Registrar venda** (−1 estoque, +1 venda) de forma atômica; não deixa vender acima do estoque.
- ✅ **Vitrine** (`/` e `/banhos`) lê só produtos publicados e com estoque. Sem estoque/vendas expostos ao público.
- ✅ Migration `20261110000000_products_inventory.sql` **aplicada** no Supabase `supabase-gray-dog` e validada no banco real (8/8 verificações em transação revertida: regras de estoque, venda, RLS de equipe/cliente/anônimo). Se o banco não responder, a vitrine cai nos 3 produtos de demonstração 🧪.
- ⚠️ Aviso do Advisor do Supabase (ERROR `security_definer_view`) em `products_public`: é intencional, a view filtra linhas/colunas para o público sem expor estoque e vendas.
- ⚠️ Gestão exige conta com papel em `user_roles` (a primeira conta de equipe é criada manualmente no Supabase).
- Limites atuais: "vendas" são registradas manualmente (o checkout/Mercado Pago ainda não existe); o carrinho não confere estoque; os demais cards de `/gestao` (agenda, pedidos, receita) continuam 🧪 demonstrativos.
- Testes: banco 20/20 (PGlite) + 8/8 no Supabase real, validação 6/6, tela com Supabase simulado 17/17. Falta testar a tela logada no Supabase real (nenhuma conta de equipe ainda).

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
