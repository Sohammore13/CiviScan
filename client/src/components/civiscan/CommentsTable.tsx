import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import type { AnalysisResult, Category } from "@/lib/civiscan";
import { cn } from "@/lib/utils";

const CATEGORIES: ("All" | Category)[] = ["All", "Safe", "Toxic", "Offensive", "Cyberbullying"];

const BADGE: Record<Category, string> = {
  Safe: "bg-[oklch(0.68_0.16_162_/_0.15)] text-[oklch(0.45_0.14_162)]",
  Toxic: "bg-[oklch(0.58_0.23_25_/_0.15)] text-[oklch(0.5_0.2_25)]",
  Offensive: "bg-[oklch(0.72_0.18_70_/_0.18)] text-[oklch(0.5_0.14_70)]",
  Cyberbullying: "bg-[oklch(0.55_0.25_318_/_0.15)] text-[oklch(0.48_0.22_318)]",
};

function scoreColor(score: number) {
  if (score < 30) return "var(--safe, #10B981)";
  if (score < 60) return "var(--offensive, #6366F1)";
  return "var(--toxic, #EF4444)";
}

export function CommentsTable({ result }: { result: AnalysisResult }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Category>("All");
  const [sortDesc, setSortDesc] = useState(true);

  // Filters and sorts the comments securely based on search criteria and category toggles
  const rows = useMemo(() => {
    if (!result?.comments) return [];
    
    let r = result.comments.filter((c) =>
      c.text.toLowerCase().includes(query.toLowerCase()),
    );
    
    if (filter !== "All") {
      r = r.filter((c) => c.category === filter);
    }
    
    r = [...r].sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score));
    return r;
  }, [result?.comments, query, filter, sortDesc]);

  return (
    <div className="glass rounded-3xl p-6 shadow-[var(--shadow-soft)] sm:p-8">
      {/* Header Panel with Title and Search Bar */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">Comments Analysis</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} of {result?.total || 0} comments
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 border border-border/40">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search comments…"
            className="w-36 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-48"
          />
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === c
                ? "bg-[image:var(--gradient-primary)] bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Comments Table Interface */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3 pr-4 font-semibold">Comment</th>
              <th className="pb-3 pr-4 font-semibold">Classification</th>
              <th className="pb-3 pr-2 font-semibold">
                <button
                  onClick={() => setSortDesc((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Toxicity <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((c) => (
              <tr key={c.id} className="border-b border-border/60 align-top transition-colors hover:bg-accent/40">
                <td className="py-3 pr-4">
                  <p className="text-sm text-foreground break-words max-w-md">{c.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">@{c.author} · {c.likes} likes</p>
                </td>
                <td className="py-3 pr-4 vertical-align-middle">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", BADGE[c.category])}>
                    {c.category}
                  </span>
                </td>
                <td className="py-3 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.score}%`, background: scoreColor(c.score) }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(c.score) }}>
                      {c.score}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Empty State Block */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  No comments match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}