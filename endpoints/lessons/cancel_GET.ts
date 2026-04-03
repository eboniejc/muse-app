import crypto from "crypto";
import { supabaseAdmin } from "../../helpers/supabaseServer";

// Admin contact — WhatsApp/Zalo hotline 089.8546.945
const ADMIN_WHATSAPP_NUMBER = "84898546945";
const ADMIN_ZALO_NUMBER = "0898546945";

/**
 * Sends a WhatsApp message to the admin via CallMeBot (free tier).
 * Requires CALLMEBOT_API_KEY in env — see setup instructions.
 * One-time setup: admin WhatsApps +34 644 56 79 87 saying
 * "I allow callmebot to send me messages" to receive their API key.
 */
async function notifyAdminWhatsApp(message: string): Promise<void> {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    console.warn("CALLMEBOT_API_KEY not set — WhatsApp notification skipped.");
    return;
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=+${ADMIN_WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) console.error("CallMeBot error:", res.status, await res.text());
  } catch (err) {
    console.error("CallMeBot request failed:", err);
  }
}

function verifyToken(enrollmentId: string, lessonNumber: string, sig: string): boolean {
  const secret = process.env.SHEETS_API_KEY ?? "";
  if (!secret) return false;
  const message = `${enrollmentId}:${lessonNumber}`;
  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function htmlPage(title: string, isLate: boolean, studentName: string, courseName: string, lessonNumber: number, scheduledAt: string | null, hoursNotice: number | null): string {
  const lateWarning = isLate
    ? `<div style="background:#7c2d12;border-left:4px solid #f97316;padding:16px 20px;border-radius:4px;margin:20px 0;">
        <strong style="color:#f97316;">⚠ Late Cancellation / Huỷ Muộn</strong><br>
        <span style="color:#fed7aa;font-size:14px;">This cancellation is within 24 hours of your scheduled lesson. A late cancellation fee may apply.<br>
        Huỷ lịch trong vòng 24 giờ trước buổi học. Phí huỷ muộn có thể được áp dụng.</span>
      </div>`
    : "";

  const lessonInfo = scheduledAt
    ? `<div style="background:#1e3a5f;padding:16px 20px;border-radius:4px;margin:20px 0;">
        <div style="color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Lesson / Buổi học</div>
        <div style="color:#fff;font-size:15px;">${courseName} — Lesson ${lessonNumber}</div>
        <div style="color:#93c5fd;font-size:14px;margin-top:4px;">Scheduled: ${new Date(scheduledAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
        ${hoursNotice !== null ? `<div style="color:#93c5fd;font-size:13px;margin-top:2px;">${hoursNotice >= 0 ? hoursNotice.toFixed(1) + "h notice" : "Lesson already passed"}</div>` : ""}
      </div>`
    : "";

  const contactSection = `
    <p style="color:#ccc;font-size:14px;margin-top:8px;">
      To reschedule or if you have questions, contact us:<br>
      Để đặt lịch lại hoặc có thắc mắc, vui lòng liên hệ:
    </p>
    <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
      <a href="https://wa.me/${ADMIN_WHATSAPP_NUMBER}" style="display:inline-block;background:#25D366;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">💬 WhatsApp</a>
      <a href="https://zalo.me/${ADMIN_ZALO_NUMBER}" style="display:inline-block;background:#0068ff;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">💬 Zalo</a>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — MUSE INC</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; max-width: 520px; width: 100%; padding: 40px 36px; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: 3px; color: #ff6b00; margin-bottom: 28px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .sub { color: #999; font-size: 14px; margin-bottom: 20px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 24px 0; }
    .footer { color: #555; font-size: 12px; margin-top: 28px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">MUSE INC</div>
    <h1>✓ ${title}</h1>
    <p class="sub">Hello ${studentName}</p>
    ${lessonInfo}
    ${lateWarning}
    <hr class="divider">
    ${contactSection}
    <p class="footer">© ${new Date().getFullYear()} MUSE INC · info@museinc.com.vn</p>
  </div>
</body>
</html>`;
}

function errorPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — MUSE INC</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; max-width: 480px; width: 100%; padding: 40px 36px; text-align: center; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: 3px; color: #ff6b00; margin-bottom: 28px; }
    h1 { font-size: 20px; color: #f87171; margin-bottom: 12px; }
    p { color: #999; font-size: 15px; }
    a { color: #ff6b00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">MUSE INC</div>
    <h1>Unable to Process</h1>
    <p>${message}</p>
    <p style="margin-top:20px;">Contact us: <a href="https://wa.me/${ADMIN_WHATSAPP_NUMBER}">WhatsApp</a> · <a href="https://zalo.me/${ADMIN_ZALO_NUMBER}">Zalo</a></p>
  </div>
</body>
</html>`;
  return new Response(html, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const e = url.searchParams.get("e");
  const l = url.searchParams.get("l");
  const sig = url.searchParams.get("sig");

  if (!e || !l || !sig) {
    return errorPage("This cancellation link is invalid or incomplete.");
  }

  if (!verifyToken(e, l, sig)) {
    return errorPage("This cancellation link is invalid. Please contact us directly.");
  }

  const enrollmentId = parseInt(e, 10);
  const lessonNumber = parseInt(l, 10);

  if (isNaN(enrollmentId) || isNaN(lessonNumber)) {
    return errorPage("Invalid cancellation link parameters.");
  }

  // Check if already cancelled
  const { data: existing } = await supabaseAdmin
    .from("lessonCancellations")
    .select("id, cancelledAt")
    .eq("enrollmentId", enrollmentId)
    .eq("lessonNumber", lessonNumber)
    .maybeSingle();

  if (existing) {
    return new Response(
      errorPage("This lesson was already cancelled on " +
        new Date(existing.cancelledAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) +
        ". Contact us to reschedule.").toString(),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Look up lesson schedule
  const { data: schedule } = await supabaseAdmin
    .from("lessonSchedules")
    .select("scheduledAt")
    .eq("enrollmentId", enrollmentId)
    .eq("lessonNumber", lessonNumber)
    .maybeSingle();

  // Look up enrollment → user + course
  const { data: enrollment } = await supabaseAdmin
    .from("courseEnrollments")
    .select("userId, courseId")
    .eq("id", enrollmentId)
    .maybeSingle();

  let studentName = "Student";
  let studentEmail = "";
  let studentPhone = "";
  let courseName = "Course";

  if (enrollment) {
    const [userRes, profileRes, courseRes] = await Promise.all([
      supabaseAdmin.from("users").select("email, displayName").eq("id", enrollment.userId).maybeSingle(),
      supabaseAdmin.from("userProfiles").select("fullName, phoneNumber").eq("userId", enrollment.userId).maybeSingle(),
      supabaseAdmin.from("courses").select("name").eq("id", enrollment.courseId).maybeSingle(),
    ]);
    studentEmail = (userRes.data as any)?.email ?? "";
    studentName = (profileRes.data as any)?.fullName ?? (userRes.data as any)?.displayName ?? "Student";
    studentPhone = (profileRes.data as any)?.phoneNumber ?? "";
    courseName = (courseRes.data as any)?.name ?? "Course";
  }

  const scheduledAt: string | null = (schedule as any)?.scheduledAt ?? null;
  const now = new Date();
  const lessonMs = scheduledAt ? new Date(scheduledAt).getTime() : null;
  const hoursNotice = lessonMs !== null ? (lessonMs - now.getTime()) / (1000 * 60 * 60) : null;
  const isLate = hoursNotice !== null && hoursNotice >= 0 && hoursNotice < 24;

  // Record cancellation (table may not exist yet — degrade gracefully)
  try {
    await supabaseAdmin.from("lessonCancellations").insert({
      enrollmentId,
      lessonNumber,
      cancelledAt: now.toISOString(),
      scheduledAt: scheduledAt ?? null,
      hoursNotice: hoursNotice !== null ? Math.round(hoursNotice * 10) / 10 : null,
      isLate,
      studentName,
      studentEmail,
      courseName,
    });
  } catch (err) {
    console.error("lessonCancellations insert failed (table may not exist):", err);
  }

  // Notify admin via WhatsApp (CallMeBot)
  const lateFlag = isLate ? "⚠ LATE CANCEL\n" : "";
  const hoursStr = hoursNotice !== null
    ? hoursNotice >= 0 ? `${hoursNotice.toFixed(1)}h notice` : "lesson already past"
    : "unknown time";
  const scheduledStr = scheduledAt
    ? new Date(scheduledAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "Unknown";

  const waMessage = [
    `[MUSE INC] ${lateFlag}Lesson Cancellation`,
    `Student: ${studentName}`,
    studentPhone ? `Phone: ${studentPhone}` : null,
    `Course: ${courseName}`,
    `Lesson: ${lessonNumber}`,
    `Scheduled: ${scheduledStr}`,
    `Notice: ${hoursStr}`,
  ].filter(Boolean).join("\n");

  await notifyAdminWhatsApp(waMessage).catch(() => {});

  const html = htmlPage(
    "Lesson Cancelled",
    isLate,
    studentName,
    courseName,
    lessonNumber,
    scheduledAt,
    hoursNotice
  );

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
