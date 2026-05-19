"use client";

import { Button } from "@/components/Button";
import {
  FIELD_LABELS,
  MAPPABLE_FIELDS,
  type Mapping,
  suggestField,
} from "@/lib/importMapping";
import Papa, { type ParseError } from "papaparse";
import { useMemo, useRef, useState, type RefObject } from "react";

type Step = "pick" | "map" | "submitting" | "summary";

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface ImportResponse {
  ok?: boolean;
  error?: string;
  total?: number;
  inserted?: number;
  skipped?: number;
  by_reason?: { reason: string; count: number }[];
}

const PREVIEW_ROWS = 5;
const REASON_LABELS: Record<string, string> = {
  no_phone: "No phone number",
  not_mobile: "Not mobile (landline / other)",
  bad_owner_name: "Bad owner name",
  keyword_blocklist: "Keyword blocklisted",
  duplicate_phone: "Duplicate phone",
};

export function BulkUploadForm() {
  const [step, setStep] = useState<Step>("pick");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, Mapping>>({});
  const [parseError, setParseError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("pick");
    setParsed(null);
    setMapping({});
    setParseError("");
    setSubmitError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFileSelected(file: File) {
    setParseError("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please choose a .csv file.");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers =
          (res.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
        const rows = (res.data ?? []).filter(
          (r) => r && typeof r === "object",
        ) as Record<string, string>[];

        if (!headers.length) {
          setParseError("CSV has no header row.");
          return;
        }
        if (!rows.length) {
          setParseError("CSV has no data rows.");
          return;
        }

        const initialMapping: Record<string, Mapping> = {};
        const used = new Set<string>();
        for (const h of headers) {
          const guess = suggestField(h);
          if (guess && !used.has(guess)) {
            initialMapping[h] = guess;
            used.add(guess);
          } else {
            initialMapping[h] = "ignore";
          }
        }

        setParsed({ fileName: file.name, headers, rows });
        setMapping(initialMapping);
        setStep("map");
      },
      error: (err: Error | ParseError) => {
        setParseError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  const phoneMapped = useMemo(
    () => Object.values(mapping).some((m) => m === "owner_number"),
    [mapping],
  );

  const phoneTypeMapped = useMemo(
    () => Object.values(mapping).some((m) => m === "phone_type"),
    [mapping],
  );

  const canImport = phoneMapped && phoneTypeMapped;

  const fieldUseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of Object.values(mapping)) {
      if (v === "ignore") continue;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  }, [mapping]);

  const duplicateFields = useMemo(
    () =>
      Object.entries(fieldUseCounts)
        .filter(([, n]) => n > 1)
        .map(([f]) => f),
    [fieldUseCounts],
  );

  const previewRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.slice(0, PREVIEW_ROWS).map((row) => {
      const out: Record<string, string> = {};
      for (const header of parsed.headers) {
        const target = mapping[header];
        if (!target || target === "ignore") continue;
        const cell = (row[header] ?? "").toString().trim();
        if (cell.length === 0) continue;
        out[target] = out[target] ? `${out[target]} | ${cell}` : cell;
      }
      if (!out.owner_number) {
        for (const header of parsed.headers) {
          if (suggestField(header) !== "owner_number") continue;
          const cell = (row[header] ?? "").toString().trim();
          if (cell.length > 0) {
            out.owner_number = cell;
            break;
          }
        }
      }
      if (!out.phone_type) {
        for (const header of parsed.headers) {
          if (suggestField(header) !== "phone_type") continue;
          const cell = (row[header] ?? "").toString().trim();
          if (cell.length > 0) {
            out.phone_type = cell;
            break;
          }
        }
      }
      return out;
    });
  }, [parsed, mapping]);

  const previewColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const r of previewRows) for (const k of Object.keys(r)) cols.add(k);
    const ordered = MAPPABLE_FIELDS.filter((f) => cols.has(f));
    const pinned: typeof ordered = [];
    if (ordered.includes("owner_number")) pinned.push("owner_number");
    if (ordered.includes("phone_type")) pinned.push("phone_type");
    if (pinned.length) {
      return [
        ...pinned,
        ...ordered.filter((f) => !pinned.includes(f)),
      ] as typeof ordered;
    }
    return ordered;
  }, [previewRows]);

  async function submit() {
    if (!parsed) return;
    if (!canImport) return;
    setSubmitError("");
    setStep("submitting");

    const payloadRows = parsed.rows.map((row) => {
      const out: Record<string, string | null> = {};
      for (const header of parsed.headers) {
        const target = mapping[header];
        if (!target || target === "ignore") continue;
        const cell = row[header];
        const v = cell == null ? "" : String(cell).trim();
        if (!v) continue;
        out[target] = out[target] ? `${out[target]} ${v}`.trim() : v;
      }
      return out;
    });

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const body = (await res.json().catch(() => ({}))) as ImportResponse;

      if (!res.ok || !body.ok) {
        setSubmitError(body.error ?? `Import failed (HTTP ${res.status})`);
        setStep("map");
        return;
      }

      setResult(body);
      setStep("summary");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
      setStep("map");
    }
  }

  if (step === "summary" && result) {
    return (
      <SummaryCard
        result={result}
        fileName={parsed?.fileName ?? ""}
        onReset={reset}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Step1Picker
        inputRef={fileInputRef}
        active={step === "pick"}
        parsed={parsed}
        parseError={parseError}
        onFileSelected={onFileSelected}
        onChangeFile={() => reset()}
      />

      {parsed && step !== "pick" ? (
        <>
          <Step2Mapping
            parsed={parsed}
            mapping={mapping}
            setMapping={setMapping}
            duplicateFields={duplicateFields}
          />
          <PreviewTable
            previewColumns={previewColumns}
            previewRows={previewRows}
            totalRows={parsed.rows.length}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!canImport || step === "submitting"}
              onClick={submit}
            >
              {step === "submitting"
                ? "Importing…"
                : `Import ${parsed.rows.length.toLocaleString()} row${parsed.rows.length === 1 ? "" : "s"}`}
            </Button>
            {!canImport ? (
              <p className="text-sm text-amber-700">
                Map columns to{" "}
                <strong>{FIELD_LABELS.owner_number}</strong> and{" "}
                <strong>{FIELD_LABELS.phone_type}</strong> to enable import.
                Only <strong>mobile</strong> / <strong>cell</strong> rows are
                uploaded; landlines and other types are skipped.
              </p>
            ) : null}
            {duplicateFields.length ? (
              <p className="text-sm text-amber-700">
                Multiple columns map to:{" "}
                {duplicateFields
                  .map((f) => FIELD_LABELS[f as keyof typeof FIELD_LABELS])
                  .join(", ")}{" "}
                — values will be joined per row.
              </p>
            ) : null}
            {submitError ? (
              <p className="text-sm text-red-700">{submitError}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Step1Picker({
  inputRef,
  active,
  parsed,
  parseError,
  onFileSelected,
  onChangeFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  active: boolean;
  parsed: ParsedFile | null;
  parseError: string;
  onFileSelected: (f: File) => void;
  onChangeFile: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">1. Pick a CSV file</h2>
      <p className="mt-1 text-sm text-stone-600">
        First row must contain headers. Any column you don&rsquo;t map will be ignored.
      </p>

      {parsed && !active ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-stone-50 px-4 py-3 text-sm">
          <span className="font-medium text-stone-900">{parsed.fileName}</span>
          <span className="text-stone-600">
            · {parsed.headers.length} columns · {parsed.rows.length.toLocaleString()} rows
          </span>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={onChangeFile}
          >
            Choose a different file
          </Button>
        </div>
      ) : (
        <div
          className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
            dragOver
              ? "border-[var(--accent)] bg-stone-50"
              : "border-stone-300 bg-stone-50/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFileSelected(file);
          }}
        >
          <p className="text-sm text-stone-700">
            Drag a CSV file here, or
          </p>
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
            }}
          />
        </div>
      )}

      {parseError ? (
        <p className="mt-3 text-sm text-red-700">{parseError}</p>
      ) : null}
    </section>
  );
}

function Step2Mapping({
  parsed,
  mapping,
  setMapping,
  duplicateFields,
}: {
  parsed: ParsedFile;
  mapping: Record<string, Mapping>;
  setMapping: (m: Record<string, Mapping>) => void;
  duplicateFields: string[];
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">2. Map columns</h2>
      <p className="mt-1 text-sm text-stone-600">
        Choose the lead field each CSV column should fill, or leave it as
        Ignore. Phone and phone type are required — only mobile/cell rows are
        imported.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="px-2 py-2 font-medium">CSV header</th>
              <th className="px-2 py-2 font-medium">Maps to</th>
              <th className="px-2 py-2 font-medium">Sample</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {parsed.headers.map((h) => {
              const sample = (parsed.rows[0]?.[h] ?? "").toString().trim();
              const isDup =
                mapping[h] !== "ignore" &&
                duplicateFields.includes(mapping[h] as string);
              return (
                <tr key={h}>
                  <td className="px-2 py-2 align-top font-medium text-stone-900">
                    {h}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select
                      className={`w-full rounded-lg border px-2 py-1.5 text-sm ${isDup ? "border-amber-400 bg-amber-50" : "border-stone-300"}`}
                      value={mapping[h] ?? "ignore"}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [h]: e.target.value as Mapping,
                        })
                      }
                    >
                      <option value="ignore">Ignore</option>
                      {MAPPABLE_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-xs truncate px-2 py-2 align-top text-stone-600">
                    {sample || <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewTable({
  previewColumns,
  previewRows,
  totalRows,
}: {
  previewColumns: readonly string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}) {
  if (!previewColumns.length) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">3. Preview</h2>
        <p className="mt-2 text-sm text-stone-600">
          Map at least one column to see a preview.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">3. Preview</h2>
      <p className="mt-1 text-sm text-stone-600">
        Showing first {Math.min(PREVIEW_ROWS, previewRows.length)} of{" "}
        {totalRows.toLocaleString()} rows after mapping.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              {previewColumns.map((c) => (
                <th key={c} className="px-2 py-2 font-medium">
                  {FIELD_LABELS[c as keyof typeof FIELD_LABELS]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {previewRows.map((r, i) => (
              <tr key={i}>
                {previewColumns.map((c) => (
                  <td
                    key={c}
                    className="max-w-xs truncate px-2 py-2 align-top text-stone-700"
                  >
                    {r[c] ?? <span className="text-stone-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  result,
  fileName,
  onReset,
}: {
  result: ImportResponse;
  fileName: string;
  onReset: () => void;
}) {
  const { total = 0, inserted = 0, skipped = 0, by_reason = [] } = result;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Import complete</h2>
      {fileName ? (
        <p className="mt-1 text-sm text-stone-600">From {fileName}</p>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Total rows" value={total} tone="neutral" />
        <Stat label="Inserted" value={inserted} tone="good" />
        <Stat label="Skipped" value={skipped} tone="warn" />
      </div>

      {by_reason.length ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-stone-700">Skip reasons</p>
          <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-100">
            {by_reason
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((r) => (
                <li
                  key={r.reason}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="text-stone-700">
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </span>
                  <span className="font-mono text-stone-900">{r.count}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={onReset}>
          Upload another file
        </Button>
        <a
          href="/leads"
          className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
        >
          View leads
        </a>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "neutral";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-stone-900";
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${toneCls}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
