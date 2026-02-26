import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { sendEmail } from "../../helpers/sendEmail";
import { schema } from "./notify_POST.schema";

const REGISTRATION_DESTINATION_EMAIL = "museincproperty@gmail.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = await request.json();
    const input = schema.parse(json);

    const rows = [
      ["Student Name", input.fullName],
      ["Student Account Email", user.email],
      ["Phone Number", input.phoneNumber],
      ["Date of Birth", input.dateOfBirth ?? "N/A"],
      ["Gender", input.gender ?? "N/A"],
      ["Address", input.address ?? "N/A"],
      ["Course", input.courseName ?? "N/A"],
      ["Course ID", input.selectedCourseId != null ? String(input.selectedCourseId) : "N/A"],
      ["Preferred Payment Method", input.preferredPaymentMethod ?? "N/A"],
      ["Bank Name", input.bankName ?? "N/A"],
      ["Bank Account Name", input.bankAccountName ?? "N/A"],
      ["Bank Account Number", input.bankAccountNumber ?? "N/A"],
    ] as const;

    const htmlRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 10px;border:1px solid #ddd;font-weight:600;">${escapeHtml(
            label
          )}</td><td style="padding:8px 10px;border:1px solid #ddd;">${escapeHtml(
            value
          )}</td></tr>`
      )
      .join("");

    const subject = `[MUSE INC] Registration Form Submission - ${input.fullName}`;
    const textContent = rows
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");
    const htmlContent = `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2 style="margin:0 0 14px;">New Registration Form Submission</h2>
        <table style="border-collapse:collapse;width:100%;max-width:720px;">
          ${htmlRows}
        </table>
      </div>
    `;

    const didSend = await sendEmail({
      to: REGISTRATION_DESTINATION_EMAIL,
      subject,
      htmlContent,
      textContent,
    });

    if (!didSend) {
      return Response.json({ error: "Failed to send registration email" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    console.error("Error sending registration notification:", error);
    return Response.json({ error: "Failed to send registration email" }, { status: 500 });
  }
}

