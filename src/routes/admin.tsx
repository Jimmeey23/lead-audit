import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  ADMIN_EMAIL,
  isCurrentUserAdmin,
  loadAdminResponses,
  resetLeadResponse,
  type AdminResponse,
  type PersistedAttachment,
} from "@/lib/lead-responses";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Outreach Audit" },
      {
        name: "description",
        content:
          "Admin-only dashboard for saved outreach audit responses and supporting documents.",
      },
    ],
  }),
  component: AdminDashboard,
});

function fmtDate(value: string | null) {
  if (!value) return "No date";
  const d = new Date(value);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocumentPreview({ file }: { file: PersistedAttachment }) {
  const url = file.url;
  const name = file.name;
  const type = file.type || "";

  if (!url) {
    return (
      <div className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
        <FileText className="mb-2 size-4" />
        {name}
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-border/70 bg-white shadow-sm">
      {type.startsWith("image/") ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={name} className="h-56 w-full object-contain bg-slate-50" />
        </a>
      ) : type.startsWith("video/") ? (
        <video src={url} controls className="h-56 w-full bg-black" />
      ) : type.startsWith("audio/") ? (
        <div className="bg-slate-50 p-3">
          <audio src={url} controls className="w-full" />
        </div>
      ) : type === "application/pdf" ? (
        <iframe title={name} src={url} className="h-72 w-full bg-slate-50" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-32 flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:text-primary"
        >
          <FileText className="size-6" />
          Open document
        </a>
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{name}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
        >
          <Download className="size-3.5" />
          Open
        </a>
      </figcaption>
    </figure>
  );
}

function AdminDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<"checking" | "yes" | "no">("checking");
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [center, setCenter] = useState("All");

  const email = auth.user?.email ?? null;

  useEffect(() => {
    if (auth.status === "signed-out") navigate({ to: "/login" });
  }, [auth.status, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (auth.status !== "signed-in") return;

    setAdmin("checking");
    isCurrentUserAdmin(email).then((allowed) => {
      if (!cancelled) setAdmin(allowed ? "yes" : "no");
    });

    return () => {
      cancelled = true;
    };
  }, [auth.status, email]);

  useEffect(() => {
    let cancelled = false;
    if (admin !== "yes") return;

    setLoading(true);
    setError(null);
    loadAdminResponses()
      .then((data) => {
        if (!cancelled) setResponses(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Admin responses could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [admin]);

  const resetResponse = async (responseId: string) => {
    setResettingId(responseId);
    setError(null);
    try {
      await resetLeadResponse(responseId);
      setResponses((current) => current.filter((response) => response.id !== responseId));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Response could not be reset.");
    } finally {
      setResettingId(null);
    }
  };

  const centers = useMemo(
    () => ["All", ...Array.from(new Set(responses.map((response) => response.center)))],
    [responses],
  );
  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return responses.filter((response) => {
      if (center !== "All" && response.center !== center) return false;
      if (!needle) return true;
      return (
        response.lead_name.toLowerCase().includes(needle) ||
        response.lead_id.toLowerCase().includes(needle) ||
        response.submitted_by_email.toLowerCase().includes(needle) ||
        response.center.toLowerCase().includes(needle) ||
        (response.associate ?? "").toLowerCase().includes(needle)
      );
    });
  }, [center, q, responses]);

  if (auth.status === "loading" || auth.status === "signed-out" || admin === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (admin === "no") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-md rounded-2xl border border-border/70 p-8 text-center">
          <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}. This dashboard is limited to {ADMIN_EMAIL}.
          </p>
          <Button asChild className="mt-5">
            <Link to="/">Back to audit ledger</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border/70 bg-gradient-to-b from-white via-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/">
                <ArrowLeft className="size-4" /> Audit ledger
              </Link>
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => auth.signOut()}
                className="h-8 gap-1.5 text-xs"
              >
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
                <ShieldCheck className="size-3 text-primary" /> Admin-only response dashboard
              </div>
              <h1 className="mt-4 text-4xl leading-tight text-foreground sm:text-5xl">
                Central supporting document and response review
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Review saved outreach validations, touchpoint notes, and uploaded supporting
                documents across all centers.
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="text-3xl text-foreground">{responses.length}</div>
              Saved responses
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search by lead, submitter, center…"
                className="bg-white/90 pl-9 shadow-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {centers.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCenter(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    center === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white/75 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-7xl space-y-5 px-6 sm:px-10">
        {loading && (
          <div className="rounded-2xl border border-border/70 p-8 text-sm text-muted-foreground">
            Loading responses…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-sm text-muted-foreground">
            No responses match the current filters.
          </div>
        )}

        {filtered.map((response) => (
          <section
            key={response.id}
            className="glass rounded-2xl border border-border/70 p-5 shadow-lg shadow-slate-200/70"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl text-foreground">{response.lead_name}</h2>
                  <Badge variant="secondary">{response.center}</Badge>
                  <Badge
                    className={
                      response.status === "draft"
                        ? "border border-amber-200 bg-amber-50 text-amber-700"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    }
                  >
                    {response.status}
                  </Badge>
                  {response.stage_name && (
                    <Badge className="border border-primary/30 bg-primary/10 text-primary">
                      {response.stage_name}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Lead ID: {response.lead_id}</span>
                  <span>Submitted by: {response.submitted_by_email}</span>
                  <span>Updated: {fmtDate(response.updated_at)}</span>
                  {response.associate && <span>Associate: {response.associate}</span>}
                </div>
                {response.response_notes && (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {response.response_notes}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="text-lg text-foreground">{response.touchpoints.length}</div>
                Touchpoints
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resettingId === response.id}
                  onClick={() => resetResponse(response.id)}
                  className="mt-3 h-8 gap-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  {resettingId === response.id ? "Resetting..." : "Reset row"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {response.touchpoints.map((touchpoint) => (
                <div
                  key={touchpoint.id}
                  className="rounded-xl border border-border/70 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{touchpoint.label}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fmtDate(touchpoint.occurred_at)}
                        {touchpoint.medium ? ` · ${touchpoint.medium}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {touchpoint.touchpoint_key.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {touchpoint.comment && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {touchpoint.comment}
                    </p>
                  )}
                  {touchpoint.evidence_unavailable && (
                    <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Supporting documents unavailable
                      {touchpoint.evidence_unavailable_reason
                        ? `: ${touchpoint.evidence_unavailable_reason}`
                        : ""}
                    </div>
                  )}
                  {touchpoint.files.length > 0 && (
                    <div className="mt-3 grid gap-3">
                      {touchpoint.files.map((file) => (
                        <DocumentPreview key={file.storagePath ?? file.name} file={file} />
                      ))}
                    </div>
                  )}
                  {touchpoint.files.length === 0 && !touchpoint.evidence_unavailable && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="size-3.5" /> No supporting documents
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
