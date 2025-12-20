import { cn } from "@/lib/utils";

export function ErrorMessages({ message, className }: { message: string; className?: string }) {
  const lines = (message ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const containerClass = cn("max-h-64 overflow-y-auto break-words", className);

  if (lines.length === 1) {
    return (
      <div className={containerClass}>
        <span className="whitespace-pre-wrap">{lines[0]}</span>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <ul className="list-disc space-y-1 pl-5 whitespace-pre-wrap">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
