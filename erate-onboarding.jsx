import { useState, useEffect } from "react";
import {
  Search,
  Building2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  FileText,
  Shield,
  X,
  ExternalLink,
  Wifi,
  Server,
  Wrench,
  Calendar,
  Download,
  FileCheck2,
  Upload,
  FolderOpen,
  AlertCircle,
  HelpCircle,
  Pencil,
  Image as ImageIcon,
  Mail,
  FileSpreadsheet,
  ChevronLeft,
} from "lucide-react";

const DISTRICTS = [
  {
    ben: "16012345",
    name: "Linfield Christian School",
    city: "Temecula, CA",
    students: 712,
  },
  {
    ben: "16012346",
    name: "Riverside Unified SD",
    city: "Riverside, CA",
    students: 41200,
  },
  {
    ben: "16012347",
    name: "Murrieta Valley USD",
    city: "Murrieta, CA",
    students: 23100,
  },
];

const FUNDING_YEARS = [
  { fy: 2017, frns: 2, committed: 42300, disbursed: 40150, status: "complete", c1: 32000, c2: 10300 },
  { fy: 2018, frns: 3, committed: 51200, disbursed: 49800, status: "complete", c1: 38000, c2: 13200 },
  { fy: 2019, frns: 2, committed: 38900, disbursed: 36400, status: "complete", c1: 30000, c2: 8900 },
  { fy: 2020, frns: 4, committed: 67500, disbursed: 65200, status: "complete", c1: 48000, c2: 19500 },
  { fy: 2021, frns: 3, committed: 54800, disbursed: 52100, status: "complete", c1: 41000, c2: 13800 },
  { fy: 2022, frns: 2, committed: 48200, disbursed: 46900, status: "complete", c1: 36000, c2: 12200 },
  { fy: 2023, frns: 3, committed: 58400, disbursed: 55200, status: "complete", c1: 43000, c2: 15400 },
  { fy: 2024, frns: 4, committed: 72100, disbursed: 68800, status: "complete", c1: 52000, c2: 20100 },
  { fy: 2025, frns: 3, committed: 61300, disbursed: 43200, status: "invoicing", c1: 46000, c2: 15300 },
  { fy: 2026, frns: 2, committed: 54600, disbursed: 0, status: "awaiting", c1: 41000, c2: 13600 },
];

const FRN_TEMPLATES = [
  { service: "Internet Access", vendor: "Spectrum Business", category: "C1", iconKey: "wifi" },
  { service: "Wide Area Network", vendor: "Lumen Technologies", category: "C1", iconKey: "server" },
  { service: "Internal Connections — Switches", vendor: "CDW-G / Cisco", category: "C2", iconKey: "server" },
  { service: "Wireless Access Points", vendor: "CDW-G / Aruba", category: "C2", iconKey: "wifi" },
  { service: "Basic Maintenance", vendor: "ENA Services", category: "C2", iconKey: "wrench" },
];

const FRN_ICON = { wifi: Wifi, server: Server, wrench: Wrench };

function getFrnsForYear(year) {
  const templates = FRN_TEMPLATES.slice(0, year.frns);
  const c1Count = templates.filter((t) => t.category === "C1").length;
  const c2Count = templates.filter((t) => t.category === "C2").length;
  const c1Each = c1Count ? Math.round(year.c1 / c1Count) : 0;
  const c2Each = c2Count ? Math.round(year.c2 / c2Count) : 0;
  return templates.map((t, i) => ({
    id: `${year.fy.toString().slice(-2)}10${(i + 1).toString().padStart(6, "0")}`,
    ...t,
    amount: t.category === "C1" ? c1Each : c2Each,
  }));
}

function getDocumentsForYear(year) {
  const docs = [
    { name: `Form 470 — FY${year.fy}.pdf`, type: "Form 470", size: "248 KB" },
    { name: `Form 471 — FY${year.fy}.pdf`, type: "Form 471", size: "412 KB" },
  ];
  if (year.status === "complete" || year.status === "invoicing") {
    docs.push({ name: `FCDL — FY${year.fy}.pdf`, type: "FCDL", size: "186 KB" });
  }
  if (year.status === "complete") {
    docs.push({ name: `Form 486 — FY${year.fy}.pdf`, type: "Form 486", size: "94 KB" });
  }
  docs.push({ name: `Vendor contract — FY${year.fy}.pdf`, type: "Contract", size: "1.2 MB" });
  return docs;
}

function getMilestonesForYear(year) {
  const fyShort = year.fy.toString().slice(-2);
  const milestones = [
    { label: "Form 470 certified", date: `Oct 14, 20${parseInt(fyShort, 10) - 1}`, done: true },
    { label: "Allowable Contract Date", date: `Nov 11, 20${parseInt(fyShort, 10) - 1}`, done: true },
    { label: "Vendor selected", date: `Nov 18, 20${parseInt(fyShort, 10) - 1}`, done: true },
    { label: "Form 471 certified", date: `Mar 02, 20${fyShort}`, done: true },
    {
      label: "Funding committed (FCDL)",
      date: `May 22, 20${fyShort}`,
      done: year.status === "complete" || year.status === "invoicing",
    },
    {
      label: "Form 486 filed",
      date: `Sep 12, 20${fyShort}`,
      done: year.status === "complete",
    },
    {
      label: "Fully invoiced",
      date: year.status === "complete" ? `Jun 30, 20${parseInt(fyShort, 10) + 1}` : "—",
      done: year.status === "complete",
    },
  ];
  return milestones;
}

const STATUS_STYLES = {
  complete: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Complete",
  },
  invoicing: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Invoicing",
  },
  awaiting: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
    label: "Awaiting USAC",
  },
};

const formatMoney = (n) => "$" + n.toLocaleString("en-US");

const SAMPLE_FILES = [
  { name: "Form_470_Application_2024.pdf", size: "248 KB" },
  { name: "Spectrum_Quote_FY24.pdf", size: "412 KB" },
  { name: "Board_Approval_Memo_2023.pdf", size: "186 KB" },
  { name: "Cisco_Switch_Invoice_Apr2024.pdf", size: "94 KB" },
  { name: "FCDL_FY2022.pdf", size: "1.2 MB" },
  { name: "RFP_Internal_Connections_2025.docx", size: "326 KB" },
  { name: "BEAR_Form_472_FY2023.pdf", size: "208 KB" },
  { name: "tech_plan_v3_FINAL.docx", size: "892 KB" },
  { name: "Service_Provider_Agreement_Lumen.pdf", size: "1.4 MB" },
  { name: "site_photos_main_campus.jpg", size: "3.1 MB" },
  { name: "Lumen_WAN_Proposal_2025.pdf", size: "742 KB" },
  { name: "Form_486_Service_Confirmation_2022.pdf", size: "164 KB" },
  { name: "USAC_Correspondence_PIA.eml", size: "28 KB" },
  { name: "CIPA_Attestation_2024.pdf", size: "112 KB" },
  { name: "Asset_Inventory_Network_Equipment.xlsx", size: "486 KB" },
];

const DOC_TYPES = {
  "Form 470": { color: "indigo", priority: "high" },
  "Form 471": { color: "indigo", priority: "high" },
  "Form 486": { color: "indigo", priority: "high" },
  "FCDL": { color: "emerald", priority: "high" },
  "BEAR Invoice": { color: "emerald", priority: "high" },
  "Vendor Bid": { color: "amber", priority: "high" },
  "Vendor Contract": { color: "violet", priority: "high" },
  "Board Approval": { color: "rose", priority: "high" },
  "RFP": { color: "amber", priority: "high" },
  "CIPA Attestation": { color: "sky", priority: "high" },
  "Technology Plan": { color: "slate", priority: "medium" },
  "Asset Inventory": { color: "slate", priority: "medium" },
  "USAC Correspondence": { color: "slate", priority: "medium" },
  "Other": { color: "slate", priority: "low" },
  "Couldn't classify": { color: "slate", priority: "low" },
};

function classifyFile(filename) {
  const lower = filename.toLowerCase();
  let fy = null;
  const yearMatch = filename.match(/(?:fy)?20(1[7-9]|2[0-9])/i);
  if (yearMatch) fy = parseInt("20" + yearMatch[1], 10);

  if (/form[\s_-]*470|f470|470[\s_-]*app/i.test(lower)) {
    return { fy, type: "Form 470", confidence: "high" };
  }
  if (/form[\s_-]*471|f471|471[\s_-]*app/i.test(lower)) {
    return { fy, type: "Form 471", confidence: "high" };
  }
  if (/form[\s_-]*486|f486|service[\s_-]*confirm/i.test(lower)) {
    return { fy, type: "Form 486", confidence: "high" };
  }
  if (/fcdl|funding[\s_-]*commit/i.test(lower)) {
    return { fy, type: "FCDL", confidence: "high" };
  }
  if (/bear|form[\s_-]*472|reimburse/i.test(lower)) {
    return { fy, type: "BEAR Invoice", confidence: "high" };
  }
  if (/quote|proposal|bid/i.test(lower)) {
    return { fy, type: "Vendor Bid", confidence: "high" };
  }
  if (/contract|agreement|sla/i.test(lower)) {
    return { fy, type: "Vendor Contract", confidence: "medium" };
  }
  if (/board|approv|resolution|minutes/i.test(lower)) {
    return { fy, type: "Board Approval", confidence: "high" };
  }
  if (/rfp|request[\s_-]*for[\s_-]*proposal/i.test(lower)) {
    return { fy, type: "RFP", confidence: "high" };
  }
  if (/cipa|filtering|internet[\s_-]*safety/i.test(lower)) {
    return { fy, type: "CIPA Attestation", confidence: "high" };
  }
  if (/tech(nology)?[\s_-]*plan/i.test(lower)) {
    return { fy, type: "Technology Plan", confidence: "medium" };
  }
  if (/inventory|asset/i.test(lower)) {
    return { fy, type: "Asset Inventory", confidence: "medium" };
  }
  if (/usac|pia|correspondence|\.eml$/i.test(lower)) {
    return { fy, type: "USAC Correspondence", confidence: "medium" };
  }
  if (/\.(jpg|jpeg|png|gif|heic)$/i.test(lower)) {
    return { fy: null, type: "Couldn't classify", confidence: "low" };
  }
  return { fy, type: "Other", confidence: "low" };
}

function fileIconFor(filename) {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|heic)$/i.test(lower)) return ImageIcon;
  if (/\.eml$/i.test(lower)) return Mail;
  if (/\.(xlsx?|csv)$/i.test(lower)) return FileSpreadsheet;
  return FileText;
}

const CONFIDENCE_STYLES = {
  high: { dot: "bg-emerald-500", label: "High confidence", text: "text-emerald-700" },
  medium: { dot: "bg-amber-500", label: "Needs review", text: "text-amber-700" },
  low: { dot: "bg-rose-500", label: "Couldn't classify", text: "text-rose-700" },
};

const TYPE_BADGE_STYLES = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

// Editable subset of DOC_TYPES — drops the "Couldn't classify" option so
// users always pick something meaningful. "Other" is kept as a fallback.
const EDITABLE_TYPES = Object.keys(DOC_TYPES).filter(
  (t) => t !== "Couldn't classify"
);

const EDITABLE_FYS = FUNDING_YEARS.map((y) => y.fy);

const STEP_META = {
  "enter-ben": { num: 1, label: "Connect your district" },
  confirm: { num: 1, label: "Connect your district" },
  loading: { num: 1, label: "Connect your district" },
  complete: { num: 1, label: "Connect your district" },
  documents: { num: 2, label: "Upload historical documents" },
  "documents-done": { num: 2, label: "Upload historical documents" },
};

export default function ERateOnboarding() {
  const [step, setStep] = useState("enter-ben");
  const [searchValue, setSearchValue] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loadedYears, setLoadedYears] = useState([]);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedYear, setSelectedYear] = useState(null);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ type: "Other", fy: "" });

  // Close drawer on ESC
  useEffect(() => {
    if (!selectedYear) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedYear(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedYear]);

  const filteredDistricts =
    searchValue.length > 0
      ? DISTRICTS.filter(
          (d) =>
            d.ben.includes(searchValue) ||
            d.name.toLowerCase().includes(searchValue.toLowerCase())
        )
      : [];

  // Drive the loading animation: years populate one by one.
  useEffect(() => {
    if (step !== "loading") return;
    let cancelled = false;
    let i = 0;

    const tick = () => {
      if (cancelled) return;
      if (i < FUNDING_YEARS.length) {
        // Derive the next item from prev.length inside the updater so it's
        // immune to React 18's batched-flush closure-capture of `i`.
        setLoadedYears((prev) => {
          const nextIdx = prev.length;
          if (nextIdx >= FUNDING_YEARS.length) return prev;
          const nextYear = FUNDING_YEARS[nextIdx];
          if (!nextYear) return prev;
          return [...prev, nextYear];
        });
        setLoadProgress(((i + 1) / FUNDING_YEARS.length) * 100);
        i += 1;
        setTimeout(tick, 420);
      } else {
        setTimeout(() => {
          if (!cancelled) setStep("complete");
        }, 600);
      }
    };

    setTimeout(tick, 400);
    return () => {
      cancelled = true;
    };
  }, [step]);

  const safeYears = loadedYears.filter(Boolean);
  const totalCommitted = safeYears.reduce((s, y) => s + (y.committed || 0), 0);
  const totalDisbursed = safeYears.reduce((s, y) => s + (y.disbursed || 0), 0);
  const totalFrns = safeYears.reduce((s, y) => s + (y.frns || 0), 0);

  const handleSelectDistrict = (district) => {
    setSelectedDistrict(district);
    setSearchValue(district.name);
    setStep("confirm");
  };

  const handleConfirm = () => {
    setLoadedYears([]);
    setLoadProgress(0);
    setStep("loading");
  };

  const handleStartOver = () => {
    setStep("enter-ben");
    setSearchValue("");
    setSelectedDistrict(null);
    setLoadedYears([]);
    setLoadProgress(0);
    setSelectedYear(null);
    setFiles([]);
    setIsDragging(false);
    setAcceptedAll(false);
    setEditingId(null);
  };

  /**
   * Open the inline editor for one file. Seeds the draft from the existing
   * classification so users can tweak (rather than re-pick from scratch).
   */
  const handleStartEdit = (file) => {
    const cls = file.classification;
    setEditDraft({
      type: cls?.type && cls.type !== "Couldn't classify" ? cls.type : "Other",
      fy: cls?.fy ? String(cls.fy) : "",
    });
    setEditingId(file.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  /**
   * Commit the draft to the file. Saving is treated as user-confirmed, so the
   * row is also marked accepted and confidence is bumped to "high".
   */
  const handleSaveEdit = (fileId) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const fyNum = editDraft.fy ? parseInt(editDraft.fy, 10) : null;
        return {
          ...f,
          status: "classified",
          accepted: true,
          classification: {
            type: editDraft.type,
            fy: Number.isFinite(fyNum) ? fyNum : null,
            confidence: "high",
          },
        };
      })
    );
    setEditingId(null);
  };

  const addFiles = (incoming) => {
    const stamp = Date.now();
    const newFiles = incoming.map((f, i) => ({
      id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      size: f.size,
      status: "analyzing",
      classification: null,
      accepted: false,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Simulate AI classification staggered per file
    newFiles.forEach((f, idx) => {
      const delay = 600 + idx * 220 + Math.random() * 400;
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((existing) =>
            existing.id === f.id
              ? {
                  ...existing,
                  status: "classified",
                  classification: classifyFile(f.name),
                }
              : existing
          )
        );
      }, delay);
    });
  };

  const handleSampleFiles = () => {
    addFiles(SAMPLE_FILES);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer?.files || []).map((f) => ({
      name: f.name,
      size: f.size > 1024 * 1024
        ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(f.size / 1024)} KB`,
    }));
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleAcceptAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, accepted: true })));
    setAcceptedAll(true);
  };

  const handleClearFiles = () => {
    setFiles([]);
    setAcceptedAll(false);
  };

  const classifiedCount = files.filter((f) => f.status === "classified").length;
  const analyzingCount = files.filter((f) => f.status === "analyzing").length;
  const highCount = files.filter(
    (f) => f.classification?.confidence === "high"
  ).length;
  const reviewCount = files.filter(
    (f) =>
      f.classification?.confidence === "medium" ||
      f.classification?.confidence === "low"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 leading-tight">
                Lionheart
              </div>
              <div className="text-xs text-slate-500 leading-tight">
                E-rate Setup
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-700 font-medium">
              Step {STEP_META[step]?.num || 1} of 4
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">
              {STEP_META[step]?.label || "Connect your district"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Step 1: Enter BEN */}
        {step === "enter-ben" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Let's pull in your E-rate history
              </h1>
              <p className="mt-3 text-slate-600 leading-relaxed text-base">
                Enter your district's{" "}
                <span className="font-medium text-slate-900">
                  Billed Entity Number (BEN)
                </span>{" "}
                and we'll automatically import the last 10 years of public USAC
                records. No EPC login required.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Find your district
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Type a BEN or district name…"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 placeholder-slate-400"
                  autoFocus
                />
              </div>

              {filteredDistricts.length > 0 && (
                <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {filteredDistricts.map((d) => (
                    <button
                      key={d.ben}
                      onClick={() => handleSelectDistrict(d)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {d.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          BEN {d.ben} · {d.city} ·{" "}
                          {d.students.toLocaleString()} students
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {searchValue.length > 0 && filteredDistricts.length === 0 && (
                <div className="mt-3 text-sm text-slate-500 px-1">
                  No matches. Try a partial name like "Linfield" or
                  "Riverside".
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                <p>
                  We pull data from the public USAC Open Data portal — the
                  same dataset auditors and the FCC use. Lionheart never asks
                  for your EPC password.
                </p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-400 text-center">
              Try:{" "}
              <button
                onClick={() => setSearchValue("Linfield")}
                className="text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors duration-200"
              >
                Linfield
              </button>
              {" · "}
              <button
                onClick={() => setSearchValue("Riverside")}
                className="text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors duration-200"
              >
                Riverside
              </button>
              {" · "}
              <button
                onClick={() => setSearchValue("16012347")}
                className="text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors duration-200"
              >
                16012347
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && selectedDistrict && (
          <div>
            <div className="mb-6">
              <button
                onClick={handleStartOver}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer transition-colors duration-200"
              >
                ← Change district
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Confirm district
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900 mt-1">
                    {selectedDistrict.name}
                  </h2>
                  <div className="text-sm text-slate-600 mt-1">
                    BEN{" "}
                    <span className="font-mono font-medium text-slate-900">
                      {selectedDistrict.ben}
                    </span>{" "}
                    · {selectedDistrict.city} ·{" "}
                    {selectedDistrict.students.toLocaleString()} students
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-700 leading-relaxed">
                    We'll import this district's{" "}
                    <span className="font-semibold">last 10 years</span> of
                    E-rate records — every certified Form 470 and 471, every
                    FRN, commitment, and disbursement on file with USAC.
                    <div className="text-xs text-slate-500 mt-1.5">
                      Estimated time: under a minute.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-slate-900 text-white px-5 py-3 rounded-lg font-medium hover:bg-slate-800 cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  Import 10 years of history
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStartOver}
                  className="px-5 py-3 rounded-lg font-medium text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Steps 3 & 4: Loading and Complete (shared layout) */}
        {(step === "loading" || step === "complete") && selectedDistrict && (
          <div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedDistrict.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      BEN {selectedDistrict.ben}
                    </div>
                  </div>
                </div>
                {step === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-indigo-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing from USAC Open Data…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Import complete</span>
                  </div>
                )}
              </div>

              {step === "loading" && (
                <div className="mt-4">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 ease-out"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>
                      {loadedYears.length} of {FUNDING_YEARS.length} funding
                      years loaded
                    </span>
                    <span>{Math.round(loadProgress)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Summary stats (grow during load, settle when complete) */}
            {safeYears.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Years loaded
                  </div>
                  <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
                    {safeYears.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    FY{safeYears[0].fy} – FY
                    {safeYears[safeYears.length - 1].fy}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Funding requests
                  </div>
                  <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
                    {totalFrns}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    FRNs across all years
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-5">
                  <div className="text-xs text-indigo-700 uppercase tracking-wider font-medium">
                    Total committed
                  </div>
                  <div className="mt-1.5 text-2xl font-semibold text-indigo-900 tabular-nums">
                    {formatMoney(totalCommitted)}
                  </div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    {formatMoney(totalDisbursed)} disbursed
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Funding history
                </h3>
                <span className="text-xs text-slate-500">Newest first</span>
              </div>

              <div className="space-y-3">
                {[...safeYears].reverse().map((year, idx, arr) => {
                  const s = STATUS_STYLES[year.status];
                  const isLast = idx === arr.length - 1;
                  const showLine =
                    !isLast ||
                    (step === "loading" &&
                      loadedYears.length < FUNDING_YEARS.length);
                  const isNewest =
                    idx === 0 &&
                    step === "loading" &&
                    safeYears.length < FUNDING_YEARS.length;

                  return (
                    <div key={year.fy} className="flex items-stretch gap-4">
                      <div className="flex flex-col items-center pt-3">
                        <div
                          className={`w-4 h-4 rounded-full ${s.dot} ring-4 ring-white ${
                            isNewest ? "animate-pulse" : ""
                          }`}
                        />
                        {showLine && (
                          <div className="w-px flex-1 bg-slate-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <button
                          type="button"
                          onClick={() => setSelectedYear(year)}
                          className="w-full text-left flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="text-center">
                              <div className="text-xs text-slate-500 font-medium">
                                FY
                              </div>
                              <div className="text-lg font-semibold text-slate-900 tabular-nums leading-none">
                                {year.fy}
                              </div>
                            </div>
                            <div className="h-10 w-px bg-slate-200" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-900">
                                  {year.frns} FRN
                                  {year.frns !== 1 ? "s" : ""}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}
                                >
                                  {s.label}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                C1 {formatMoney(year.c1)} · C2{" "}
                                {formatMoney(year.c2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900 tabular-nums">
                                {formatMoney(year.committed)}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {formatMoney(year.disbursed)} disbursed
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {step === "loading" &&
                  safeYears.length < FUNDING_YEARS.length && (
                    <div className="flex items-stretch gap-4">
                      <div className="flex flex-col items-center pt-3">
                        <div className="w-4 h-4 rounded-full bg-slate-200 ring-4 ring-white animate-pulse" />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="p-4 rounded-lg border border-slate-100 bg-slate-50 animate-pulse">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="h-4 w-24 bg-slate-200 rounded" />
                              <div className="h-3 w-40 bg-slate-200 rounded" />
                            </div>
                            <div className="h-4 w-20 bg-slate-200 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {step === "loading" && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                  <p>
                    Cross-referencing FRNs, commitments, and disbursements
                    against your school inventory…
                  </p>
                </div>
              )}
            </div>

            {/* Continue card */}
            {step === "complete" && (
              <div className="mt-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">
                      10 years imported, ready to continue
                    </div>
                    <div className="text-sm text-slate-700 mt-1 leading-relaxed">
                      Next we'll let you drag in your historical documents —
                      board approvals, contracts, vendor bids — and Lionheart
                      will sort them into the right funding years for you.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => setStep("documents")}
                        className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 cursor-pointer transition-colors duration-200 flex items-center gap-2"
                      >
                        Continue to documents
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleStartOver}
                        className="px-5 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-white cursor-pointer transition-colors duration-200"
                      >
                        Start over
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Documents — drag, drop, AI classify */}
        {step === "documents" && selectedDistrict && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setStep("complete")}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer transition-colors duration-200 flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to funding history
              </button>
            </div>

            <div className="mb-8">
              <div className="text-xs text-indigo-600 uppercase tracking-wider font-medium mb-2">
                Step 2 — Documents
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Drop in your historical paperwork
              </h1>
              <p className="mt-3 text-slate-600 leading-relaxed text-base">
                Drag files in — board approvals, vendor bids, contracts, FCDLs,
                BEAR invoices. We'll read each one, identify the document type
                and funding year, and file it under the right FRN. You stay in
                control: review what we suggest, accept the good ones, fix the
                rest.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!isDragging) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <div className="mt-4 text-lg font-semibold text-slate-900">
                {isDragging ? "Drop to classify" : "Drag files anywhere here"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                PDFs, Word docs, spreadsheets, emails, photos — bring it all in.
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleSampleFiles}
                  className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 cursor-pointer transition-colors duration-200 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Try with sample files
                </button>
                <span className="text-xs text-slate-400">
                  Demo only — no real upload happens
                </span>
              </div>
            </div>

            {/* Summary stats */}
            {files.length > 0 && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Uploaded
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                    {files.length}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Analyzing
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums flex items-center gap-2">
                    {analyzingCount}
                    {analyzingCount > 0 && (
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    )}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider font-medium">
                    High confidence
                  </div>
                  <div className="mt-1 text-xl font-semibold text-emerald-900 tabular-nums">
                    {highCount}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 uppercase tracking-wider font-medium">
                    Needs review
                  </div>
                  <div className="mt-1 text-xl font-semibold text-amber-900 tabular-nums">
                    {reviewCount}
                  </div>
                </div>
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Suggested classifications
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Review each one — accept, edit, or remove.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearFiles}
                      className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer transition-colors duration-200 px-3 py-1.5 rounded-md hover:bg-slate-100"
                    >
                      Clear all
                    </button>
                    {classifiedCount > 0 && !acceptedAll && (
                      <button
                        onClick={handleAcceptAll}
                        className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer transition-colors duration-200 px-3 py-1.5 rounded-md flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept all suggestions
                      </button>
                    )}
                    {acceptedAll && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All accepted
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {files.map((file) => {
                    const Icon = fileIconFor(file.name);
                    const isAnalyzing = file.status === "analyzing";
                    const cls = file.classification;
                    const conf = cls && CONFIDENCE_STYLES[cls.confidence];
                    const typeMeta = cls && DOC_TYPES[cls.type];
                    const badgeStyle =
                      typeMeta && TYPE_BADGE_STYLES[typeMeta.color];
                    const isEditing = editingId === file.id;

                    if (isEditing) {
                      return (
                        <div
                          key={file.id}
                          className="px-6 py-4 bg-indigo-50 bg-opacity-40 border-l-4 border-indigo-500"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-indigo-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {file.name}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {file.size} · Editing classification
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-xs font-medium text-slate-700 block mb-1">
                                Document type
                              </label>
                              <select
                                value={editDraft.type}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    type: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                              >
                                {EDITABLE_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-700 block mb-1">
                                Funding year
                              </label>
                              <select
                                value={editDraft.fy}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    fy: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                              >
                                <option value="">Unknown / not yet known</option>
                                {EDITABLE_FYS.map((fy) => (
                                  <option key={fy} value={fy}>
                                    FY{fy}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={handleCancelEdit}
                              className="text-xs font-medium text-slate-700 hover:bg-white px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-200 border border-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(file.id)}
                              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-200 flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save & accept
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-4 px-6 py-3.5 transition-colors duration-200 ${
                          file.accepted ? "bg-emerald-50 bg-opacity-30" : ""
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            file.accepted
                              ? "bg-emerald-100"
                              : "bg-slate-100"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 ${
                              file.accepted
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {file.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{file.size}</span>
                            {isAnalyzing && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-indigo-600 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Reading & classifying…
                                </span>
                              </>
                            )}
                            {cls && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className={conf.text}>
                                  <span
                                    className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${conf.dot}`}
                                  />
                                  {conf.label}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {cls && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-md border ${badgeStyle}`}
                            >
                              {cls.type}
                            </span>
                            {cls.fy && (
                              <span className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md tabular-nums">
                                FY{cls.fy}
                              </span>
                            )}
                            {!cls.fy && cls.confidence !== "low" && (
                              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" />
                                Year?
                              </span>
                            )}
                          </div>
                        )}

                        {cls && !file.accepted && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                setFiles((prev) =>
                                  prev.map((x) =>
                                    x.id === file.id
                                      ? { ...x, accepted: true }
                                      : x
                                  )
                                )
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer transition-colors duration-200"
                              aria-label="Accept"
                              title="Accept"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(file)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors duration-200"
                              aria-label="Edit"
                              title="Edit classification"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setFiles((prev) =>
                                  prev.filter((x) => x.id !== file.id)
                                )
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors duration-200"
                              aria-label="Remove"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {file.accepted && (
                          <div className="flex items-center gap-1 flex-shrink-0 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state hint */}
            {files.length === 0 && (
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  <span className="font-medium text-slate-900">
                    Nothing here yet.
                  </span>{" "}
                  Drop a few documents above — or hit{" "}
                  <span className="font-medium text-slate-900">
                    Try with sample files
                  </span>{" "}
                  to see how Lionheart reads, identifies, and files them. You'll
                  always get a chance to review before anything is saved.
                </div>
              </div>
            )}

            {/* Footer continue */}
            <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-slate-500 flex items-start gap-2 max-w-md">
                <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Documents are stored encrypted and tagged with a 10-year
                  retention date — the FCC's record-keeping rule for E-rate.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartOver}
                  className="px-5 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-white border border-slate-200 cursor-pointer transition-colors duration-200"
                >
                  Start over
                </button>
                <button
                  disabled={files.length === 0}
                  className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 cursor-pointer transition-colors duration-200 flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Finish setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Funding-year detail drawer */}
      {selectedYear && selectedDistrict && (
        <YearDrawer
          year={selectedYear}
          district={selectedDistrict}
          onClose={() => setSelectedYear(null)}
        />
      )}
    </div>
  );
}

function YearDrawer({ year, district, onClose }) {
  const s = STATUS_STYLES[year.status];
  const frns = getFrnsForYear(year);
  const documents = getDocumentsForYear(year);
  const milestones = getMilestonesForYear(year);
  const discountRate = 80; // demo value
  const remaining = year.committed - year.disbursed;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        className="fixed inset-0 bg-slate-900 bg-opacity-40 z-20 cursor-pointer"
      />
      {/* Panel */}
      <aside className="fixed top-0 right-0 h-full w-full sm:max-w-xl bg-white shadow-2xl z-30 flex flex-col">
        {/* Sticky header */}
        <div className="flex items-start justify-between gap-3 p-6 border-b border-slate-200 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Funding Year {year.fy}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900">
                {district.name}
              </h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}
              >
                {s.label}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono">
              BEN {district.ben}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary tiles */}
          <div className="p-6 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Committed
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {formatMoney(year.committed)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Disbursed
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {formatMoney(year.disbursed)}
              </div>
              {remaining > 0 && (
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {formatMoney(remaining)} remaining
                </div>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Funding requests
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {year.frns}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                C1 {formatMoney(year.c1)} · C2 {formatMoney(year.c2)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Discount rate
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {discountRate}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Based on NSLP %
              </div>
            </div>
          </div>

          {/* FRNs */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Funding Request Numbers
              </h3>
              <span className="text-xs text-slate-500">
                {frns.length} FRN{frns.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {frns.map((frn) => {
                const Icon = FRN_ICON[frn.iconKey] || Server;
                return (
                  <div
                    key={frn.id}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            frn.category === "C1"
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-violet-50 text-violet-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">
                            {frn.service}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {frn.vendor}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">
                              FRN {frn.id}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                frn.category === "C1"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-violet-50 text-violet-700"
                              }`}
                            >
                              {frn.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-slate-900 tabular-nums">
                          {formatMoney(frn.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestones */}
          <div className="px-6 pb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Application timeline
            </h3>
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              {milestones.map((m, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      m.done ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  >
                    {m.done ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span
                      className={`text-sm ${
                        m.done ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {m.label}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {m.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Documents
              </h3>
              <span className="text-xs text-slate-500">
                Retained until 20{(parseInt(year.fy.toString().slice(-2), 10) + 11).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileCheck2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {doc.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {doc.type} · {doc.size}
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer transition-colors duration-200"
          >
            <ExternalLink className="w-4 h-4" />
            Open in EPC
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-800 cursor-pointer transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
