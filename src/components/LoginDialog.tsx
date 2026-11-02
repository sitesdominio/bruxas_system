import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "signup" | "code" | "forgot";

export function LoginDialog() {
  const { loginOpen, closeLogin } = useAuth();
  return (
    <Dialog open={loginOpen} onOpenChange={(o) => !o && closeLogin()}>
      <DialogContent className="border-primary/40 bg-card text-card-foreground sm:max-w-sm">
        <DialogTitle className="sr-only">Login</DialogTitle>
        <AuthForm />
      </DialogContent>
    </Dialog>
  );
}

export function AuthForm({ title, allowSignup = true }: { title?: string; allowSignup?: boolean }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vinda(o)!");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { name, phone } } });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu email.");
        setMode("login");
      } else if (mode === "code") {
        if (!codeSent) {
          const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
          if (error) throw error;
          setCodeSent(true);
          toast.success("Código enviado para seu email.");
        } else {
          const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Enviamos um link para redefinir a senha.");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const heading = title ?? { login: "Login", signup: "Criar conta", code: "Entrar com código", forgot: "Recuperar senha" }[mode];

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogTitleSafe>{heading}</DialogTitleSafe>
      {mode === "signup" && (
        <>
          <Field label="Nome"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 9...." /></Field>
        </>
      )}
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      {(mode === "login" || mode === "signup") && (
        <Field label="Senha"><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      )}
      {mode === "code" && codeSent && (
        <Field label="Código recebido"><Input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      )}
      <div className="flex flex-col items-center gap-1 pt-1 text-sm">
        {mode !== "login" && <button type="button" className="hover:underline" onClick={() => setMode("login")}>Já tenho conta</button>}
        {mode === "login" && allowSignup && <button type="button" className="hover:underline" onClick={() => setMode("signup")}>Quero criar uma conta!</button>}
        {mode === "login" && <button type="button" className="text-xs hover:underline" onClick={() => { setMode("code"); setCodeSent(false); }}>Entrar com código por email</button>}
        {mode === "login" && <button type="button" className="text-xs hover:underline" onClick={() => setMode("forgot")}>Esqueci minha senha!</button>}
      </div>
      <div className="flex justify-center">
        <Button type="submit" variant="success" disabled={busy} className="px-8">
          {mode === "signup" ? "CRIAR CONTA" : mode === "forgot" ? "ENVIAR LINK" : mode === "code" && !codeSent ? "ENVIAR CÓDIGO" : "ENTRAR"}
        </Button>
      </div>
    </form>
  );
}

function DialogTitleSafe({ children }: { children: React.ReactNode }) {
  return <h2 className="text-center font-display text-3xl font-bold">{children}</h2>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><Label className="font-semibold">{label}</Label>{children}</div>
);
