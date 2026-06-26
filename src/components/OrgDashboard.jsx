import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { CATEGORIES } from "../checklistTemplate";
import { useIsMobile } from "../useIsMobile";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export default function OrgDashboard({ session, org }) {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({});
  const [categoryStats, setCategoryStats] = useState({});
  const [milestones, setMilestones] = useState([]);
  const [milestoneChartData, setMilestoneChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchAll(); }, [org.id]);

  const fetchAll = async () => {
    setLoading(true);
    const { data: memberRows } = await supabase
      .from("project_members")
      .select("project_id, role, project:projects(id, name, organization_id)")
      .eq("user_id", session.user.id);

    const projs = (memberRows || [])
      .filter((r) => r.project?.organization_id === org.id && !r.project?.archived_at)
      .map((r) => ({ ...r.project, myRole: r.role }));
    setProjects(projs);

    if (!projs.length) { setLoading(false); return; }

    const ids = projs.map((p) => p.id);
    const { data: checklists } = await supabase
      .from("checklists").select("project_id, category, status").in("project_id", ids);

    const statsMap = {};
    const catMap = {};
    projs.forEach((p) => { statsMap[p.id] = { total: 0, complete: 0, na: 0, pending: 0 }; catMap[p.id] = {}; });
    (checklists || []).forEach((c) => {
      const s = statsMap[c.project_id]; if (!s) return;
      s.total++; s[c.status] = (s[c.status] || 0) + 1;
      const cs = catMap[c.project_id];
      if (!cs[c.category]) cs[c.category] = { total: 0, done: 0 };
      cs[c.category].total++;
      if (c.status === "complete" || c.status === "na") cs[c.category].done++;
    });
    setStats(statsMap);
    setCategoryStats(catMap);

    const today = new Date().toISOString().split("T")[0];
    // Upcoming milestones panel
    const { data: ms } = await supabase
      .from("project_milestones")
      .select("*, project:projects(name)")
      .in("project_id", ids)
      .gte("date", today)
      .order("date")
      .limit(10);
    setMilestones(ms || []);

    // Active milestone completion chart
    const { data: allMs } = await supabase
      .from("project_milestones")
      .select("id, project_id, name, date")
      .in("project_id", ids)
      .order("project_id").order("date");

    // Find active milestone per project
    const msByProject = {};
    (allMs || []).forEach((m) => {
      if (!msByProject[m.project_id]) msByProject[m.project_id] = [];
      msByProject[m.project_id].push(m);
    });
    const activeMsIds = [];
    const activeMsInfo = {}; // msId → { name, projectName }
    projs.forEach((p) => {
      const pMs = msByProject[p.id] || [];
      for (let i = 0; i < pMs.length; i++) {
        const prevDate = i > 0 ? pMs[i - 1].date : "0000-01-01";
        if (today > prevDate && today <= pMs[i].date) {
          activeMsIds.push(pMs[i].id);
          activeMsInfo[pMs[i].id] = { name: pMs[i].name, projectName: p.name };
          break;
        }
      }
    });

    if (activeMsIds.length > 0) {
      const { data: miRows } = await supabase
        .from("milestone_items")
        .select("milestone_id, checklist_item_id")
        .in("milestone_id", activeMsIds);
      const itemToMs = {};
      (miRows || []).forEach(({ milestone_id, checklist_item_id }) => {
        itemToMs[checklist_item_id] = milestone_id;
      });
      const allItemIds = Object.keys(itemToMs);
      let statusMap = {};
      if (allItemIds.length > 0) {
        const { data: clRows } = await supabase
          .from("checklists").select("id, status").in("id", allItemIds);
        (clRows || []).forEach((r) => { statusMap[r.id] = r.status; });
      }
      const msStats = {};
      activeMsIds.forEach((id) => { msStats[id] = { total: 0, complete: 0 }; });
      Object.entries(itemToMs).forEach(([itemId, msId]) => {
        if (!msStats[msId]) return;
        msStats[msId].total++;
        if (statusMap[itemId] === "complete") msStats[msId].complete++;
      });
      setMilestoneChartData(activeMsIds.map((id) => ({
        name: `${activeMsInfo[id].projectName} — ${activeMsInfo[id].name}`,
        Complete: msStats[id].complete,
        Remaining: msStats[id].total - msStats[id].complete,
        total: msStats[id].total,
        pct: msStats[id].total ? Math.round((msStats[id].complete / msStats[id].total) * 100) : 0,
      })).filter((d) => d.total > 0));
    }

    setLoading(false);
  };

  const overall = projects.reduce(
    (acc, p) => { const s = stats[p.id] || {}; acc.total += s.total || 0; acc.complete += s.complete || 0; acc.na += s.na || 0; acc.pending += s.pending || 0; return acc; },
    { total: 0, complete: 0, na: 0, pending: 0 }
  );
  // Progress = complete / applicable (total − na)
  const overallApplicable = overall.total - overall.na;
  const overallPct = overallApplicable ? Math.round((overall.complete / overallApplicable) * 100) : 0;

  const chartData = projects.map((p) => {
    const s = stats[p.id] || {};
    const applicable = (s.total || 0) - (s.na || 0) || 1;
    return {
      name: p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name,
      Complete: Math.round(((s.complete || 0) / applicable) * 100),
      Pending: Math.round(((s.pending || 0) / applicable) * 100),
    };
  });

  if (loading) return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--c-text-2)", fontFamily: "Manrope, sans-serif" }}>
      Loading dashboard...
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "32px 28px", maxWidth: "1100px", margin: "0 auto", fontFamily: "Manrope, sans-serif" }}>
      <h2 style={{ color: "var(--c-text)", margin: "0 0 24px", fontSize: isMobile ? "18px" : "22px", fontWeight: "700" }}>
        Dashboard
      </h2>

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-3)" }}>
          <p style={{ fontSize: "16px" }}>No active projects yet.</p>
          <p style={{ fontSize: "13px" }}>Create a project from the Projects menu.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Projects", value: projects.length, color: "var(--c-accent)" },
              { label: "Overall Progress", value: `${overallPct}%`, color: overallPct === 100 ? "var(--c-ok-text)" : "var(--c-text)" },
              { label: "Done", value: overall.complete, color: "var(--c-ok-text)" },
              { label: "Pending", value: overall.pending, color: overall.pending === 0 ? "var(--c-ok-text)" : "var(--c-warn)" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "12px", padding: isMobile ? "14px" : "20px" }}>
                <p style={{ margin: "0 0 6px", color: "var(--c-text-2)", fontSize: "12px" }}>{stat.label}</p>
                <p style={{ margin: 0, color: stat.color, fontSize: isMobile ? "22px" : "28px", fontWeight: "700" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "12px", padding: isMobile ? "16px" : "24px", marginBottom: "24px" }}>
            <h3 style={{ color: "var(--c-text)", margin: "0 0 16px", fontSize: "15px", fontWeight: "600" }}>Progress by Project (%)</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, projects.length * (isMobile ? 40 : 48))}>
              <BarChart data={chartData} layout="vertical" margin={{ left: isMobile ? 0 : 10, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--c-text-2)", fontSize: isMobile ? 10 : 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "var(--c-text-2)", fontSize: isMobile ? 10 : 12 }} width={isMobile ? 90 : 130} />
                <Tooltip contentStyle={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "8px", color: "var(--c-text)" }} formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ color: "var(--c-text-2)", fontSize: "12px" }} />
                <Bar dataKey="Complete" stackId="a" fill="var(--c-ok)" />
                <Bar dataKey="Pending" stackId="a" fill="var(--c-border)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active milestone completion chart */}
          {milestoneChartData.length > 0 && (
            <div style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "12px", padding: isMobile ? "16px" : "24px", marginBottom: "24px" }}>
              <h3 style={{ color: "var(--c-text)", margin: "0 0 4px", fontSize: "15px", fontWeight: "600" }}>Active Milestone Progress</h3>
              <p style={{ color: "var(--c-text-3)", fontSize: "12px", margin: "0 0 16px" }}>Completed items assigned to each project's current active milestone</p>
              <ResponsiveContainer width="100%" height={Math.max(120, milestoneChartData.length * (isMobile ? 44 : 52))}>
                <BarChart data={milestoneChartData} layout="vertical" margin={{ left: isMobile ? 0 : 10, right: 60, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--c-text-2)", fontSize: isMobile ? 10 : 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--c-text-2)", fontSize: isMobile ? 9 : 11 }} width={isMobile ? 110 : 200} />
                  <Tooltip contentStyle={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "8px", color: "var(--c-text)" }}
                    formatter={(val, key, props) => [`${val} items (${props.payload.pct}%)`, key]} />
                  <Legend wrapperStyle={{ color: "var(--c-text-2)", fontSize: "12px" }} />
                  <Bar dataKey="Complete" stackId="a" fill="var(--c-ok)" />
                  <Bar dataKey="Remaining" stackId="a" fill="var(--c-border)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Upcoming milestones */}
          {milestones.length > 0 && (
            <div style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "12px", padding: isMobile ? "16px" : "24px", marginBottom: "24px" }}>
              <h3 style={{ color: "var(--c-text)", margin: "0 0 16px", fontSize: "15px", fontWeight: "600" }}>Upcoming Milestones</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                {milestones.map((m) => {
                  const daysUntil = Math.ceil((new Date(m.date + "T00:00:00") - new Date()) / 86400000);
                  const isAlert = daysUntil <= m.days_before_alert;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--c-bg)", borderRadius: "8px", border: `1px solid ${isAlert ? "var(--c-warn)" : "var(--c-border)"}`, flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <span style={{ color: "var(--c-text)", fontSize: "14px", fontWeight: "600" }}>{m.name}</span>
                        <span style={{ color: "var(--c-text-3)", fontSize: "12px", marginLeft: "10px" }}>{m.project?.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isAlert && <span style={{ fontSize: "11px", color: "var(--c-warn)", background: "var(--c-warn-bg)", padding: "2px 8px", borderRadius: "20px" }}>⚠ {daysUntil}d</span>}
                        <span style={{ color: "var(--c-text-2)", fontSize: "13px" }}>{new Date(m.date + "T00:00:00").toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-project breakdown */}
          <h3 style={{ color: "var(--c-text)", fontSize: "15px", fontWeight: "600", margin: "0 0 16px" }}>Per-Project Breakdown</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {projects.map((p) => {
              const s = stats[p.id] || {};
              const total = s.total || 0;
              const applicable = total - (s.na || 0);
              const pct = applicable ? Math.round((s.complete / applicable) * 100) : 0;
              const isExp = expanded === p.id;
              const catSt = categoryStats[p.id] || {};
              return (
                <div key={p.id} style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
                  <div onClick={() => setExpanded(isExp ? null : p.id)} style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    <div>
                      <h4 style={{ color: "var(--c-text)", margin: "0 0 4px", fontSize: "15px" }}>{p.name}</h4>
                      <p style={{ color: "var(--c-text-2)", margin: 0, fontSize: "12px" }}>{s.complete || 0} done · {s.pending || 0} pending · {s.na || 0} N/A</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ color: pct === 100 ? "var(--c-ok-text)" : "var(--c-text)", fontSize: "22px", fontWeight: "700" }}>{pct}%</span>
                      <span style={{ color: "var(--c-text-3)", fontSize: "12px" }}>{isExp ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "var(--c-bg)", margin: "0 20px 16px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--c-ok)" : "var(--c-accent)", borderRadius: "2px" }} />
                  </div>
                  {isExp && (
                    <div style={{ padding: "4px 20px 20px", borderTop: "1px solid #334155" }}>
                      <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
                        {CATEGORIES.filter((cat) => catSt[cat.id]).map((cat) => {
                          const cs = catSt[cat.id];
                          const catPct = cs.total ? Math.round((cs.done / cs.total) * 100) : 0;
                          return (
                            <div key={cat.id}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ color: "var(--c-text-2)", fontSize: "13px" }}>{cat.label}</span>
                                <span style={{ color: catPct === 100 ? "var(--c-ok-text)" : "var(--c-text-2)", fontSize: "12px", fontWeight: "600" }}>{catPct}% ({cs.done}/{cs.total})</span>
                              </div>
                              <div style={{ height: "4px", background: "var(--c-bg)", borderRadius: "2px" }}>
                                <div style={{ height: "100%", width: `${catPct}%`, background: catPct === 100 ? "var(--c-ok)" : "var(--c-accent)", borderRadius: "2px" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
