import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "./SiteHeader";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Page({ title, children, requireAuth }: { title: string; children: ReactNode; requireAuth?: boolean }) {
  const { user, loading, openLogin } = useAuth();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-6 text-4xl font-bold">{title}</h1>
        {requireAuth && !loading && !user ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="mb-4">Entre na sua conta para continuar.</p>
            <Button onClick={openLogin}>Entrar</Button>
          </div>
        ) : requireAuth && loading ? <p className="text-muted-foreground">Carregando...</p> : children}
      </main>
      <SiteFooter />
    </>
  );
}

export const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`glass rounded-xl p-5 ${className}`}>{children}</div>
);
