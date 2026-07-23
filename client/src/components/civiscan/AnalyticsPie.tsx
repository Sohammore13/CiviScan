import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "motion/react";
import type { AnalysisResult, Category } from "@/lib/civiscan";
import { CATEGORY_COLORS } from "@/lib/civiscan";

export function AnalyticsPie({ result }: { result: AnalysisResult }) {
  const data = (Object.keys(result.counts) as Category[]).map((k) => ({
    name: k,
    value: result.counts[k],
  }));

  const safePct = Math.round((result.counts.Safe / result.total) * 100);

  return (
    <div className="glass rounded-3xl p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <h3 className="text-xl font-bold">Comment Classification</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Real-time AI breakdown across all analyzed comments
      </p>

      <div className="relative mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={78}
              outerRadius={120}
              paddingAngle={3}
              stroke="none"
              animationDuration={900}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as Category]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--card-foreground)",
                fontSize: 13,
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(v) => <span className="text-sm text-foreground">{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="pointer-events-none absolute inset-x-0 top-[42%] -translate-y-1/2 text-center"
        >
          <div className="text-4xl font-extrabold text-gradient">{safePct}%</div>
          <div className="text-xs font-medium text-muted-foreground">Safe</div>
        </motion.div>
      </div>
    </div>
  );
}

