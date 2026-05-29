import { useMemo, useState } from "react";
import { Lead } from "@/data/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Phone, Mail, MapPin, User, CalendarDays, Check, X, Image as ImageIcon, FileAudio, FileVideo, FileText } from "lucide-react";

type Attachment = { name: string; type: string; url: string };

type FieldState = {
  date: string;
  comment: string;
  attachments: Attachment[];
};

type State = {
  firstOutreachDate: string;
  firstOutreachMedium: string;
  firstOutreachAttachments: Attachment[];
  followUps: FieldState[];
};

const MEDIUMS = ["WhatsApp", "Phone Call", "Email", "SMS", "Instagram DM", "In-person"];

function fileToAttachment(f: File): Attachment {
  return { name: f.name, type: f.type || "application/octet-stream", url: URL.createObjectURL(f) };
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  const Icon = a.type.startsWith("image/") ? ImageIcon : a.type.startsWith("audio/") ? FileAudio : a.type.startsWith("video/") ? FileVideo : FileText;
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground/90 hover:border-primary/60 transition">
      <Icon className="size-3.5 text-primary" />
      <span className="max-w-[140px] truncate">{a.name}</span>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onRemove(); }}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        aria-label="Remove attachment"
      >
        <X className="size-3" />
      </button>
    </a>
  );
}

function FileButton({ onFiles }: { onFiles: (files: FileList) => void }) {
  const id = useMemo(() => `f-${Math.random().toString(36).slice(2)}`, []);
  return (
    <>
      <input
        id={id}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,application/pdf"
        className="sr-only"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <Paperclip className="size-3.5" />
        Attach evidence
      </label>
    </>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function stageTone(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("trial completed")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (s.includes("not interested") || s.includes("lost")) return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (s.includes("unresponsive") || s.includes("did not answer")) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-sky-500/15 text-sky-300 border-sky-500/30";
}

export function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const [state, setState] = useState<State>({
    firstOutreachDate: lead.createdAt,
    firstOutreachMedium: "WhatsApp",
    firstOutreachAttachments: [],
    followUps: lead.followUps.map((f) => ({ date: f.date, comment: f.comment, attachments: [] })),
  });
  const [saved, setSaved] = useState(false);

  const updateFU = (i: number, patch: Partial<FieldState>) => {
    setState((s) => ({ ...s, followUps: s.followUps.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  };

  const timeline = useMemo(() => {
    const items: { label: string; date: string; comment?: string; attachments: Attachment[]; tone: string }[] = [
      { label: "Lead created", date: lead.createdAt, comment: lead.remarks, attachments: [], tone: "primary" },
    ];
    if (state.firstOutreachDate) {
      items.push({
        label: `First outreach · ${state.firstOutreachMedium}`,
        date: state.firstOutreachDate,
        attachments: state.firstOutreachAttachments,
        tone: "accent",
      });
    }
    state.followUps.forEach((f, i) => {
      if (f.date || f.comment) {
        items.push({ label: `Follow-up ${i + 1}`, date: f.date, comment: f.comment, attachments: f.attachments, tone: "muted" });
      }
    });
    return items
      .filter((x) => x.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [state, lead.createdAt, lead.remarks]);

  return (
    <section className="glass relative overflow-hidden rounded-3xl border border-border/70 shadow-2xl shadow-black/40">
      {/* Hidden fields containing source follow-up details */}
      {lead.followUps.map((f, i) => (
        <span key={`hidden-${i}`}>
          <input type="hidden" name={`lead-${lead.id}-followup-${i + 1}-date`} value={f.date} />
          <input type="hidden" name={`lead-${lead.id}-followup-${i + 1}-comment`} value={f.comment} />
        </span>
      ))}
      <input type="hidden" name={`lead-${lead.id}-id`} value={lead.id} />
      <input type="hidden" name={`lead-${lead.id}-source-id`} value={lead.sourceId} />
      <input type="hidden" name={`lead-${lead.id}-host-id`} value={lead.hostId} />
      <input type="hidden" name={`lead-${lead.id}-member-id`} value={lead.memberId} />

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-br from-primary/5 to-transparent px-6 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary ring-1 ring-primary/30">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl text-foreground">{lead.fullName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Phone className="size-3" /> {lead.phone}</span>
              {lead.email !== "-" && <span className="inline-flex items-center gap-1.5"><Mail className="size-3" /> {lead.email}</span>}
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3" /> {lead.center}</span>
              <span className="inline-flex items-center gap-1.5"><User className="size-3" /> {lead.associate}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3" /> Created {fmtDate(lead.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={`border ${stageTone(lead.stageName)} font-medium`}>{lead.stageName}</Badge>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{lead.sourceName} · {lead.classType}</span>
        </div>
      </header>

      <div className="grid gap-8 px-6 py-7 sm:px-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Form */}
        <div className="space-y-6">
          {/* First outreach */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg text-foreground">First outreach</h3>
              <span className="text-[10px] uppercase tracking-widest text-primary">Origin event</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date sent</Label>
                <Input
                  type="date"
                  value={state.firstOutreachDate}
                  onChange={(e) => setState((s) => ({ ...s, firstOutreachDate: e.target.value }))}
                  className="bg-background/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Medium</Label>
                <Select value={state.firstOutreachMedium} onValueChange={(v) => setState((s) => ({ ...s, firstOutreachMedium: v }))}>
                  <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FileButton onFiles={(files) => setState((s) => ({
                ...s,
                firstOutreachAttachments: [...s.firstOutreachAttachments, ...Array.from(files).map(fileToAttachment)],
              }))} />
              {state.firstOutreachAttachments.map((a, i) => (
                <AttachmentChip
                  key={i}
                  a={a}
                  onRemove={() => setState((s) => ({ ...s, firstOutreachAttachments: s.firstOutreachAttachments.filter((_, j) => j !== i) }))}
                />
              ))}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="grid gap-4 sm:grid-cols-2">
            {state.followUps.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-background/40 p-4 transition hover:border-primary/40">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold tracking-wide text-foreground">Follow-up {i + 1}</h4>
                  {lead.followUps[i].date && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Original: {fmtDate(lead.followUps[i].date)}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</Label>
                    <Input type="date" value={f.date} onChange={(e) => updateFU(i, { date: e.target.value })} className="bg-background/60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Comment</Label>
                    <Textarea
                      value={f.comment}
                      onChange={(e) => updateFU(i, { comment: e.target.value })}
                      placeholder="What happened on this touchpoint?"
                      rows={3}
                      className="resize-none bg-background/60"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileButton onFiles={(files) => updateFU(i, { attachments: [...f.attachments, ...Array.from(files).map(fileToAttachment)] })} />
                    {f.attachments.map((a, j) => (
                      <AttachmentChip key={j} a={a} onRemove={() => updateFU(i, { attachments: f.attachments.filter((_, k) => k !== j) })} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="size-4" /> Saved locally
              </span>
            )}
            <Button
              type="button"
              onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save section
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <aside className="lg:border-l lg:border-border/60 lg:pl-7">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-lg text-foreground">Outreach timeline</h3>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{timeline.length} events</span>
          </div>
          <ol className="relative space-y-5 border-l border-border/70 pl-5">
            {timeline.map((t, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[27px] top-1.5 size-3 rounded-full ring-4 ring-background ${
                  t.tone === "primary" ? "bg-primary" : t.tone === "accent" ? "bg-accent" : "bg-muted-foreground"
                }`} />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                  <time className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{fmtDate(t.date)}</time>
                </div>
                {t.comment && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.comment}</p>}
                {t.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.attachments.map((a, j) => (
                      <a key={j} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary/70 px-2 py-0.5 text-[11px] text-foreground/80 hover:text-primary">
                        <Paperclip className="size-3" /> {a.name.length > 18 ? a.name.slice(0, 18) + "…" : a.name}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {timeline.length === 0 && (
              <li className="text-sm text-muted-foreground">No events yet — fill in the form to build the timeline.</li>
            )}
          </ol>
        </aside>
      </div>
    </section>
  );
}