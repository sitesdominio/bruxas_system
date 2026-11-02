import { Link, useNavigate } from "@tanstack/react-router";
import { Instagram, Search, ShoppingCart, UserRound, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { STORE, waLink } from "@/lib/config";
import logo from "@/assets/logo.png";

export function SiteHeader({ search, onSearch }: { search?: string; onSearch?: (v: string) => void }) {
  const { user, openLogin, isAdmin } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link to="/" aria-label="Início"><img src={logo} alt="Olho da Bruxa" width={56} height={56} className="h-14 w-14" /></Link>
        <label className="relative hidden flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/60" />
          <input
            value={search ?? ""}
            onChange={(e) => { onSearch ? onSearch(e.target.value) : navigate({ to: "/" }); }}
            placeholder="Buscar banhos..."
            className="h-9 w-full rounded-full border-2 border-accent bg-input pl-9 pr-4 text-sm outline-none"
          />
        </label>
        <Link to="/servicos" className="rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:brightness-105">Serviços</Link>
        <nav className="ml-auto flex items-center gap-3">
          <a href={waLink()} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="hover:text-whatsapp"><MessageCircle className="h-6 w-6" /></a>
          <a href={STORE.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-primary"><Instagram className="h-6 w-6" /></a>
          <button aria-label="Carrinho" className="relative hover:text-primary" onClick={() => (user ? navigate({ to: "/carrinho" }) : openLogin())}>
            <ShoppingCart className="h-6 w-6" />
            {count > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-gold px-1.5 text-xs font-bold text-primary-foreground">{count}</span>}
          </button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Meu perfil" className="rounded-full border-2 border-foreground p-1 hover:text-primary"><UserRound className="h-7 w-7" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-primary/40 bg-card text-card-foreground">
                <DropdownMenuLabel className="font-display text-xl">Meu Perfil</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>Meus dados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/minhas-compras" })}>Minhas compras</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/meus-agendamentos" })}>Meus agendamentos</DropdownMenuItem>
                <DropdownMenuItem asChild><a href={waLink()} target="_blank" rel="noreferrer">Entre em contato</a></DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>Painel ADM</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button aria-label="Entrar" onClick={openLogin} className="rounded-full border-2 border-foreground p-1 hover:text-primary"><UserRound className="h-7 w-7" /></button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 glass">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Olho da Bruxa</span>
        <div className="flex gap-4">
          <Link to="/privacidade" className="hover:underline">Privacidade e termos</Link>
          <a href={waLink()} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFloat() {
  return (
    <a
      href={waLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-success-foreground shadow-glow transition-transform hover:scale-110"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 fill-current" aria-hidden><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.5.7 4.8 1.9 6.8L3 29l6.8-2.1c1.9 1 4 1.6 6.2 1.6 7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-2 0-3.9-.6-5.5-1.6l-.4-.2-4 1.2 1.3-3.9-.3-.4a10.4 10.4 0 1 1 8.9 4.9zm5.7-7.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.5 8.5 0 0 1-4.2-3.7c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.8 1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 2.1.9 3 1 4 .8.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5l-.6-.4z"/></svg>
    </a>
  );
}
