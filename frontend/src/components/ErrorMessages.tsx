import { cn } from "@/lib/utils";

export function ErrorMessages({ message, className }: { message: string; className?: string }) {
  const lines = (message ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  if (lines.length === 1) {
    return <span className={cn("whitespace-pre-wrap", className)}>{lines[0]}</span>;
  }

  return (
    <ul className={cn("list-disc space-y-1 pl-5", className)}>
      {lines.map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ul>
  );
}
