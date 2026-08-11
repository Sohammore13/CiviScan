import { motion } from "motion/react";
import {
  MessagesSquare,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Skull,
  HeartPulse,
  Type,
  Quote,
  Bot,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/civiscan";
import { AnalyticsPie } from "./AnalyticsPie";
import { CommentsTable } from "./CommentsTable";

type DashboardResult = AnalysisResult & {
  video: { thumbnail: string; title: string; channel: string };
  healthScore: number;
  mostHarmfulWord: string;
  mostToxicComment?: { text: string; score: number };
  summary: string;
};

function VideoCard({ result }: { result: DashboardResult }) {
  return (
    <div className="glass flex flex-col gap-5 rounded-3xl p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:p-6">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl sm:w-64">
        <img
          src={result.video.thumbnail}
          alt={result.video.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.background = "var(--muted)";
          }}
        />
      </div>
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.68_0.16_162_/_0.15)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.45_0.14_162)]">
          <ShieldCheck className="h-3.5 w-3.5" /> Analysis complete
        </span>
        <h2 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{result.video.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{result.video.channel}</p>
        <p className="mt-3 text-sm">
          <span className="font-bold text-foreground">{result.total}</span>{" "}
          <span className="text-muted-foreground">comments analyzed</span>
        </p>
      </div>
    </div>
  );
}

const STAT_DEFS = [
  { key: "total", label: "Total Comments", icon: MessagesSquare, color: "var(--primary)" },
  { key: "Safe", label: "Safe Comments", icon: ShieldCheck, color: "var(--safe)" },
  { key: "Toxic", label: "Toxic Comments", icon: Flame, color: "var(--toxic)" },
  { key: "Offensive", label: "Offensive Comments", icon: AlertTriangle, color: "var(--offensive)" },
  { key: "Cyberbullying", label: "Cyberbullying", icon: Skull, color: "var(--bully)" },
] as const;

function StatsGrid({ result }: { result: DashboardResult }) {
  const valueFor = (k: string) =>
    k === "total" ? result.total : result.counts[k as keyof typeof result.counts];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {STAT_DEFS.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass group rounded-2xl p-5 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-1"
          >
            <div
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: `color-mix(in oklab, ${s.color} 16%, transparent)` }}
            >
              <Icon className="h-5 w-5" style={{ color: s.color }} />
            </div>
            <div className="mt-4 text-3xl font-extrabold tabular-nums">{valueFor(s.key)}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function InsightsPanel({ result }: { result: DashboardResult }) {
  const health = result.healthScore;
  const healthColor = health >= 75 ? "var(--safe)" : health >= 50 ? "var(--offensive)" : "var(--toxic)";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="glass flex flex-col items-center justify-center rounded-3xl p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="relative grid h-40 w-40 place-items-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="9" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={healthColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - (264 * health) / 100 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <HeartPulse className="h-5 w-5" style={{ color: healthColor }} />
            <span className="mt-1 text-3xl font-extrabold tabular-nums">{health}</span>
          </div>
        </div>
        <h3 className="mt-5 text-lg font-bold">Community Health Score</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {health >= 75 ? "Healthy & supportive" : health >= 50 ? "Needs monitoring" : "High risk — moderate now"}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="glass rounded-3xl p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Type className="h-4 w-4 text-toxic" /> Most Harmful Word
            </div>
            <p className="mt-3 text-2xl font-extrabold text-toxic">“{result.mostHarmfulWord}”</p>
          </div>
          <div className="glass rounded-3xl p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Quote className="h-4 w-4 text-bully" /> Most Toxic Comment
            </div>
            <p className="mt-3 line-clamp-3 text-sm font-medium text-foreground">
              {result.mostToxicComment?.text ?? "None detected"}
            </p>
            {result.mostToxicComment && (
              <p className="mt-2 text-xs font-semibold text-toxic">
                {result.mostToxicComment.score}% toxicity
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </span>
            Moderation Summary
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ result }: { result: DashboardResult }) {
  return (
    <section id="analytics" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-10"
      >
        <VideoCard result={result} />
        <StatsGrid result={result} />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <AnalyticsPie result={result} />
          </div>
          <div className="lg:col-span-3">
            <CommentsTable result={result} />
          </div>
        </div>
        <InsightsPanel result={result} />
      </motion.div>
    </section>
  );
}
