import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const { to, inviteeName, inviterName, projectName, role, appUrl } = await req.json();

    const roleLabel = role?.replace(/_/g, " ") ?? "member";

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8fafc;">
        <div style="background: #1e293b; border-radius: 12px; padding: 32px; color: #f1f5f9;">
          <h1 style="color: #0095da; margin: 0 0 8px;">AG&amp;E QC Checklist</h1>
          <hr style="border: none; border-top: 1px solid #334155; margin: 16px 0;" />
          <p style="font-size: 16px; margin: 0 0 16px;">Hi ${inviteeName ?? "there"},</p>
          <p style="margin: 0 0 16px;"><strong>${inviterName}</strong> added you to the project <strong>"${projectName}"</strong> as <strong>${roleLabel}</strong>.</p>
          <a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background: #0095da; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
            Open QC Checklist →
          </a>
          <p style="color: #64748b; font-size: 12px; margin: 24px 0 0;">If you don't have an account yet, register with this email address and the project will be waiting for you.</p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "AG&E QC Checklist <noreply@age-qc.com>",
        to: [to],
        subject: `You've been added to "${projectName}" on AG&E QC Checklist`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
