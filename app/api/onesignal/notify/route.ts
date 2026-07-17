import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NotifyPayload = {
  type?: "new_request" | "approved" | "rejected" | "received" | "sms_revision" | "monthly_position_complete" | "monthly_report_uploaded" | "monthly_report_collected" | "crew_cert_upload" | "ship_cert_upload";
  requestId?: string;
  crewId?: string;
  crewName?: string;
  itemName?: string;
  actorName?: string;
  reason?: string;
  revision?: string;
  changedCount?: number;
  position?: string;
  month?: string;
  completedCount?: number;
  certName?: string;
  targetCrewName?: string;
  actorId?: string;
  actorPin?: string;
  reportMasterId?: string;
  reportMonth?: string;
  collectionAction?: "download" | "export";
  targetPositions?: string[];
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
    return {
      skipped: true,
      reason: !oneSignalAppId || !oneSignalApiKey ? "missing_env" : "no_targets",
      targetCount: externalIds.length,
    };
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
      web_url: url,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(data.errors || data.error || data));
  }
  return {
    ...data,
    targetCount: externalIds.length,
    appIdTail: oneSignalAppId.slice(-8),
  };
}

async function resolveCrewId(supabaseAdmin: any, crewId?: string, crewName?: string) {
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

function splitRoles(value: unknown) {
  return String(value || "")
    .split("/")
    .map((role) => role.trim())
    .filter(Boolean);
}

async function authenticateUploadActor(supabaseAdmin: any, payload: NotifyPayload) {
  const actorId = String(payload.actorId || "");
  const actorPin = String(payload.actorPin || "").replace(/\D/g, "").slice(0, 6);
  if (!actorId || actorPin.length !== 6) return null;

  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, full_name, position, is_active, resigned_at")
    .eq("id", actorId)
    .eq("pin", actorPin)
    .maybeSingle();

  if (error || !data || data.is_active === false || data.resigned_at) return null;
  return data as { id: string; full_name?: string; position?: string };
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

    if (payload.type === "crew_cert_upload" || payload.type === "ship_cert_upload") {
      const actor = await authenticateUploadActor(supabaseAdmin, payload);
      if (!actor) {
        return NextResponse.json({ error: "Uploader authentication required" }, { status: 401 });
      }

      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position, is_active, resigned_at");
      if (error) throw error;

      const externalIds = (crews || [])
        .filter((crew: any) => crew.is_active !== false && !crew.resigned_at && adminRoles.includes(normalizeRole(crew.position)))
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const isShipCert = payload.type === "ship_cert_upload";
      const title = isShipCert ? "Ship certificate uploaded" : "Crew certificate uploaded";
      const certName = payload.certName || (isShipCert ? "Ship certificate" : "Crew certificate");
      const subject = isShipCert ? certName : `${certName} for ${payload.targetCrewName || "a crew member"}`;
      const body = `${subject} was uploaded by ${actor.full_name || payload.actorName || "a crew member"}.`;
      const url = isShipCert ? `${baseUrl}/admin/ship-certificates` : `${baseUrl}/certificates?tab=crew`;
      const data = await sendOneSignal(externalIds, title, body, url);
      return NextResponse.json({ ok: true, target: "admins", targetCount: externalIds.length, data });
    }

    if (payload.type === "monthly_report_uploaded") {
      const actor = await authenticateUploadActor(supabaseAdmin, payload);
      const masterId = String(payload.reportMasterId || "");
      const reportMonth = String(payload.reportMonth || "");
      if (!actor || !masterId || !/^\d{4}-\d{2}-01$/.test(reportMonth)) {
        return NextResponse.json({ error: "Report uploader authentication required" }, { status: 401 });
      }

      const [{ data: master, error: masterError }, { data: submission, error: submissionError }] = await Promise.all([
        supabaseAdmin.from("monthly_report_master").select("id, schedule, form_no, details, pic").eq("id", masterId).maybeSingle(),
        supabaseAdmin
          .from("monthly_report_submissions")
          .select("id")
          .eq("master_id", masterId)
          .eq("report_month", reportMonth)
          .eq("uploaded_by", actor.id)
          .maybeSingle(),
      ]);
      if (masterError || submissionError || !master || !submission) {
        return NextResponse.json({ error: "Uploaded report could not be verified" }, { status: 400 });
      }

      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position, is_active, resigned_at");
      if (error) throw error;
      const externalIds = (crews || [])
        .filter((crew: any) => crew.is_active !== false && !crew.resigned_at && normalizeRole(crew.position) === "radio operator")
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const reportLabel = `${master.form_no || "N/A"} ${master.details || "Report"}`.trim();
      const month = payload.month ? ` for ${payload.month}` : "";
      const body = `${reportLabel} (${master.schedule || "Report"})${month} was uploaded by ${actor.full_name || payload.actorName || "a crew member"}.`;
      const data = await sendOneSignal(externalIds, "Report uploaded", body, `${baseUrl}/monthly-reports`);
      return NextResponse.json({ ok: true, target: "radio_operator", targetCount: externalIds.length, data });
    }

    if (payload.type === "monthly_report_collected") {
      const actor = await authenticateUploadActor(supabaseAdmin, payload);
      if (!actor || normalizeRole(actor.position) !== "radio operator") {
        return NextResponse.json({ error: "Radio Operator authentication required" }, { status: 401 });
      }

      let reportLabel = "Monthly report ZIP";
      let targetPositions = Array.isArray(payload.targetPositions) ? payload.targetPositions.filter(Boolean) : [];
      if (payload.reportMasterId) {
        const { data: master, error: masterError } = await supabaseAdmin
          .from("monthly_report_master")
          .select("form_no, details, pic")
          .eq("id", String(payload.reportMasterId))
          .maybeSingle();
        if (masterError || !master) {
          return NextResponse.json({ error: "Report could not be verified" }, { status: 400 });
        }
        reportLabel = `${master.form_no || "N/A"} ${master.details || "Report"}`.trim();
        targetPositions = splitRoles(master.pic);
      } else if (payload.collectionAction === "export") {
        const reportMonth = String(payload.reportMonth || "");
        const exportPosition = targetPositions.length === 1 ? targetPositions[0] : "";
        const { data: exportLog, error: exportError } = await supabaseAdmin
          .from("monthly_report_exports")
          .select("id")
          .eq("report_month", reportMonth)
          .eq("position", exportPosition)
          .eq("exported_by", actor.id)
          .maybeSingle();
        if (exportError || !exportLog) {
          return NextResponse.json({ error: "Monthly report export could not be verified" }, { status: 400 });
        }
        reportLabel = `${exportPosition} monthly report ZIP`;
      }
      const targetRoleSet = new Set(targetPositions.map(normalizeRole).filter(Boolean));
      if (targetRoleSet.size === 0) {
        return NextResponse.json({ error: "No report position found" }, { status: 400 });
      }

      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position, is_active, resigned_at");
      if (error) throw error;
      const externalIds = (crews || [])
        .filter((crew: any) => crew.is_active !== false && !crew.resigned_at && targetRoleSet.has(normalizeRole(crew.position)))
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const action = payload.collectionAction === "export" ? "exported" : "downloaded";
      const month = payload.month ? ` for ${payload.month}` : "";
      const body = `${reportLabel}${month} was ${action} by ${actor.full_name || "Radio Operator"}.`;
      const data = await sendOneSignal(externalIds, "Report collected", body, `${baseUrl}/monthly-reports`);
      return NextResponse.json({ ok: true, target: "report_positions", targetCount: externalIds.length, data });
    }

    if (payload.type === "new_request" || payload.type === "received") {
      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position");

      if (error) throw error;

      const externalIds = (crews || [])
        .filter((crew: any) => adminRoles.includes(normalizeRole(crew.position)))
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const isReceived = payload.type === "received";
      const title = isReceived ? "PPE transaction completed" : "New PPE request";
      const body = isReceived
        ? `${payload.crewName || "A crew member"} received ${payload.itemName || "PPE"}.`
        : `${payload.crewName || "A crew member"} requested ${payload.itemName || "PPE"}.`;
      const url = payload.requestId
        ? isReceived
          ? `${baseUrl}/ppe?view=history`
          : `${baseUrl}/ppe`
        : isReceived
          ? `${baseUrl}/ppe?view=history`
          : `${baseUrl}/ppe`;

      const data = await sendOneSignal(externalIds, title, body, url);
      return NextResponse.json({ ok: true, target: "admins", targetCount: externalIds.length, data });
    }

    if (payload.type === "sms_revision") {
      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id");

      if (error) throw error;

      const externalIds = (crews || [])
        .map((crew: any) => String(crew.id))
        .filter(Boolean);
      const title = "SMS Library updated";
      const revision = payload.revision || "New revision";
      const count = payload.changedCount ? `${payload.changedCount} document(s)` : "documents";
      const body = `${revision} uploaded: ${count} updated.`;
      const data = await sendOneSignal(
        externalIds,
        title,
        body,
        `${baseUrl}/sms-library`,
      );
      return NextResponse.json({ ok: true, target: "all_crew", targetCount: externalIds.length, data });
    }

    if (payload.type === "monthly_position_complete") {
      const { data: crews, error } = await supabaseAdmin
        .from("crews")
        .select("id, position");

      if (error) throw error;

      const externalIds = (crews || [])
        .filter((crew: any) => normalizeRole(crew.position) === "radio operator")
        .map((crew: any) => String(crew.id))
        .filter(Boolean);

      const title = "Monthly reports ready";
      const position = payload.position || "A department";
      const month = payload.month || "this month";
      const count = payload.completedCount ? `${payload.completedCount} file(s)` : "all files";
      const body = `${position} completed ${count} for ${month}. Ready to export ZIP.`;
      const data = await sendOneSignal(
        externalIds,
        title,
        body,
        `${baseUrl}/monthly-reports`,
      );
      return NextResponse.json({ ok: true, target: "radio_operator", targetCount: externalIds.length, data });
    }

    if (payload.type === "approved" || payload.type === "rejected") {
      const resolvedCrewId = await resolveCrewId(supabaseAdmin, payload.crewId, payload.crewName);
      if (!resolvedCrewId) {
        return NextResponse.json({ ok: true, skipped: true, reason: "No crew id found" });
      }

      const approved = payload.type === "approved";
      const title = approved ? "PPE item approved" : "PPE item rejected";
      const body = approved
        ? `${payload.itemName || "Your PPE request"} is ready for pickup.`
        : `${payload.itemName || "Your PPE request"} was rejected${payload.reason ? `: ${payload.reason}` : "."}`;
      const data = await sendOneSignal(
        [resolvedCrewId],
        title,
        body,
        `${baseUrl}/my-requests`,
      );
      return NextResponse.json({ ok: true, target: "requester", targetCount: 1, data });
    }

    return NextResponse.json({ ok: true, skipped: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected OneSignal notify error" },
      { status: 500 },
    );
  }
}
