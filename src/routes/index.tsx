import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/config";
import banho from "@/assets/banho.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Olho da Bruxa — Banhos de ervas" },
      { name: "description", content: "Banhos de ervas preparados com intenção. Compre online ou agende um serviço." },
      { property: "og:title", content: "Olho da Bruxa — Banhos de ervas" },
      { property: "og:description", content: "Banhos de ervas preparados com intenção. Compre online ou agende um serviço." },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Product | null>(null);
  const { user, openLogin } = useAuth();
  const { add } = useCart();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: api.listProducts });
  const list = products.filter((p) => p.active && p.name.toLowerCase().includes(q.toLowerCase()));

  const open = (p: Product) => (user ? setSel(p) : openLogin());

  return (
    <>
      <SiteHeader search={q} onSearch={setQ} />
      <main className="mx-auto max-w-6xl px-4">
        <section className="py-24 text-center">
          <p className="mx-auto max-w-3xl font-display text-3xl leading-snug sm:text-5xl">
            O que está embaixo é como o que está em cima, e o que está em cima é como o que está embaixo.
          </p>
        </section>
        <h2 className="mb-6 text-4xl font-bold">Banhos</h2>
        {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {list.map((p) => (
              <button key={p.id} onClick={() => open(p)} className="group overflow-hidden rounded-xl bg-card p-2 text-left text-card-foreground transition hover:-translate-y-1 hover:shadow-glow">
                <div className="relative overflow-hidden rounded-lg bg-input">
                  <img src={p.image_url || banho} alt={p.name} loading="lazy" className="aspect-[4/3] w-full object-contain" />
                  {p.stock <= 0 && <span className="absolute inset-0 flex items-center justify-center bg-background/70 font-bold">Indisponível</span>}
                </div>
                <div className="px-1 pb-1 pt-2">
                  <p className="font-bold">{p.name}</p>
                  <p className="line-clamp-2 text-xs opacity-90">{p.description}</p>
                  <p className="mt-1 font-bold text-gold">{brl(p.price)}</p>
                </div>
              </button>
            ))}
            {!list.length && <p className="text-muted-foreground">Nenhum banho encontrado.</p>}
          </div>
        )}
      </main>
      <SiteFooter />

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="border-primary/40 bg-card text-card-foreground sm:max-w-sm">
          {sel && (
            <div className="space-y-3">
              <img src={sel.image_url || banho} alt={sel.name} className="aspect-[4/3] w-full rounded-lg bg-input object-contain" />
              <div className="flex justify-between gap-3">
                <DialogTitle className="font-bold">{sel.name}</DialogTitle>
                <span className="font-bold text-gold">{brl(sel.price)}</span>
              </div>
              <p className="text-sm">{sel.description}</p>
              {sel.validity && <p className="text-sm"><b>Validade:</b> {sel.validity}</p>}
              <p className="text-xs opacity-80">{sel.stock > 0 ? `${sel.stock} em estoque` : "Sem estoque no momento"}</p>
              <Button className="w-full" disabled={sel.stock <= 0} onClick={() => { add(sel); toast.success("Adicionado ao carrinho"); setSel(null); }}>
                {sel.stock > 0 ? "Add ao carrinho" : "Indisponível"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
