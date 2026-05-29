import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  status: "loading" | "signed-in" | "signed-out";
  user: User | null;
  session: Session | null;
};

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, session: null });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        status: session ? "signed-in" : "signed-out",
        user: session?.user ?? null,
        session,
      });
    });

    supabase.auth.getSession().then(({ data }) => {
      setState({
        status: data.session ? "signed-in" : "signed-out",
        user: data.session?.user ?? null,
        session: data.session,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    ...state,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}