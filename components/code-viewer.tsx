import { CopyButton } from "@/components/copy-button";

export function CodeViewer({
  code,
  title = "Code",
}: {
  code: string;
  title?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <CopyButton value={code} />
      </div>
      <pre className="max-h-[28rem] overflow-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </section>
  );
}
