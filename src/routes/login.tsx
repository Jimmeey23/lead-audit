import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { ADMIN_EMAIL } from "@/lib/lead-responses";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Outreach Audit" },
      {
        name: "description",
        content:
          "Sign in with your Physique 57 Google account to review your studio's outreach ledger.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed-in") {
      navigate({ to: "/" });
    }
  }, [auth.status, navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message || "Sign-in could not be completed.");
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[480px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 sm:px-10">
        <div className="grid w-full gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
              <Sparkles className="size-3 text-primary" /> Physique 57 · Outreach ledger
            </div>
            <h1 className="mt-6 text-5xl leading-[1.05] text-foreground sm:text-6xl">
              Outreach Verification<em className="not-italic text-primary"> Portal </em>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              A centralized platform for reviewing and validating outreach activity across studios.
              Lead entries are scoped to approved studio email groups, while admin access can review
              every location.
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Track interactions, review supporting documentation, maintain accurate timelines, and
              ensure every outreach touchpoint is properly recorded. The portal provides a clear and
              transparent view of engagement history, helping teams maintain consistency,
              accountability, and data accuracy across all communications.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 text-primary" /> Visibility follows approved
                studio email groups and admin access.
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 text-primary" /> Supporting documents are
                required before a touchpoint can be edited.
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 text-primary" /> Timelines are reconstructed
                from the moments you confirm.
              </li>
            </ul>
          </div>

          <div className="glass flex flex-col justify-center rounded-3xl border border-border/70 p-8 shadow-xl shadow-slate-200/70 sm:p-10">
            <h2 className="text-2xl text-foreground">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your Physique 57 Google account to continue.
            </p>

            <Button
              type="button"
              onClick={signIn}
              disabled={busy || auth.status === "loading"}
              className="mt-7 h-12 w-full justify-center gap-3 bg-background text-foreground hover:bg-secondary"
            >
              <GoogleMark />
              <span className="font-medium">
                {busy ? "Opening Google…" : "Continue with Google"}
              </span>
              <ArrowRight className="ml-auto size-4 opacity-60" />
            </Button>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-8 space-y-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 7.1 29.4 5 24 5 16 5 9 9.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.3 5.2C41.3 35.8 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
