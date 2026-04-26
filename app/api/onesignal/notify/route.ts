import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NotifyPayload = {
  type?: "new_request" | "approved" | "rejected";
  requestId?: string;
  crewId?: string;
  crewName?: string;
  itemName?: string;
  actorName?: string;
  reason?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY || "";

const adminRoles = ["safety officer", "chief officer", "barge master"];

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sendOneSignal(externalIds: string[], headings: string, contents: string, url: string) {
  if (!oneSignalAppId || !oneSignalApiKey || externalIds.length === 0) {
    return { skipped: true };
  }

  const response = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${oneSignalApiKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: "push",
      include_aliases: {
        external_id: externalIds,
      },
      headings: { en: headings },
      contents: { en: contents },
      url,
      web_url: url,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errors?.[0] || data.error || "OneSignal request failed");
  }
  return data;
}

async function resolveCrewId(
  supabaseAdmin: ReturnType<typeof createClient>,
  crewId?: string,
  crewName?: string,
) {
  if (crewId) return String(crewId);
  if (!crewName) return null;

  const { data } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("full_name", crewName)
    .maybeSingle();

  const crewRow = data as { id?: string } | null;
  return crewRow?.id ? String(crewRow.id) : null;
}

function normalizeRole(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return url.origin;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as NotifyPayload;
    const supabaseAdmin = getSupabaseAdmin();
    const baseUrl = getBaseUrl(request);

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Missing Supabase service role configuration" },
        { status: 500 },
      );
    }

    if (!oneSignalAppId || !oneSignalApiKey) {
      return NextResponse.json(
        { error: "Missing OneSignal environment variables" },
        { status: 500 },
      );
    }

    if (payload.type === "new_request") {
      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position");

      if (error) throw error;

      const externalIds = (crews || [])
        .filter((crew: any) => adminRoles.includes(normalizeRole(crew.position)))
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const title = "New PPE request";
      const body = `${payload.crewName || "A crew member"} requested ${payload.itemName || "PPE"}.`;
      const url = payload.requestId
        ? `${baseUrl}/admin/approvals?request=${payload.requestId}`
        : `${baseUrl}/admin/approvals`;

      const data = await sendOneSignal(externalIds, title, body, url);
      return NextResponse.json({ ok: true, data });
    }

    if (payload.type === "approved" || payload.type === "rejected") {
      const resolvedCrewId = await resolveCrewId(supabaseAdmin, payload.crewId, payload.crewName);
      if (!resolvedCrewId) {
        return NextResponse.json({ ok: true, skipped: true, reason: "No crew id found" });
      }

      const approved = payload.type === "approved";
      const title = approved ? "PPE request approved" : "PPE request rejected";
      const body = approved
        ? `${payload.itemName || "Your PPE request"} is ready for pickup.`
        : `${payload.itemName || "Your PPE request"} was rejected${payload.reason ? `: ${payload.reason}` : "."}`;
      const data = await sendOneSignal(
        [resolvedCrewId],
        title,
        body,
        `${baseUrl}/my-requests`,
      );
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ ok: true, skipped: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected OneSignal notify error" },
      { status: 500 },
    );
  }
}
