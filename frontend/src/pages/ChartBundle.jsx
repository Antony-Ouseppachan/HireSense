import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const axisStyle = { fontSize: 12, fill: "#94a3b8" };
const tooltipStyle = {
  backgroundColor: "#0b1220",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e2e8f0",
  fontSize: 13,
};

function PieView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95}
          paddingAngle={3} stroke="rgba(255,255,255,0.08)">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} />
        <Legend wrapperStyle={{ fontSize: 13, color: "#cbd5e1" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarTick({ x, y, payload }) {
  const name = String(payload.value || "");
  const words = name.split(" ").filter(Boolean);
  let line1 = name, line2 = "";
  if (words.length > 1) {
    const half = Math.ceil(name.length / 2);
    let acc = "";
    for (const w of words) {
      const next = (acc + " " + w).trim();
      if (!acc || next.length <= half) acc = next;
      else break;
    }
    line1 = acc || words[0];
    line2 = name.slice(line1.length).trim();
  }
  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="#94a3b8" fontSize={11}>
      <tspan x={x} dy={0}>{line1}</tspan>
      {line2 && <tspan x={x} dy={13}>{line2}</tspan>}
    </text>
  );
}

function BarView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 8 }} barSize={26}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={<BarTick />} axisLine={false} tickLine={false} interval={0} height={60} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(56,189,248,0.08)" }} formatter={(v) => [`${Math.round(v)}%`, "Score"]} />
        <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill="url(#topicGrad)" />)}
        </Bar>
        <defs>
          <linearGradient id="topicGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RadarView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="subject" tick={axisStyle} />
        <PolarRadiusAxis angle={90} tick={false} axisLine={false} domain={[0, 100]} />
        <Radar name="Score" dataKey="value" stroke="#38bdf8" fill="#6366f1" fillOpacity={0.35} strokeWidth={2} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(v)}`, "Score"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default function ChartBundle({ type, data }) {
  if (!data || !data.length) return null;
  if (type === "pie") return <PieView data={data} />;
  if (type === "bar") return <BarView data={data} />;
  if (type === "radar") return <RadarView data={data} />;
  return null;
}