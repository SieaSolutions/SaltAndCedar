import { BulkUploadForm } from "@/components/BulkUploadForm";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Bulk Upload</h1>
        <p className="mt-1 text-sm text-stone-600">
          Upload a CSV, map its columns to lead fields, and import. Rows go in
          as <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">status=&apos;New&apos;</code>{" "}
          with <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">source=&apos;CSV Import&apos;</code>.
          The same filters and dedupe used by the leadgen pipeline apply.
        </p>
      </div>

      <BulkUploadForm />
    </div>
  );
}
