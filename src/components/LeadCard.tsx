import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Lead } from "@/data/leads";
import {
  formatFileSize,
  loadLeadResponse,
  MAX_PROOF_FILE_SIZE_BYTES,
  saveLeadResponse,
  timelineTimestamp,
  type LeadResponseState,
  type PersistedAttachment,
} from "@/lib/lead-responses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Paperclip,
  Info,
  Phone,
  Mail,
  MapPin,
  User,
  CalendarDays,
  Check,
  X,
  Image as ImageIcon,
  FileAudio,
  FileVideo,
  FileText,
  AlertCircle,
  ChevronDown,
  NotepadText,
  CalendarClock,
  Download,
} from "lucide-react";

const MEDIUMS = [
  "WhatsApp",
  "WhatsApp Call",
  "Phone Call",
  "Email",
  "SMS",
  "Instagram DM",
  "In-person",
];
const NOT_AVAILABLE = "Not available";

function centerAccent(center: string) {
  const lower = center.toLowerCase();
  if (lower.includes("bengaluru")) {
    return {
      header: "bg-cyan-900",
      panel: "bg-cyan-950",
      soft: "bg-cyan-50 text-cyan-800 border-cyan-200",
      line: "bg-cyan-300",
      icon: "text-cyan-700",
    };
  }
  if (lower.includes("kemps") || lower.includes("kwality")) {
    return {
      header: "bg-indigo-900",
      panel: "bg-indigo-950",
      soft: "bg-indigo-50 text-indigo-800 border-indigo-200",
      line: "bg-indigo-300",
      icon: "text-indigo-700",
    };
  }
  if (lower.includes("bandra") || lower.includes("supreme")) {
    return {
      header: "bg-teal-900",
      panel: "bg-teal-950",
      soft: "bg-teal-50 text-teal-800 border-teal-200",
      line: "bg-teal-300",
      icon: "text-teal-700",
    };
  }
  return {
    header: "bg-slate-900",
    panel: "bg-slate-800",
    soft: "bg-slate-50 text-slate-800 border-slate-200",
    line: "bg-slate-300",
    icon: "text-slate-700",
  };
}

function fileToAttachment(f: File): PersistedAttachment {
  return {
    name: f.name,
    type: f.type || "application/octet-stream",
    size: f.size,
    url: URL.createObjectURL(f),
    file: f,
  };
}

function splitAcceptedFiles(files: FileList) {
  const allFiles = Array.from(files);
  return {
    accepted: allFiles.filter((file) => file.size <= MAX_PROOF_FILE_SIZE_BYTES),
    rejected: allFiles.filter((file) => file.size > MAX_PROOF_FILE_SIZE_BYTES),
  };
}

function AttachmentChip({ a, onRemove }: { a: PersistedAttachment; onRemove: () => void }) {
  const Icon = a.type.startsWith("image/")
    ? ImageIcon
    : a.type.startsWith("audio/")
      ? FileAudio
      : a.type.startsWith("video/")
        ? FileVideo
        : FileText;
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs text-foreground/90 transition hover:border-primary/60 hover:bg-primary/5"
    >
      <Icon className="size-3.5 text-primary" />
      <span className="max-w-[180px] truncate">{a.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label="Remove attachment"
      >
        <X className="size-3" />
      </button>
    </a>
  );
}

function SourceDocumentPreview({ doc }: { doc: Lead["sourceDocuments"][number] }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border/70 bg-white shadow-sm">
      {doc.type.startsWith("audio/") ? (
        <div className="bg-slate-50 p-3">
          <audio src={doc.url} controls className="w-full" preload="metadata" />
        </div>
      ) : doc.type === "application/pdf" ? (
        <iframe title={doc.name} src={doc.url} className="h-72 w-full bg-slate-50" />
      ) : (
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-32 flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:text-primary"
        >
          <FileText className="size-6" />
          Open document
        </a>
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {doc.name} · {doc.touchpoint} · {formatFileSize(doc.size)}
        </span>
        <a
          href={doc.url}
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

function FileButton({ onFiles }: { onFiles: (files: FileList) => void }) {
  const id = useId();
  return (
    <>
      <input
        id={id}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-primary/35 bg-white px-2.5 py-1.5 text-xs font-medium text-primary transition hover:border-primary hover:bg-primary/5"
      >
        <Paperclip className="size-3.5" />
        Attach supporting documents
      </label>
    </>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "No date";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageTone(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("trial completed")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("not interested") || s.includes("lost"))
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (s.includes("unresponsive") || s.includes("did not answer"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function hasTouchpointContent({
  date,
  comment,
  attachments,
  evidenceUnavailable,
  evidenceReason,
}: {
  date: string;
  comment: string;
  attachments: PersistedAttachment[];
  evidenceUnavailable: boolean;
  evidenceReason: string;
}) {
  return Boolean(
    date || comment || attachments.length || evidenceUnavailable || evidenceReason.trim(),
  );
}

function evidenceIssue({
  date,
  comment,
  attachments,
  evidenceUnavailable,
  evidenceReason,
}: {
  date: string;
  comment: string;
  attachments: PersistedAttachment[];
  evidenceUnavailable: boolean;
  evidenceReason: string;
}) {
  const touched = hasTouchpointContent({
    date,
    comment,
    attachments,
    evidenceUnavailable,
    evidenceReason,
  });
  if (!touched) return null;
  if (evidenceUnavailable && !evidenceReason.trim()) return "Reason required";
  if (!evidenceUnavailable && attachments.length === 0) return "Supporting documents required";
  return null;
}

function FieldBlock({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <details className="group/field rounded-md border border-border/70 bg-secondary/25" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 marker:hidden">
        <Label className="cursor-pointer text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        <span className="inline-flex items-center gap-2">
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          <ChevronDown className="size-3.5 text-muted-foreground transition group-open/field:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-border/60 p-2.5">{children}</div>
    </details>
  );
}

function ReadOnlyDetails({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: Array<[string, string]>;
  compact?: boolean;
}) {
  return (
    <details className="group/read mb-3 rounded-md border border-border/70 bg-slate-50 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Info className="size-3.5" />
          {title}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground transition group-open/read:rotate-180" />
      </summary>
      <dl
        className={`grid gap-2.5 border-t border-border/60 p-3 ${compact ? "" : "md:grid-cols-2"}`}
      >
        {items.map(([label, value]) => (
          <div
            key={label}
            className={label === "Remarks" || label === "Comment" ? "md:col-span-2" : ""}
          >
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {value || NOT_AVAILABLE}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function LeadCard({
  lead,
  index,
  canSeeOriginal,
  onSubmitted,
}: {
  lead: Lead;
  index: number;
  canSeeOriginal: boolean;
  onSubmitted?: (leadId: string) => void;
}) {
  const [state, setState] = useState<LeadResponseState>({
    responseNotes: "",
    firstOutreachDate: "",
    firstOutreachMedium: "WhatsApp",
    firstOutreachComment: "",
    firstOutreachEvidenceUnavailable: false,
    firstOutreachEvidenceReason: "",
    firstOutreachAttachments: [],
    followUps: lead.followUps.map((f) => ({
      date: "",
      medium: "WhatsApp",
      comment: "",
      evidenceUnavailable: false,
      evidenceReason: "",
      attachments: [],
    })),
  });
  const [saved, setSaved] = useState(false);
  const [loadingResponse, setLoadingResponse] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = centerAccent(lead.center);

  const fileSizeMessage = (files: File[]) =>
    files
      .map(
        (file) =>
          `${file.name} is ${formatFileSize(file.size)}. Maximum supporting document file size is ${formatFileSize(MAX_PROOF_FILE_SIZE_BYTES)}.`,
      )
      .join(" ");

  useEffect(() => {
    let cancelled = false;
    setLoadingResponse(true);
    setError(null);
    loadLeadResponse(lead)
      .then((loaded) => {
        if (!cancelled && loaded) setState(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError("Saved response could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingResponse(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lead]);

  const updateFU = (i: number, patch: Partial<LeadResponseState["followUps"][number]>) => {
    setState((s) => ({
      ...s,
      followUps: s.followUps.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    }));
  };

  const persist = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextState = await saveLeadResponse(lead, state);
      setState(nextState);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSubmitted?.(lead.id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Response could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const timeline = useMemo(() => {
    const items: {
      label: string;
      date: string;
      comment?: string;
      evidenceUnavailable?: boolean;
      attachments: PersistedAttachment[];
      tone: string;
    }[] = [
      {
        label: "Lead created",
        date: lead.createdAt,
        comment: canSeeOriginal ? lead.remarks : undefined,
        attachments: [],
        tone: "primary",
      },
    ];
    if (
      state.firstOutreachDate ||
      state.firstOutreachComment ||
      state.firstOutreachAttachments.length ||
      state.firstOutreachEvidenceUnavailable
    ) {
      items.push({
        label: `First outreach · ${state.firstOutreachMedium}`,
        date: state.firstOutreachDate,
        comment: state.firstOutreachComment,
        evidenceUnavailable: state.firstOutreachEvidenceUnavailable,
        attachments: state.firstOutreachAttachments,
        tone: "accent",
      });
    }
    state.followUps.forEach((f, i) => {
      if (f.date || f.comment || f.attachments.length || f.evidenceUnavailable) {
        items.push({
          label: `Follow-up ${i + 1} · ${f.medium}`,
          date: f.date,
          comment: f.comment,
          evidenceUnavailable: f.evidenceUnavailable,
          attachments: f.attachments,
          tone: "muted",
        });
      }
    });
    return items.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return timelineTimestamp(a.date) - timelineTimestamp(b.date);
    });
  }, [state, lead.createdAt, lead.remarks, canSeeOriginal]);

  const firstOutreachIssue = evidenceIssue({
    date: state.firstOutreachDate,
    comment: state.firstOutreachComment,
    attachments: state.firstOutreachAttachments,
    evidenceUnavailable: state.firstOutreachEvidenceUnavailable,
    evidenceReason: state.firstOutreachEvidenceReason,
  });
  const fuIssues = state.followUps.map((f) =>
    evidenceIssue({
      date: f.date,
      comment: f.comment,
      attachments: f.attachments,
      evidenceUnavailable: f.evidenceUnavailable,
      evidenceReason: f.evidenceReason,
    }),
  );
  const canSubmit = !firstOutreachIssue && !fuIssues.some(Boolean);

  const completedCount =
    (firstOutreachIssue === null &&
    hasTouchpointContent({
      date: state.firstOutreachDate,
      comment: state.firstOutreachComment,
      attachments: state.firstOutreachAttachments,
      evidenceUnavailable: state.firstOutreachEvidenceUnavailable,
      evidenceReason: state.firstOutreachEvidenceReason,
    })
      ? 1
      : 0) +
    fuIssues.filter((issue, i) => !issue && hasTouchpointContent(state.followUps[i])).length;

  return (
    <details
      className="glass group rounded-xl border border-border/80 bg-white/80 shadow-sm transition hover:border-primary/25"
      open={index === 0}
    >
      {lead.followUps.map((f, i) => (
        <span key={`hidden-${i}`}>
          <input type="hidden" name={`lead-${lead.id}-followup-${i + 1}-date`} value={f.date} />
          <input
            type="hidden"
            name={`lead-${lead.id}-followup-${i + 1}-comment`}
            value={f.comment}
          />
        </span>
      ))}
      <input type="hidden" name={`lead-${lead.id}-remarks`} value={lead.remarks} />
      <input type="hidden" name={`lead-${lead.id}-id`} value={lead.id} />
      <input type="hidden" name={`lead-${lead.id}-source-id`} value={lead.sourceId} />
      <input type="hidden" name={`lead-${lead.id}-host-id`} value={lead.hostId} />
      <input type="hidden" name={`lead-${lead.id}-member-id`} value={lead.memberId} />

      <summary
        className={`flex cursor-pointer list-none flex-col gap-3 rounded-t-xl px-5 py-4 text-primary-foreground marker:hidden sm:px-6 ${accent.header}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/15 text-sm font-semibold text-primary-foreground ring-1 ring-white/20">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl text-primary-foreground">{lead.fullName}</h2>
                <Badge className={`border ${stageTone(lead.stageName)} font-medium`}>
                  {lead.stageName}
                </Badge>
              </div>
              <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-primary-foreground/75 sm:grid-cols-2 lg:grid-cols-4">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3" /> {lead.phone}
                </span>
                {lead.email !== "-" && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Mail className="size-3 shrink-0" /> {lead.email}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3" /> {lead.center}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3" /> {lead.associate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right text-xs text-primary-foreground/70">
              <div className="font-medium text-primary-foreground">{completedCount} completed</div>
              <div>{timeline.length} timeline items</div>
            </div>
            <ChevronDown className="size-5 text-primary-foreground/80 transition group-open:rotate-180" />
          </div>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Source", lead.sourceName],
            ["Form", lead.classType],
            ["Status", lead.status],
            ["Channel", lead.channel],
            ["Created", fmtDate(lead.createdAt)],
          ].map(([label, value], itemIndex) => (
            <div
              key={label}
              className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary-foreground/60">
                {itemIndex === 4 && <CalendarDays className="size-3" />}
                {label}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-primary-foreground">
                {value}
              </div>
            </div>
          ))}
        </div>
      </summary>

      <div className="border-t border-border/70 px-5 pb-5 pt-4 sm:px-6">
        <div className="space-y-4">
          {canSeeOriginal && (
            <ReadOnlyDetails
              title="Existing lead details"
              items={[
                ["Created", fmtDate(lead.createdAt)],
                ["Source", lead.sourceName],
                ["Form", lead.classType],
                ["Status", lead.status],
                ["Channel", lead.channel],
                ["Remarks", lead.remarks || NOT_AVAILABLE],
              ]}
            />
          )}

          {lead.sourceDocuments.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm">
              <div
                className={`-mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-lg px-3 py-2.5 text-white ${accent.panel}`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-white/75" />
                  <h3 className="text-base font-semibold text-white">Source documents</h3>
                </div>
                <Badge className="border border-white/20 bg-white/10 text-[10px] uppercase tracking-wider text-white">
                  {lead.sourceDocuments.length} file
                  {lead.sourceDocuments.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {lead.sourceDocuments.map((doc) => (
                  <SourceDocumentPreview key={doc.url} doc={doc} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm">
            <div
              className={`-mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-lg px-3 py-2.5 text-white ${accent.panel}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-white/15 text-xs font-semibold text-white ring-1 ring-white/20">
                  01
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">First outreach</h3>
                  <p className="text-xs text-white/65">Initial member contact</p>
                </div>
              </div>
              <Badge className="border border-white/20 bg-white/10 text-[10px] uppercase tracking-wider text-white">
                Required when used
              </Badge>
            </div>
            {canSeeOriginal && (
              <ReadOnlyDetails
                title="Existing outreach comments"
                items={[["Outreach comments", lead.remarks || NOT_AVAILABLE]]}
                compact
              />
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              <FieldBlock label="Date & time sent">
                <Input
                  type="datetime-local"
                  value={state.firstOutreachDate}
                  onChange={(e) => setState((s) => ({ ...s, firstOutreachDate: e.target.value }))}
                  className="bg-white"
                />
              </FieldBlock>
              <FieldBlock label="Medium">
                <Select
                  value={state.firstOutreachMedium}
                  onValueChange={(v) => setState((s) => ({ ...s, firstOutreachMedium: v }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIUMS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <div className="lg:col-span-2">
                <FieldBlock label="Outreach message / conversation details">
                  <Textarea
                    value={state.firstOutreachComment}
                    onChange={(e) =>
                      setState((s) => ({ ...s, firstOutreachComment: e.target.value }))
                    }
                    placeholder="Paste or summarize the first outreach message and conversation details."
                    rows={4}
                    className="min-h-28 resize-y bg-white"
                  />
                </FieldBlock>
              </div>
              <div className="lg:col-span-2">
                <FieldBlock label="Supporting documents">
                  <EvidenceControls
                    attachments={state.firstOutreachAttachments}
                    evidenceUnavailable={state.firstOutreachEvidenceUnavailable}
                    evidenceReason={state.firstOutreachEvidenceReason}
                    issue={firstOutreachIssue}
                    onFiles={(files) => {
                      const { accepted, rejected } = splitAcceptedFiles(files);
                      if (rejected.length) setError(fileSizeMessage(rejected));
                      if (accepted.length === 0) return;
                      setState((s) => ({
                        ...s,
                        firstOutreachEvidenceUnavailable: false,
                        firstOutreachEvidenceReason: "",
                        firstOutreachAttachments: [
                          ...s.firstOutreachAttachments,
                          ...accepted.map(fileToAttachment),
                        ],
                      }));
                    }}
                    onRemove={(attachmentIndex) =>
                      setState((s) => ({
                        ...s,
                        firstOutreachAttachments: s.firstOutreachAttachments.filter(
                          (_, j) => j !== attachmentIndex,
                        ),
                      }))
                    }
                    onUnavailableChange={(checked) =>
                      setState((s) => ({ ...s, firstOutreachEvidenceUnavailable: checked }))
                    }
                    onReasonChange={(reason) =>
                      setState((s) => ({ ...s, firstOutreachEvidenceReason: reason }))
                    }
                  />
                </FieldBlock>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {state.followUps.map((f, i) => {
              const issue = fuIssues[i];
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border/70 bg-white p-3 shadow-sm transition hover:border-primary/30"
                >
                  <div
                    className={`-mx-3 -mt-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-t-lg px-3 py-2.5 text-white ${accent.panel}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-md bg-white/15 text-xs font-semibold text-white ring-1 ring-white/20">
                        {String(i + 2).padStart(2, "0")}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold tracking-wide text-white">
                          Follow-up {i + 1}
                        </h4>
                        <p className="text-[11px] text-white/65">Numbered outreach checkpoint</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-white/60">
                      Row {String(i + 2).padStart(2, "0")}
                    </span>
                  </div>
                  {canSeeOriginal && (
                    <ReadOnlyDetails
                      title={`Existing follow-up ${i + 1}`}
                      items={[
                        [
                          "Date",
                          lead.followUps[i].date ? fmtDate(lead.followUps[i].date) : NOT_AVAILABLE,
                        ],
                        ["Comment", lead.followUps[i].comment || NOT_AVAILABLE],
                      ]}
                      compact
                    />
                  )}
                  <div className="grid gap-3">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <FieldBlock label="Date & time">
                        <Input
                          type="datetime-local"
                          value={f.date}
                          onChange={(e) => updateFU(i, { date: e.target.value })}
                          className="bg-white"
                        />
                      </FieldBlock>
                      <FieldBlock label="Medium">
                        <Select
                          value={f.medium}
                          onValueChange={(value) => updateFU(i, { medium: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEDIUMS.map((medium) => (
                              <SelectItem key={medium} value={medium}>
                                {medium}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                    </div>
                    <FieldBlock label="Comments">
                      <Textarea
                        value={f.comment}
                        onChange={(e) => updateFU(i, { comment: e.target.value })}
                        placeholder="Add outreach notes or conversation details for this follow-up."
                        rows={4}
                        className="min-h-28 resize-y bg-white"
                      />
                    </FieldBlock>
                    <FieldBlock label="Supporting documents">
                      <EvidenceControls
                        attachments={f.attachments}
                        evidenceUnavailable={f.evidenceUnavailable}
                        evidenceReason={f.evidenceReason}
                        issue={issue}
                        onFiles={(files) => {
                          const { accepted, rejected } = splitAcceptedFiles(files);
                          if (rejected.length) setError(fileSizeMessage(rejected));
                          if (accepted.length === 0) return;
                          updateFU(i, {
                            evidenceUnavailable: false,
                            evidenceReason: "",
                            attachments: [...f.attachments, ...accepted.map(fileToAttachment)],
                          });
                        }}
                        onRemove={(attachmentIndex) =>
                          updateFU(i, {
                            attachments: f.attachments.filter((_, j) => j !== attachmentIndex),
                          })
                        }
                        onUnavailableChange={(checked) =>
                          updateFU(i, { evidenceUnavailable: checked })
                        }
                        onReasonChange={(reason) => updateFU(i, { evidenceReason: reason })}
                      />
                    </FieldBlock>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-border/70 bg-white p-3 shadow-sm">
            <div
              className={`-mx-3 -mt-3 mb-3 flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-white ${accent.panel}`}
            >
              <NotepadText className="size-4 text-white/75" />
              <h3 className="text-base font-semibold text-white">Remarks and notes</h3>
            </div>
            <FieldBlock label="Internal remarks">
              <Textarea
                value={state.responseNotes}
                onChange={(e) => setState((s) => ({ ...s, responseNotes: e.target.value }))}
                placeholder="Add internal remarks, audit notes, context, or follow-up instructions for this member."
                rows={4}
                className="min-h-28 resize-y bg-white"
              />
            </FieldBlock>
          </div>

          <HorizontalTimeline timeline={timeline} accent={accent} />

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 pt-4">
            {loadingResponse && (
              <span className="text-xs text-muted-foreground">Loading saved response...</span>
            )}
            {!canSubmit && (
              <span className="text-xs text-muted-foreground">
                Attach supporting documents, or mark them unavailable and add a reason.
              </span>
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="size-4" /> Submitted
              </span>
            )}
            <Button
              type="button"
              disabled={!canSubmit || saving || loadingResponse}
              onClick={persist}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Submitting..." : "Submit row"}
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}

function EvidenceControls({
  attachments,
  evidenceUnavailable,
  evidenceReason,
  issue,
  onFiles,
  onRemove,
  onUnavailableChange,
  onReasonChange,
}: {
  attachments: PersistedAttachment[];
  evidenceUnavailable: boolean;
  evidenceReason: string;
  issue: string | null;
  onFiles: (files: FileList) => void;
  onRemove: (index: number) => void;
  onUnavailableChange: (checked: boolean) => void;
  onReasonChange: (reason: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileButton onFiles={onFiles} />
        {attachments.map((a, i) => (
          <AttachmentChip key={`${a.name}-${i}`} a={a} onRemove={() => onRemove(i)} />
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-md border border-border/70 bg-white px-3 py-1.5">
          <Switch
            checked={evidenceUnavailable}
            onCheckedChange={onUnavailableChange}
            aria-label="Supporting documents not available"
          />
          <span className="text-xs text-muted-foreground">Supporting documents not available</span>
        </div>
      </div>
      {evidenceUnavailable && (
        <FieldBlock label="Reason supporting documents are unavailable" hint="Required">
          <Textarea
            value={evidenceReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Required when supporting documents are unavailable."
            rows={3}
            className="resize-y bg-white"
          />
        </FieldBlock>
      )}
      {issue && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="size-3" /> {issue}
        </span>
      )}
    </div>
  );
}
function HorizontalTimeline({
  timeline,
  accent,
}: {
  timeline: {
    label: string;
    date: string;
    comment?: string;
    evidenceUnavailable?: boolean;
    attachments: PersistedAttachment[];
    tone: string;
  }[];
  accent: ReturnType<typeof centerAccent>;
}) {
  return (
    <div className="max-w-full overflow-hidden rounded-lg border border-border/70 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className={`size-4 ${accent.icon}`} />
          <h3 className="text-base font-semibold text-foreground">Outreach timeline</h3>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {timeline.length} events
        </span>
      </div>
      <ol className="relative flex max-w-full flex-nowrap gap-3 overflow-x-auto px-1 pb-28 pt-7">
        {timeline.length > 1 && (
          <span
            className={`absolute left-5 right-5 top-[46px] h-0.5 ${accent.line}`}
            aria-hidden="true"
          />
        )}
        {timeline.map((t, i) => {
          const dotColor =
            t.tone === "primary"
              ? "bg-primary"
              : t.tone === "accent"
                ? "bg-accent"
                : "bg-muted-foreground";
          return (
            <li
              key={`${t.label}-${i}`}
              className="group/timeline relative min-w-[150px] max-w-[170px] shrink-0 pb-2"
            >
              <div className="relative z-10 flex flex-col items-center text-center">
                <span className="flex size-7 items-center justify-center rounded-full border border-white bg-white shadow-sm">
                  <MapPin className={`size-4 ${dotColor.replace("bg-", "text-")}`} />
                </span>
                <time className="mt-2 text-[10px] font-medium uppercase tracking-wide text-foreground">
                  {fmtDate(t.date)}
                </time>
                <span className="mt-1 max-w-[145px] truncate text-[11px] text-muted-foreground">
                  {t.label}
                </span>
              </div>

              <div className="pointer-events-none absolute left-0 top-full z-30 mt-3 hidden w-64 rounded-lg border border-border bg-white p-3 text-left text-xs shadow-xl group-hover/timeline:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{t.label}</div>
                    <div className="mt-0.5 text-muted-foreground">{fmtDate(t.date)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {t.evidenceUnavailable && (
                      <Badge variant="outline" className="text-[10px]">
                        No supporting documents
                      </Badge>
                    )}
                    {t.attachments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t.attachments.length} file{t.attachments.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                </div>
                {t.comment ? (
                  <p className="mt-2 max-h-28 overflow-y-auto leading-relaxed text-muted-foreground">
                    {t.comment}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">No comments recorded.</p>
                )}
              </div>
            </li>
          );
        })}
        {timeline.length === 0 && (
          <li className="text-sm text-muted-foreground">
            The timeline will assemble as supporting documents are added.
          </li>
        )}
      </ol>
    </div>
  );
}
