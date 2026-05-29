import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LEADS, visibilityFor } from "@/data/leads";
import { LeadCard } from "@/components/LeadCard";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Outreach Audit — Lead Follow-up Validator" },
      { name: "description", content: "Validate, correct and timeline every outreach with evidence attachments." },
      { property: "og:title", content: "Outreach Audit — Lead Follow-up Validator" },
      { property: "og:description", content: "Validate, correct and timeline every outreach with evidence attachments." },
    ],
  }),
  component: Index,
});

function Index() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "signed-out") navigate({ to: "/login" });
  }, [auth.status, navigate]);

  const [q, setQ] = useState("");
  const [center, setCenter] = useState<string>("All");

  const email = auth.user?.email ?? null;
  const visibility = useMemo(() => visibilityFor(email), [email]);

  const visibleLeads = useMemo(() => {
    if (!visibility) return [];
    if (visibility.centers === "all") return LEADS;
    return LEADS.filter((l) => (visibility.centers as string[]).includes(l.center));
  }, [visibility]);

  const centers = useMemo(() => ["All", ...Array.from(new Set(visibleLeads.map((l) => l.center)))], [visibleLeads]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return visibleLeads.filter((l) => {
      if (center !== "All" && l.center !== center) return false;
      if (!needle) return true;
      return (
        l.fullName.toLowerCase().includes(needle) ||
        l.phone.includes(needle) ||
        l.email.toLowerCase().includes(needle) ||
        l.associate.toLowerCase().includes(needle) ||
        l.stageName.toLowerCase().includes(needle)
      );
    });
  }, [q, center, visibleLeads]);

  if (auth.status === "loading" || auth.status === "signed-out") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!visibility) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-md rounded-2xl border border-border/70 p-8 text-center">
          <h2 className="text-xl text-foreground">This account isn't recognised</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}. Access is limited to Physique 57 studio emails.
          </p>
          <Button onClick={() => auth.signOut()} className="mt-5">Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="size-3 text-primary" /> Outreach audit ledger
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{email}</span>
              <Button variant="ghost" size="sm" onClick={() => auth.signOut()} className="h-8 gap-1.5 text-xs">
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </div>
          </div>
          <h1 className="mt-5 text-5xl leading-[1.05] text-foreground sm:text-6xl">
            A quiet ledger for every <em className="not-italic text-primary">touchpoint</em>,
            <br className="hidden sm:block" /> backed by the receipts that confirm it.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            Each lead is a self-contained worksheet. Attach a screenshot, recording, or note to unlock the
            date and comment for that touchpoint, and the timeline assembles itself from the moments you confirm.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, associate, stage…"
                className="bg-card/60 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {centers.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCenter(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    center === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} of {visibleLeads.length} leads
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl space-y-8 px-6 sm:px-10">
        {filtered.map((lead, i) => (
          <LeadCard key={lead.id} lead={lead} index={i} canSeeOriginal={visibility.canSeeOriginalData} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-16 text-center text-muted-foreground">
            Nothing to show with the current filters.
          </div>
        )}
      </main>
    </div>
  );
}
