import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Lead } from "@/data/leads";
import type { AdminResponse } from "@/lib/lead-responses";

// ─── palette ─────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const NAVY: RGB = [18, 30, 58];
const SLATE_900: RGB = [15, 23, 42];
const SLATE_700: RGB = [51, 65, 85];
const SLATE_600: RGB = [71, 85, 105];
const SLATE_400: RGB = [148, 163, 184];
const SLATE_200: RGB = [226, 232, 240];
const SLATE_100: RGB = [241, 245, 249];
const SLATE_50: RGB = [248, 250, 252];
const WHITE: RGB = [255, 255, 255];
const BLUE: RGB = [37, 99, 235];
const INDIGO_50: RGB = [238, 242, 255];
const INDIGO_700: RGB = [67, 56, 202];
const ROSE_50: RGB = [255, 241, 242];
const ROSE_700: RGB = [190, 18, 60];
const GOLD: RGB = [181, 132, 53];
const GOLD_50: RGB = [255, 251, 235];
const GREEN_800: RGB = [22, 101, 52];
const GREEN_50: RGB = [240, 253, 244];
const AMBER_800: RGB = [146, 64, 14];
const AMBER_50: RGB = [255, 251, 235];
const RED_800: RGB = [153, 27, 27];
const RED_50: RGB = [254, 242, 242];

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function hoursBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
  return isNaN(diff) ? null : diff;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const h = hoursBetween(a, b);
  return h === null ? null : h / 24;
}

function nextFriday(after: Date): Date {
  const d = new Date(after);
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const daysUntilFriday = (5 - dow + 7) % 7 || 7; // if already Friday, go to next one
  d.setDate(d.getDate() + daysUntilFriday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function isBengaluru(center: string): boolean {
  return /bengaluru|kenkere/i.test(center);
}

// ─── brand compliance ─────────────────────────────────────────────────────────
type ComplianceStatus = "pass" | "late" | "fail" | "missing";

interface ComplianceItem {
  step: string;
  expected: string;
  actual: string;
  gap: string;
  status: ComplianceStatus;
  note: string;
}

function statusLabel(s: ComplianceStatus): string {
  return s === "pass" ? "Pass" : s === "late" ? "Late" : s === "fail" ? "Fail" : "Missing";
}

function evaluateBrandCompliance(lead: Lead, response: AdminResponse): ComplianceItem[] {
  const items: ComplianceItem[] = [];
  const createdAt = lead.createdAt;
  const bengaluru = isBengaluru(lead.center);

  const tpMap = new Map(response.touchpoints.map((tp) => [tp.touchpoint_key, tp]));
  const firstOutreach = tpMap.get("first_outreach");
  const fu1 = tpMap.get("follow_up_1");
  const fu2 = tpMap.get("follow_up_2");
  const fu3 = tpMap.get("follow_up_3");
  const fu4 = tpMap.get("follow_up_4");

  // ── 1st message: within 30 mins ──────────────────────────────────────────
  {
    const actual = firstOutreach?.occurred_at;
    const h = hoursBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";
    if (h === null) {
      status = "missing";
    } else if (h <= 0.5) {
      status = "pass";
      gap = `${Math.round(h * 60)} min`;
    } else if (h <= 1) {
      status = "late";
      gap = `${Math.round(h * 60)} min`;
    } else {
      status = "fail";
      gap = `${h.toFixed(1)} hrs`;
    }
    items.push({
      step: "1st outreach message",
      expected: "Within 30 min of lead",
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Slightly past the 30-min target."
            : status === "fail"
              ? "Significantly delayed or not recorded."
              : "Not found in submitted touchpoints.",
    });
  }

  // ── 1st call: within 2 hours (if medium indicates call) ─────────────────
  // Check for any call-type touchpoint around the first outreach window
  {
    const callTp = response.touchpoints.find((tp) => {
      const med = (tp.medium ?? "").toLowerCase();
      return (
        (med.includes("phone") || med.includes("call")) && tp.touchpoint_key === "first_outreach"
      );
    });
    const callInFu = response.touchpoints.find((tp) => {
      const med = (tp.medium ?? "").toLowerCase();
      return (med.includes("phone") || med.includes("call")) && tp.touchpoint_key === "follow_up_1";
    });
    const callTouchpoint = callTp ?? callInFu;
    const actual = callTouchpoint?.occurred_at;
    const h = hoursBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";

    if (!callTouchpoint) {
      // Check if first outreach medium itself is a call
      const foMed = (firstOutreach?.medium ?? "").toLowerCase();
      if (foMed.includes("phone") || foMed.includes("call")) {
        const callH = hoursBetween(createdAt, firstOutreach?.occurred_at);
        if (callH !== null && callH <= 2.5) {
          status = "pass";
          gap = `${callH.toFixed(1)} hrs`;
        } else if (callH !== null && callH <= 4) {
          status = "late";
          gap = `${callH.toFixed(1)} hrs`;
        } else {
          status = "missing";
        }
      } else {
        // No call recorded — note as informational, don't hard fail
        status = "missing";
      }
    } else if (h === null) {
      status = "missing";
    } else if (h <= 2.5) {
      status = "pass";
      gap = `${h.toFixed(1)} hrs`;
    } else if (h <= 4) {
      status = "late";
      gap = `${h.toFixed(1)} hrs`;
    } else {
      status = "fail";
      gap = `${h.toFixed(1)} hrs`;
    }

    items.push({
      step: "Follow-up call",
      expected: "Within 2 hrs if no reply",
      actual: actual ? fmtDateTime(actual) : "Not recorded",
      gap,
      status,
      note:
        status === "missing"
          ? "No call touchpoint found. Only required if initial message went unanswered."
          : status === "pass"
            ? ""
            : "Call was delayed past the 2-hour window.",
    });
  }

  // ── Follow-up 1: next day from lead (target: day 1, range 0.75–2 days) ──
  {
    const actual = fu1?.occurred_at;
    const d = daysBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";
    const targetDay = 1;
    if (d === null) {
      status = "missing";
    } else {
      gap = `Day ${d.toFixed(1)}`;
      if (d >= 0.5 && d <= 2) status = "pass";
      else if (d > 2 && d <= 3) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 1",
      expected: `Day ${targetDay} from lead received`,
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Occurred a day behind schedule."
            : status === "fail"
              ? "Significantly overdue or not recorded."
              : "Not found in submitted touchpoints.",
    });
  }

  // ── Follow-up 2: 3rd day (target: day 3, range 2–4.5 days) ─────────────
  {
    const actual = fu2?.occurred_at;
    const d = daysBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";
    if (d === null) {
      status = "missing";
    } else {
      gap = `Day ${d.toFixed(1)}`;
      if (d >= 2 && d <= 4.5) status = "pass";
      else if (d > 4.5 && d <= 6) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 2",
      expected: "Day 3 from lead received",
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Occurred behind the Day 3 target."
            : status === "fail"
              ? "Significantly overdue or not recorded."
              : "Not found in submitted touchpoints.",
    });
  }

  // ── Follow-up 3 ──────────────────────────────────────────────────────────
  if (bengaluru) {
    // Next coming Friday after lead creation
    const targetDate = nextFriday(new Date(createdAt));
    const actual = fu3?.occurred_at;
    const d = actual ? (new Date(actual).getTime() - targetDate.getTime()) / 86_400_000 : null;
    let status: ComplianceStatus;
    let gap = "";
    if (d === null) {
      status = "missing";
    } else {
      gap = d >= 0 ? `+${d.toFixed(1)} day(s)` : `${d.toFixed(1)} day(s)`;
      if (Math.abs(d) <= 1) status = "pass";
      else if (Math.abs(d) <= 2) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 3 (Bengaluru)",
      expected: `Next Friday (${fmtDate(targetDate.toISOString())})`,
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Within acceptable range but off the Friday target."
            : status === "fail"
              ? "Significantly off the Friday schedule."
              : "Not recorded.",
    });
  } else {
    // Mumbai: day 5 (range 4–6.5 days)
    const actual = fu3?.occurred_at;
    const d = daysBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";
    if (d === null) {
      status = "missing";
    } else {
      gap = `Day ${d.toFixed(1)}`;
      if (d >= 4 && d <= 6.5) status = "pass";
      else if (d > 6.5 && d <= 8) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 3 (Mumbai)",
      expected: "Day 5 from lead received",
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Behind the Day 5 target."
            : status === "fail"
              ? "Significantly overdue or not recorded."
              : "Not recorded.",
    });
  }

  // ── Follow-up 4 ──────────────────────────────────────────────────────────
  if (bengaluru) {
    // 2 days after FU3
    const fu3Date = fu3?.occurred_at;
    const actual = fu4?.occurred_at;
    const d = daysBetween(fu3Date, actual);
    let status: ComplianceStatus;
    let gap = "";
    if (!fu3Date) {
      status = "missing";
    } else if (d === null) {
      status = "missing";
    } else {
      gap = `${d.toFixed(1)} day(s) after FU3`;
      if (d >= 1.5 && d <= 3.5) status = "pass";
      else if ((d > 0.5 && d < 1.5) || (d > 3.5 && d <= 5)) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 4 (Bengaluru)",
      expected: "2 days after Follow-up 3",
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Slightly off the 2-day target after FU3."
            : status === "fail"
              ? "Significantly off schedule."
              : "Not recorded.",
    });
  } else {
    // Mumbai: day 7 (range 6–8.5 days)
    const actual = fu4?.occurred_at;
    const d = daysBetween(createdAt, actual);
    let status: ComplianceStatus;
    let gap = "";
    if (d === null) {
      status = "missing";
    } else {
      gap = `Day ${d.toFixed(1)}`;
      if (d >= 6 && d <= 8.5) status = "pass";
      else if (d > 8.5 && d <= 10) status = "late";
      else status = "fail";
    }
    items.push({
      step: "Follow-up 4 (Mumbai)",
      expected: "Day 7 from lead received",
      actual: fmtDateTime(actual),
      gap,
      status,
      note:
        status === "pass"
          ? ""
          : status === "late"
            ? "Behind the Day 7 target."
            : status === "fail"
              ? "Significantly overdue or not recorded."
              : "Not recorded.",
    });
  }

  return items;
}

function complianceScore(items: ComplianceItem[]): {
  pass: number;
  late: number;
  fail: number;
  missing: number;
} {
  return {
    pass: items.filter((i) => i.status === "pass").length,
    late: items.filter((i) => i.status === "late").length,
    fail: items.filter((i) => i.status === "fail").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
}

// ─── critical findings ────────────────────────────────────────────────────────
type Severity = "Critical" | "Warning" | "Info";
interface Finding {
  severity: Severity;
  text: string;
}

function deriveCriticalFindings(
  lead: Lead,
  response: AdminResponse,
  compliance: ComplianceItem[],
): Finding[] {
  const findings: Finding[] = [];
  const stage = lead.stageName.toLowerCase();

  if (stage.includes("unresponsive") || stage.includes("did not answer"))
    findings.push({
      severity: "Critical",
      text: "Lead is unresponsive after multiple outreach attempts. Escalation or channel change required.",
    });

  if (stage.includes("not interested"))
    findings.push({
      severity: "Critical",
      text: "Lead expressed disinterest. Reason must be documented and lead formally closed in CRM.",
    });

  if (stage.includes("trial completed") && lead.conversionStatus !== "Converted")
    findings.push({
      severity: "Critical",
      text: "Trial completed but no membership conversion recorded. Immediate closing conversation required.",
    });

  if (stage.includes("will get back") || stage.includes("callback"))
    findings.push({
      severity: "Warning",
      text: "Lead indicated intent to follow up without confirming a date. Schedule a reminder within 48 hours.",
    });

  if (lead.conversionStatus === "Converted" && lead.retentionStatus !== "Retained")
    findings.push({
      severity: "Warning",
      text: "Converted to member but retention not confirmed. Verify attendance and engagement levels.",
    });

  const missingDocs = response.touchpoints.filter(
    (tp) => !tp.evidence_unavailable && tp.files.length === 0,
  );
  if (missingDocs.length > 0)
    findings.push({
      severity: "Warning",
      text: `${missingDocs.length} touchpoint(s) lack supporting documents: ${missingDocs.map((t) => t.label).join(", ")}.`,
    });

  if (response.touchpoints.length === 0)
    findings.push({
      severity: "Critical",
      text: "No touchpoints submitted. Outreach record is incomplete.",
    });

  const complianceFails = compliance.filter((c) => c.status === "fail");
  if (complianceFails.length >= 3)
    findings.push({
      severity: "Critical",
      text: `${complianceFails.length} outreach steps failed brand compliance standards. Review and correct the outreach cadence.`,
    });
  else if (complianceFails.length > 0)
    findings.push({
      severity: "Warning",
      text: `${complianceFails.length} outreach step(s) failed compliance: ${complianceFails.map((c) => c.step).join(", ")}.`,
    });

  if (findings.length === 0)
    findings.push({
      severity: "Info",
      text: "No critical issues identified. Outreach record is complete and in good standing.",
    });

  return findings;
}

// ─── next steps ───────────────────────────────────────────────────────────────
interface Action {
  priority: "Immediate" | "This week" | "Ongoing";
  owner: string;
  action: string;
}

function deriveNextSteps(lead: Lead, response: AdminResponse): Action[] {
  const actions: Action[] = [];
  const stage = lead.stageName.toLowerCase();
  const associate = response.associate || lead.associate || "Associate";

  if (stage.includes("unresponsive") || stage.includes("did not answer")) {
    actions.push({
      priority: "Immediate",
      owner: associate,
      action:
        "Attempt contact via alternate channel (e.g. email or in-person if applicable). Log outcome.",
    });
    actions.push({
      priority: "This week",
      owner: "Manager",
      action: "Decide whether to mark lead as Lost or re-assign to a different associate.",
    });
  }

  if (stage.includes("trial completed") && lead.conversionStatus !== "Converted") {
    actions.push({
      priority: "Immediate",
      owner: associate,
      action: "Present membership pricing. Address trial feedback and objections.",
    });
    actions.push({
      priority: "This week",
      owner: "Manager",
      action: "Track conversion outcome within 7 days. Escalate if no reply.",
    });
  }

  if (stage.includes("not interested")) {
    actions.push({
      priority: "Immediate",
      owner: associate,
      action: "Document reason for disinterest in CRM. Close lead and send a polite closing note.",
    });
    actions.push({
      priority: "Ongoing",
      owner: "Manager",
      action: "Review potential re-engagement in 60 days via a relevant campaign.",
    });
  }

  if (stage.includes("will get back") || stage.includes("callback")) {
    actions.push({
      priority: "Immediate",
      owner: associate,
      action: "Set a 48-hour follow-up reminder. Contact proactively if no callback received.",
    });
  }

  if (lead.conversionStatus === "Converted" && lead.retentionStatus !== "Retained") {
    actions.push({
      priority: "This week",
      owner: associate,
      action: "Check class attendance record. Send a personalised check-in message.",
    });
  }

  const missingDocs = response.touchpoints.filter(
    (tp) => !tp.evidence_unavailable && tp.files.length === 0,
  );
  if (missingDocs.length > 0) {
    actions.push({
      priority: "This week",
      owner: response.submitted_by_email,
      action: `Upload missing supporting documents for: ${missingDocs.map((t) => t.label).join(", ")}.`,
    });
  }

  if (actions.length === 0)
    actions.push({
      priority: "Ongoing",
      owner: associate,
      action: "Continue standard outreach cadence. Monitor for status change.",
    });

  return actions;
}

// ─── pdf drawing utilities ────────────────────────────────────────────────────
function sf(doc: jsPDF, style: "normal" | "bold" | "italic" | "bolditalic") {
  doc.setFont("helvetica", style);
}

function drawRule(doc: jsPDF, y: number, color: RGB = SLATE_200) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
}

function drawSectionHeader(doc: jsPDF, label: string, y: number): number {
  doc.setFillColor(...GOLD);
  doc.roundedRect(14, y + 1, 2.5, 7, 0.8, 0.8, "F");

  sf(doc, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.setCharSpace(1.1);
  doc.text(label.toUpperCase(), 20, y + 5);
  doc.setCharSpace(0);
  doc.setTextColor(...SLATE_900);

  drawRule(doc, y + 9, SLATE_100);
  return y + 13;
}

function checkPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 275) {
    doc.addPage();
    fillPage(doc);
    return 16;
  }
  return y;
}

function twoCol(
  doc: jsPDF,
  items: [string, string][],
  startY: number,
  margin = 14,
  colW = 91,
): number {
  let lY = startY;
  let rY = startY;
  items.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? margin : margin + colW;
    const curY = i % 2 === 0 ? lY : rY;
    const nextY = drawLabelValue(doc, label, value, x, curY, colW - 4);
    if (i % 2 === 0) lY = nextY + 3;
    else rY = nextY + 3;
  });
  return Math.max(lY, rY);
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number,
): number {
  sf(doc, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE_400);
  doc.setCharSpace(0.8);
  doc.text(label.toUpperCase(), x, y);
  doc.setCharSpace(0);

  sf(doc, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_900);
  const lines = doc.splitTextToSize(value || "—", maxW);
  doc.text(lines, x, y + 4.5);
  return y + 4.5 + lines.length * 4.2;
}

function fillPage(doc: jsPDF) {
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(252, 250, 247);
  doc.rect(0, 0, 210, 297, "F");
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = WHITE) {
  doc.setFillColor(...fill);
  doc.setDrawColor(231, 226, 218);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.4, 2.4, "FD");
}

function drawPill(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fill: RGB,
  color: RGB,
  width?: number,
) {
  const pillW = width ?? Math.max(24, doc.getTextWidth(text) + 9);
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, pillW, 7.5, 3.75, 3.75, "F");
  sf(doc, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...color);
  doc.text(text, x + (pillW - doc.getTextWidth(text)) / 2, y + 5.1);
}

function drawMetricCard(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  accent: RGB,
) {
  drawCard(doc, x, y, w, 22);
  doc.setFillColor(...accent);
  doc.roundedRect(x + 3, y + 3, 1.8, 16, 0.9, 0.9, "F");

  sf(doc, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE_400);
  doc.setCharSpace(0.7);
  doc.text(label.toUpperCase(), x + 8, y + 8);
  doc.setCharSpace(0);

  sf(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE_900);
  const lines = doc.splitTextToSize(value || "—", w - 12);
  doc.text(lines.slice(0, 2), x + 8, y + 15);
}

function evidenceSummary(response: AdminResponse): string {
  const total = response.touchpoints.length;
  if (total === 0) return "No touchpoints";
  const attached = response.touchpoints.filter((tp) => tp.files.length > 0).length;
  const unavailable = response.touchpoints.filter((tp) => tp.evidence_unavailable).length;
  return `${attached}/${total} attached${unavailable ? ` · ${unavailable} unavailable` : ""}`;
}

function latestTouchpoint(response: AdminResponse): string {
  const latest = [...response.touchpoints]
    .filter((tp) => tp.occurred_at)
    .sort(
      (a, b) => new Date(b.occurred_at ?? "").getTime() - new Date(a.occurred_at ?? "").getTime(),
    )[0];
  if (!latest) return "No dated outreach recorded";
  return `${latest.label || latest.touchpoint_key.replace(/_/g, " ")} · ${fmtDateTime(latest.occurred_at)}`;
}

function journeySummary(
  lead: Lead,
  response: AdminResponse,
  score: ReturnType<typeof complianceScore>,
): string {
  const totalTouchpoints = response.touchpoints.length;
  const outcome =
    lead.conversionStatus === "Converted"
      ? "converted"
      : lead.trialStatus.toLowerCase().includes("trial completed")
        ? "completed a trial touchpoint"
        : lead.status.toLowerCase();
  return `${lead.fullName}'s outreach journey began through ${lead.sourceName || lead.channel} and is currently marked ${lead.stageName}. The record contains ${totalTouchpoints} documented team touchpoint${totalTouchpoints === 1 ? "" : "s"}, with ${score.pass} protocol milestone${score.pass === 1 ? "" : "s"} on time and ${score.late + score.fail + score.missing} requiring attention. Current commercial outcome: ${outcome}.`;
}

const TABLE_HEAD = {
  fillColor: NAVY,
  textColor: WHITE,
  fontSize: 7,
  fontStyle: "bold" as const,
  cellPadding: { top: 3, bottom: 3, left: 3, right: 2 },
};

const TABLE_BODY = {
  fontSize: 7.5,
  textColor: SLATE_900,
  cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 2 },
  lineColor: [231, 226, 218] as RGB,
  lineWidth: 0.1,
};

// ─── main generator ───────────────────────────────────────────────────────────
export function generateMemberAuditPDF(lead: Lead, response: AdminResponse): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  let y = 0;

  const reportDate = fmtDate(new Date().toISOString());
  const compliance = evaluateBrandCompliance(lead, response);
  const score = complianceScore(compliance);
  const findings = deriveCriticalFindings(lead, response, compliance);
  const actions = deriveNextSteps(lead, response);
  const bengaluru = isBengaluru(lead.center);

  fillPage(doc);

  // ── editorial report cover ────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 54, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 1.5, "F");
  doc.setFillColor(28, 42, 78);
  doc.circle(W - 26, 18, 21, "F");
  doc.setFillColor(41, 57, 96);
  doc.circle(W - 8, 40, 28, "F");

  sf(doc, "bold");
  doc.setFontSize(7.5);
  doc.setCharSpace(2.5);
  doc.setTextColor(...WHITE);
  doc.text("PHYSIQUE57", M, 11);
  doc.setCharSpace(0);

  sf(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(216, 207, 193);
  doc.text("Client Outreach Journey Report · Confidential", M, 17);

  sf(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(216, 207, 193);
  doc.text(`Generated ${reportDate}`, W - M - 40, 17);

  sf(doc, "bold");
  doc.setFontSize(24);
  doc.setTextColor(...WHITE);
  doc.text(doc.splitTextToSize(lead.fullName, 118).slice(0, 2), M, 33);

  sf(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(216, 207, 193);
  doc.text(`${lead.center} · ${lead.associate}`, M, 47);

  const stageBg = lead.stageName.toLowerCase().includes("trial completed")
    ? GREEN_50
    : lead.stageName.toLowerCase().match(/unresponsive|did not answer|not interested/)
      ? RED_50
      : AMBER_50;
  const stageText = lead.stageName.toLowerCase().includes("trial completed")
    ? GREEN_800
    : lead.stageName.toLowerCase().match(/unresponsive|did not answer|not interested/)
      ? RED_800
      : AMBER_800;

  const stageLabel = lead.stageName.slice(0, 26);
  drawPill(doc, stageLabel, W - M - 58, 28, stageBg, stageText, 58);

  y = 62;

  drawCard(doc, M, y, W - M * 2, 34);
  sf(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.setCharSpace(1);
  doc.text("EXECUTIVE JOURNEY READOUT", M + 6, y + 8);
  doc.setCharSpace(0);
  sf(doc, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...SLATE_700);
  const summaryLines = doc.splitTextToSize(journeySummary(lead, response, score), W - M * 2 - 12);
  doc.text(summaryLines.slice(0, 4), M + 6, y + 15);
  y += 42;

  // ── quick-stats row ───────────────────────────────────────────────────────
  const statsItems: [string, string][] = [
    ["Lead ID", lead.id],
    ["Journey Stage", lead.status],
    ["Trial", lead.trialStatus],
    ["Revenue", lead.ltv > 0 ? `₹${lead.ltv.toLocaleString("en-IN")}` : "—"],
    ["Evidence", evidenceSummary(response)],
    ["Protocol", `${score.pass} on time · ${score.late + score.fail + score.missing} open`],
  ];
  const colCount = 3;
  const colW = (W - M * 2 - 8) / colCount;
  statsItems.forEach(([lbl, val], i) => {
    const cx = M + (i % colCount) * (colW + 4);
    const cy = y + Math.floor(i / colCount) * 26;
    const accent = i === 0 ? GOLD : i === 1 ? INDIGO_700 : i === 2 ? ROSE_700 : BLUE;
    drawMetricCard(doc, lbl, val.slice(0, 36), cx, cy, colW, accent);
  });
  y += 58;

  drawCard(doc, M, y, W - M * 2, 17, INDIGO_50);
  sf(doc, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...INDIGO_700);
  doc.text("LATEST RECORDED TOUCHPOINT", M + 5, y + 6.5);
  sf(doc, "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...SLATE_900);
  doc.text(doc.splitTextToSize(latestTouchpoint(response), W - M * 2 - 10), M + 5, y + 12.3);
  y += 27;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Brand Compliance Assessment
  // ═══════════════════════════════════════════════════════════════════════════
  y = checkPage(doc, y, 50);
  y = drawSectionHeader(
    doc,
    `1. Brand Compliance Assessment — ${bengaluru ? "Bengaluru" : "Mumbai"} Protocol`,
    y,
  );

  // compliance legend
  sf(doc, "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_600);
  doc.text(
    bengaluru
      ? "Protocol: Message ≤30 min · Call ≤2 hrs · FU1 day 1 · FU2 day 3 · FU3 next Friday · FU4 +2 days"
      : "Protocol: Message ≤30 min · Call ≤2 hrs · FU1 day 1 · FU2 day 3 · FU3 day 5 · FU4 day 7",
    M,
    y,
  );
  y += 6;

  const complianceTableBody = compliance.map((item) => [
    item.step,
    item.expected,
    item.actual,
    item.gap || "—",
    statusLabel(item.status),
    item.note || "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Step", "Expected", "Actual", "Gap", "Status", "Notes"]],
    body: complianceTableBody,
    theme: "grid",
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 34 },
      2: { cellWidth: 34 },
      3: { cellWidth: 16 },
      4: { cellWidth: 15, fontStyle: "bold" },
      5: { cellWidth: 45 },
    },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const val = String(data.cell.raw ?? "");
        if (val === "Pass") data.cell.styles.textColor = GREEN_800;
        else if (val === "Late") data.cell.styles.textColor = AMBER_800;
        else data.cell.styles.textColor = RED_800;
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Critical Findings
  // ═══════════════════════════════════════════════════════════════════════════
  y = checkPage(doc, y, 30);
  y = drawSectionHeader(doc, "2. Critical Findings", y);

  findings.forEach((f) => {
    const textLines = doc.splitTextToSize(f.text, 165);
    const boxH = textLines.length * 4.5 + 9;
    y = checkPage(doc, y, boxH + 4);

    const [bg, border, tc]: [RGB, RGB, RGB] =
      f.severity === "Critical"
        ? [RED_50, RED_800, RED_800]
        : f.severity === "Warning"
          ? [AMBER_50, AMBER_800, AMBER_800]
          : [
              [239, 246, 255],
              [37, 99, 235],
              [30, 58, 138],
            ];

    doc.setFillColor(...bg);
    doc.roundedRect(M, y, W - M * 2, boxH, 2.2, 2.2, "F");
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.line(M, y, M, y + boxH); // left accent line only
    doc.setLineWidth(0.1);
    doc.roundedRect(M, y, W - M * 2, boxH, 2.2, 2.2, "S");

    sf(doc, "bold");
    doc.setFontSize(6.5);
    doc.setCharSpace(0.5);
    doc.setTextColor(...tc);
    doc.text(f.severity.toUpperCase(), M + 4, y + 5.5);
    doc.setCharSpace(0);

    sf(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_900);
    doc.text(textLines, M + 23, y + 5.5);

    y += boxH + 3;
  });

  y += 4;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Member Profile
  // ═══════════════════════════════════════════════════════════════════════════
  y = checkPage(doc, y, 40);
  y = drawSectionHeader(doc, "3. Member Profile", y);

  const profileItems: [string, string][] = [
    ["Phone", lead.phone],
    ["Email", lead.email !== "-" ? lead.email : "—"],
    ["Source", lead.sourceName],
    ["Channel", lead.channel],
    ["Class type", lead.classType],
    ["Lead created", fmtDate(lead.createdAt)],
    ["Purchases", String(lead.purchasesMade || "—")],
    ["Lifetime value", lead.ltv > 0 ? `₹${lead.ltv.toLocaleString("en-IN")}` : "—"],
    ["Studio visits", String(lead.visits || "—")],
    ["Member ID", lead.memberId || "—"],
  ];

  y = twoCol(doc, profileItems, y) + 4;

  if (lead.remarks) {
    y = checkPage(doc, y, 16);
    drawLabelValue(doc, "Lead remarks", lead.remarks, M, y, W - M * 2);
    const remarkLines = doc.splitTextToSize(lead.remarks, W - M * 2);
    y += remarkLines.length * 4.2 + 10;
  }

  drawRule(doc, y);
  y += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Outreach Timeline
  // ═══════════════════════════════════════════════════════════════════════════
  y = checkPage(doc, y, 30);
  y = drawSectionHeader(doc, "4. Outreach Timeline", y);

  const sortedTouchpoints = [...response.touchpoints].sort((a, b) => {
    const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : Infinity;
    const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : Infinity;
    return ta - tb;
  });

  const journeyMilestones = [
    { label: "Lead Created", date: fmtDate(lead.createdAt), tone: GOLD as RGB },
    ...sortedTouchpoints.slice(0, 4).map((tp) => ({
      label: tp.label || tp.touchpoint_key.replace(/_/g, " "),
      date: fmtDate(tp.occurred_at),
      tone: NAVY as RGB,
    })),
  ];
  if (lead.convertedAt && lead.convertedAt !== "-") {
    journeyMilestones.push({
      label: "Converted",
      date: fmtDate(lead.convertedAt),
      tone: GREEN_800,
    });
  }

  if (journeyMilestones.length > 1) {
    const mapH = 24;
    y = checkPage(doc, y, mapH + 8);
    drawCard(doc, M, y, W - M * 2, mapH, WHITE);
    const usableW = W - M * 2 - 18;
    const startX = M + 9;
    const step = usableW / Math.max(journeyMilestones.length - 1, 1);
    doc.setDrawColor(218, 210, 198);
    doc.setLineWidth(0.45);
    doc.line(startX, y + 9, startX + step * (journeyMilestones.length - 1), y + 9);

    journeyMilestones.forEach((item, i) => {
      const x = startX + i * step;
      doc.setFillColor(...item.tone);
      doc.circle(x, y + 9, 2.2, "F");

      sf(doc, "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...SLATE_900);
      const label = doc.splitTextToSize(item.label, Math.min(32, step + 8)).slice(0, 2);
      doc.text(label, x - Math.min(14, step / 2), y + 15);

      sf(doc, "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(...SLATE_400);
      doc.text(item.date, x - Math.min(14, step / 2), y + 21);
    });
    y += mapH + 8;
  }

  const timelineRows: string[][] = [];

  timelineRows.push([
    "Lead Created",
    fmtDate(lead.createdAt),
    "—",
    lead.remarks ? lead.remarks.slice(0, 100) + (lead.remarks.length > 100 ? "…" : "") : "—",
    "N/A",
  ]);

  sortedTouchpoints.forEach((tp) => {
    const evidenceStatus = tp.evidence_unavailable
      ? `Unavailable${tp.evidence_unavailable_reason ? ` — ${tp.evidence_unavailable_reason.slice(0, 40)}` : ""}`
      : tp.files.length > 0
        ? `${tp.files.length} file(s)`
        : "Missing";

    timelineRows.push([
      tp.label || tp.touchpoint_key.replace(/_/g, " "),
      fmtDateTime(tp.occurred_at),
      tp.medium || "—",
      tp.comment ? tp.comment.slice(0, 110) + (tp.comment.length > 110 ? "…" : "") : "—",
      evidenceStatus,
    ]);
  });

  // source follow-up data not covered by touchpoints
  lead.followUps.forEach((fu, i) => {
    if (!fu.date && !fu.comment) return;
    const alreadyCovered = sortedTouchpoints.some((tp) =>
      tp.label?.toLowerCase().includes(`follow-up ${i + 1}`),
    );
    if (alreadyCovered) return;
    timelineRows.push([
      `Follow-up ${i + 1}`,
      fmtDate(fu.date),
      "—",
      fu.comment ? fu.comment.slice(0, 110) + (fu.comment.length > 110 ? "…" : "") : "—",
      "Source record only",
    ]);
  });

  if (lead.convertedAt)
    timelineRows.push(["Converted", fmtDate(lead.convertedAt), "—", "Membership confirmed", "N/A"]);

  autoTable(doc, {
    startY: y,
    head: [["Event", "Date / Time", "Medium", "Notes", "Evidence"]],
    body: timelineRows,
    theme: "grid",
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 30 },
      2: { cellWidth: 22 },
      3: { cellWidth: 74 },
      4: { cellWidth: 24 },
    },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const val = String(data.cell.raw ?? "");
        if (val === "Missing") data.cell.styles.textColor = RED_800;
        else if (val.startsWith("Unavailable")) data.cell.styles.textColor = AMBER_800;
        else if (val.includes("file")) data.cell.styles.textColor = GREEN_800;
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Touchpoint Notes
  // ═══════════════════════════════════════════════════════════════════════════
  if (sortedTouchpoints.length > 0) {
    y = checkPage(doc, y, 30);
    y = drawSectionHeader(doc, "5. Touchpoint Notes", y);

    sortedTouchpoints.forEach((tp, idx) => {
      const comment = tp.comment || "No notes recorded.";
      const commentLines = doc.splitTextToSize(comment, W - M * 2 - 10);
      const boxH = commentLines.length * 4.2 + 17;
      y = checkPage(doc, y, boxH + 4);

      drawCard(doc, M, y, W - M * 2, boxH, WHITE);

      // left accent
      doc.setFillColor(...(idx === 0 ? GOLD : NAVY));
      doc.roundedRect(M, y, 2, boxH, 1, 1, "F");

      sf(doc, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE_900);
      doc.text(`${idx + 1}. ${tp.label || tp.touchpoint_key.replace(/_/g, " ")}`, M + 6, y + 6);

      sf(doc, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE_400);
      doc.text(`${fmtDateTime(tp.occurred_at)}  ·  ${tp.medium || "—"}`, M + 6, y + 11.5);

      sf(doc, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_700);
      doc.text(commentLines, M + 6, y + 17);

      if (tp.evidence_unavailable && tp.evidence_unavailable_reason) {
        const evY = y + 17 + commentLines.length * 4.2;
        sf(doc, "italic");
        doc.setFontSize(7);
        doc.setTextColor(...AMBER_800);
        doc.text(
          `Evidence unavailable: ${tp.evidence_unavailable_reason.slice(0, 120)}`,
          M + 6,
          evY,
        );
      }

      if (tp.files.length > 0) {
        const fY = y + boxH - 4.5;
        sf(doc, "italic");
        doc.setFontSize(7);
        doc.setTextColor(...SLATE_400);
        doc.text(
          `Attached: ${tp.files
            .map((f) => f.name)
            .join(", ")
            .slice(0, 160)}`,
          M + 6,
          fY,
        );
      }

      y += boxH + 4;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Admin Response Notes
  // ═══════════════════════════════════════════════════════════════════════════
  if (response.response_notes) {
    y = checkPage(doc, y, 25);
    y = drawSectionHeader(doc, "6. Admin Notes", y);

    const noteLines = doc.splitTextToSize(response.response_notes, W - M * 2 - 4);
    const noteH = noteLines.length * 4.2 + 8;
    drawCard(doc, M, y, W - M * 2, noteH, GOLD_50);
    sf(doc, "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE_600);
    doc.text(noteLines, M + 4, y + 6);
    y += noteH + 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Next Steps & Team Actions
  // ═══════════════════════════════════════════════════════════════════════════
  const nextStepsSection = response.response_notes ? "7" : "6";
  y = checkPage(doc, y, 30);
  y = drawSectionHeader(doc, `${nextStepsSection}. Next Steps & Team Actions`, y);

  autoTable(doc, {
    startY: y,
    head: [["Priority", "Owner", "Action Required"]],
    body: actions.map((a) => [a.priority, a.owner || "—", a.action]),
    theme: "grid",
    headStyles: TABLE_HEAD,
    bodyStyles: {
      ...TABLE_BODY,
      fontSize: 8,
      cellPadding: { top: 3.8, bottom: 3.8, left: 3, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 52 },
      2: { cellWidth: 106 },
    },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const val = String(data.cell.raw ?? "");
        if (val === "Immediate") data.cell.styles.textColor = RED_800;
        else if (val === "This week") data.cell.styles.textColor = AMBER_800;
        else data.cell.styles.textColor = GREEN_800;
      }
    },
  });

  // ── footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    // thin top rule on pages > 1
    if (page > 1) {
      doc.setDrawColor(...SLATE_200);
      doc.setLineWidth(0.3);
      doc.line(M, 8, W - M, 8);
      sf(doc, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE_400);
      doc.text(`${lead.fullName} — Audit Report`, M, 6);
    }

    // footer rule
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.3);
    doc.line(M, 285, W - M, 285);

    sf(doc, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE_400);
    doc.text("Physique57 · Outreach Audit · Confidential · Internal Use Only", M, 290);
    doc.text(`Page ${page} of ${totalPages}`, W - M - 18, 290);
  }

  const safeName = lead.fullName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`audit_report_${safeName}_${lead.id}.pdf`);
}

export function generateAllMemberPDFs(
  leads: Lead[],
  responses: AdminResponse[],
  onProgress?: (current: number, total: number) => void,
): void {
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const total = responses.length;
  responses.forEach((response, i) => {
    const lead = leadMap.get(response.lead_id);
    if (!lead) return;
    onProgress?.(i + 1, total);
    generateMemberAuditPDF(lead, response);
  });
}
