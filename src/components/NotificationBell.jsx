import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const TYPE_ICON = {
  project_invite: "📬",
  project_join: "✅",
  info: "ℹ️",
};

export default function NotificationBell({ userId, onGoToProjects }) {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notifs-${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs((prev) => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(30);
    setNotifs(data || []);
  };

  const markRead = async (id) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative", background: open ? "var(--c-accent-dk)" : "transparent",
          border: `1px solid ${open ? "var(--c-accent)" : "var(--c-border)"}`,
          borderRadius: "8px", padding: "6px 10px", cursor: "pointer",
          color: "var(--c-text)", fontSize: "16px", lineHeight: 1,
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "-7px", right: "-7px",
            background: "var(--c-err)", color: "white", borderRadius: "50%",
            fontSize: "10px", fontWeight: "800",
            width: "18px", height: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #0f172a",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "340px", maxWidth: "calc(100vw - 24px)",
          background: "var(--c-surface)", border: "1px solid #334155",
          borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          zIndex: 300, overflow: "hidden", fontFamily: "Manrope, sans-serif",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155" }}>
            <span style={{ fontWeight: "700", color: "var(--c-text)", fontSize: "14px" }}>
              Notifications
              {unread > 0 && <span style={{ color: "var(--c-accent)", fontWeight: "400", fontSize: "12px", marginLeft: "6px" }}>({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: "12px", color: "var(--c-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: "380px", overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <p style={{ color: "var(--c-text-3)", textAlign: "center", padding: "32px 16px", fontSize: "13px", margin: 0 }}>
                No notifications yet.
              </p>
            ) : (
              notifs.map((n) => (
                <div key={n.id}
                  onClick={() => { markRead(n.id); if (n.project_id && onGoToProjects) { onGoToProjects(); setOpen(false); } }}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid #0f172a",
                    background: n.read ? "transparent" : "var(--c-accent-dk)",
                    cursor: n.project_id ? "pointer" : "default",
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (n.project_id) e.currentTarget.style.background = "#0c2040"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? "transparent" : "var(--c-accent-dk)"; }}
                >
                  <span style={{ fontSize: "18px", flexShrink: 0, lineHeight: 1, paddingTop: "1px" }}>
                    {TYPE_ICON[n.type] || "🔔"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "var(--c-text)", fontSize: "13px", fontWeight: n.read ? "500" : "700", margin: "0 0 3px", lineHeight: 1.4 }}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p style={{ color: "var(--c-text-2)", fontSize: "12px", margin: "0 0 5px", lineHeight: 1.4 }}>{n.body}</p>
                    )}
                    <p style={{ color: "var(--c-text-3)", fontSize: "11px", margin: 0 }}>
                      {new Date(n.created_at).toLocaleString()}
                      {n.project_id && !n.read && (
                        <span style={{ color: "var(--c-accent)", marginLeft: "8px", fontWeight: "600" }}>→ Go to projects</span>
                      )}
                    </p>
                  </div>
                  {!n.read && (
                    <span style={{ width: "8px", height: "8px", background: "var(--c-accent)", borderRadius: "50%", flexShrink: 0, marginTop: "5px" }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
