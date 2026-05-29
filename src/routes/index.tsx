import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LEADS } from "@/data/leads";
import { LeadCard } from "@/components/LeadCard";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";

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
  const [q, setQ] = useState("");
  const [center, setCenter] = useState<string>("All");

  const centers = useMemo(() => ["All", ...Array.from(new Set(LEADS.map((l) => l.center)))], []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return LEADS.filter((l) => {
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
  }, [q, center]);

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:px-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="size-3 text-primary" /> Outreach audit ledger
          </div>
          <h1 className="mt-5 text-5xl leading-[1.05] text-foreground sm:text-6xl">
            Validate every <em className="not-italic text-primary">follow-up</em>,
            <br className="hidden sm:block" /> with the receipts to prove it.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            Each lead below is a self-contained worksheet. Confirm or correct the four follow-up dates,
            rewrite the comments where needed, attach a screenshot / call recording / video as evidence,
            and watch a timeline assemble from creation through the last touchpoint.
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
              {filtered.length} of {LEADS.length} leads
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl space-y-8 px-6 sm:px-10">
        {filtered.map((lead, i) => (
          <LeadCard key={lead.id} lead={lead} index={i} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-16 text-center text-muted-foreground">
            No leads match your filters.
          </div>
        )}
      </main>
    </div>
  );
}
