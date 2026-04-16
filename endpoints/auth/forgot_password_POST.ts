import { createHmac } from "crypto";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { sendEmail } from "../../helpers/sendEmail";

function generateResetToken(userId: string): string {
  const secret = process.env.JWT_SECRET ?? "";
  const expiryMs = Date.now() + 60 * 60 * 1000; // 1 hour
  const data = `${userId}:${expiryMs}`;
  const payload = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function handle(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return Response.json({ message: "Email is required" }, { status: 400 });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id,email,displayName,displayname")
      .ilike("email", email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    // Always return success to avoid leaking whether an email exists
    if (!userRow) {
      return Response.json({ success: true });
    }

    const token = generateResetToken(String(userRow.id));
    const origin = request.headers.get("origin") ?? "https://museinc.com.vn";
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    const displayName = userRow.displayName ?? userRow.displayname ?? userRow.email;

    await sendEmail({
      to: userRow.email,
      subject: "[MUSE INC] Password Reset Request",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; }
            .container { max-width: 600px; margin: 0 auto; background-color: #1A1A1A; border-radius: 8px; overflow: hidden; }
            .header { background-color: #000; padding: 30px 20px; text-align: center; border-bottom: 3px solid #FF6B00; }
            .logo { font-size: 24px; font-weight: bold; color: #fff; letter-spacing: 2px; }
            .content { padding: 40px 30px; }
            .text { color: #CCC; line-height: 1.6; margin-bottom: 20px; font-size: 16px; }
            .btn { display: inline-block; background-color: #FF6B00; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .note { color: #888; font-size: 13px; margin-top: 24px; }
            .footer { background-color: #000; padding: 24px 20px; text-align: center; font-size: 13px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><div class="logo">MUSE INC</div></div>
            <div class="content">
              <p class="text">Hi <strong>${displayName}</strong>,</p>
              <p class="text">We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
              <p class="text">Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Nhấn nút bên dưới để tạo mật khẩu mới. Liên kết này hết hạn sau <strong>1 giờ</strong>.</p>
              <div style="text-align:center">
                <a href="${resetUrl}" class="btn">Reset Password / Đặt lại mật khẩu</a>
              </div>
              <p class="note">If you didn't request this, you can safely ignore this email. Your password won't change.<br>Nếu bạn không yêu cầu điều này, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
            </div>
            <div class="footer">MUSE INC · info@museinc.com.vn</div>
          </div>
        </body>
        </html>
      `,
      textContent: `Reset your MUSE INC password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return Response.json({ success: true }); // still return success to avoid leaking info
  }
}
