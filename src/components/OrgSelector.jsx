import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import AgeLogo from "./AgeLogo";

const inputStyle = {
  width: "100%", padding: "10px 12px", background: "var(--c-bg)",
  border: "1px solid #334155", borderRadius: "8px", color: "var(--c-text)",
  fontSize: "14px", boxSizing: "border-box", fontFamily: "Manrope, sans-serif",
};

export default function OrgSelector({ session, onSelectOrg, onSignOut }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchOrgs(); }, []);

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from("organization_members")
      .select("role, organization:organizations(id, name, created_at)")
      .eq("user_id", session.user.id)
      .order("created_at", { foreignTable: "organizations", ascending: true });
    setOrgs((data || []).filter((r) => r.organization).map((r) => ({ ...r.organization, myRole: r.role })));
    setLoading(false);
  };

  const createOrg = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    const { data, error: orgErr } = await supabase.rpc("create_organization", { org_name: newOrgName.trim() });
    if (orgErr) { setError(orgErr.message); setCreating(false); return; }
    onSelectOrg(data, "admin");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", fontFamily: "Manrope, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <AgeLogo height={36} />
          <p style={{ color: "var(--c-text-3)", marginTop: "12px", fontSize: "14px", margin: "12px 0 0" }}>
            Select or create an organization to continue
          </p>
        </div>

        {loading ? (
          <p style={{ color: "var(--c-text-2)", textAlign: "center" }}>Loading...</p>
        ) : (
          <>
            {/* Org list */}
            {orgs.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "var(--c-text-3)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  Your Organizations
                </p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {orgs.map((org) => (
                    <button key={org.id} onClick={() => onSelectOrg(org, org.myRole)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "16px 20px", background: "var(--c-surface)", border: "1px solid #334155",
                      borderRadius: "10px", cursor: "pointer", textAlign: "left", width: "100%",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--c-accent)"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--c-border)"}>
                      <span style={{ color: "var(--c-text)", fontSize: "16px", fontWeight: "600" }}>{org.name}</span>
                      <span style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                        background: org.myRole === "admin" ? "var(--c-accent-dk)" : "var(--c-ok-bg)",
                        color: org.myRole === "admin" ? "var(--c-accent-lt)" : "var(--c-ok-text)",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {org.myRole}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create org */}
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} style={{
                width: "100%", padding: "14px", background: "transparent",
                border: "2px dashed #334155", borderRadius: "10px",
                color: "var(--c-text-3)", fontSize: "14px", cursor: "pointer", fontFamily: "Manrope, sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent)"; e.currentTarget.style.color = "var(--c-accent-lt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--c-border)"; e.currentTarget.style.color = "var(--c-text-3)"; }}>
                + Create New Organization
              </button>
            ) : (
              <form onSubmit={createOrg} style={{ background: "var(--c-surface)", border: "1px solid #334155", borderRadius: "10px", padding: "20px" }}>
                <h3 style={{ color: "var(--c-text)", margin: "0 0 16px", fontSize: "15px", fontWeight: "700" }}>New Organization</h3>
                {error && (
                  <div style={{ background: "var(--c-err-bg)", border: "1px solid #ef4444", borderRadius: "6px", padding: "10px", marginBottom: "12px", color: "var(--c-err-text)", fontSize: "13px" }}>
                    {error}
                  </div>
                )}
                <input
                  type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                  required placeholder="e.g. AG&E Structural" autoFocus style={{ ...inputStyle, marginBottom: "12px" }}
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => { setShowCreate(false); setNewOrgName(""); setError(""); }}
                    style={{ flex: 1, padding: "10px", background: "var(--c-border)", color: "var(--c-text)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontFamily: "Manrope, sans-serif" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !newOrgName.trim()}
                    style={{ flex: 1, padding: "10px", background: "var(--c-accent)", color: "white", border: "none", borderRadius: "8px", cursor: creating ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "600", fontFamily: "Manrope, sans-serif" }}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <button onClick={onSignOut} style={{
          display: "block", margin: "28px auto 0", background: "none", border: "none",
          color: "var(--c-text-3)", fontSize: "13px", cursor: "pointer", fontFamily: "Manrope, sans-serif",
        }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
