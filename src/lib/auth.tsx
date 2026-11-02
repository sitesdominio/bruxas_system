import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  user: User | null; isAdmin: boolean; loading: boolean;
  loginOpen: boolean; openLogin: () => void; closeLogin: () => void; refreshRole: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const checkRole = async (u: User | null) => {
    if (!u) return setIsAdmin(false);
    const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
    setIsAdmin(!!data);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      const u = session?.user ?? null;
      setUser(u);
      setTimeout(() => checkRole(u), 0);
      if (u) setLoginOpen(false);
    });
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      await checkRole(data.user);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, isAdmin, loading, loginOpen, openLogin: () => setLoginOpen(true), closeLogin: () => setLoginOpen(false), refreshRole: () => checkRole(user) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
};
