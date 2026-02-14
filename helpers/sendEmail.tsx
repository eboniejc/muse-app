/**
 * Backend-only helper for sending emails via SendGrid.
 * Do not import this in client-side code.
 */

// We don't import types from @sendgrid/mail to avoid adding the dependency,
// but we structure the data to match SendGrid API v3 requirements.

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const SENDER_EMAIL = "info@museinc.com.vn";
const SENDER_NAME = "MUSE INC";

interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Sends a generic email using SendGrid API.
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not defined in environment variables.");
    return false;
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: SENDER_EMAIL,
          name: SENDER_NAME,
        },
        subject: subject,
        content: [
          {
            type: "text/plain",
            value: textContent || htmlContent.replace(/<[^>]*>?/gm, ""), // fallback strip html
          },
          {
            type: "text/html",
            value: htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to send email to ${to}. Status: ${response.status}. Response: ${errorText}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

interface CourseConfirmationParams {
  to: string;
  studentName: string;
  courseName: string;
  courseDetails: {
    startDate?: string;
    schedule?: string;
    price?: string;
  };
}

/**
 * Sends a branded course registration confirmation email.
 */
export async function sendCourseConfirmationEmail({
  to,
  studentName,
  courseName,
  courseDetails,
}: CourseConfirmationParams): Promise<boolean> {
  const subject = `[MUSE INC] Course Registration Confirmation – ${courseName}`;

  // Simple responsive HTML template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1A1A1A; border-radius: 8px; overflow: hidden; }
        .header { background-color: #000000; padding: 30px 20px; text-align: center; border-bottom: 3px solid #FF6B00; }
        .logo { font-size: 24px; font-weight: bold; color: #FFFFFF; letter-spacing: 2px; text-decoration: none; }
        .content { padding: 40px 30px; }
        .h1 { color: #FFFFFF; font-size: 22px; margin-bottom: 20px; font-weight: 600; }
        .text { color: #CCCCCC; line-height: 1.6; margin-bottom: 20px; font-size: 16px; }
        .highlight { color: #FF6B00; font-weight: 600; }
        .details-box { background-color: #262626; padding: 20px; border-radius: 4px; margin: 25px 0; border-left: 4px solid #FF6B00; }
        .detail-row { margin-bottom: 10px; color: #E0E0E0; }
        .detail-label { color: #999999; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .footer { background-color: #000000; padding: 30px 20px; text-align: center; font-size: 14px; color: #666666; }
        .footer a { color: #FF6B00; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">MUSE INC</div>
        </div>
        <div class="content">
          <h1 class="h1">Registration Confirmed / Xác Nhận Đăng Ký</h1>
          
          <p class="text">
            Dear <span class="highlight">${studentName}</span>,<br>
            Thank you for registering for the <strong>${courseName}</strong> course at MUSE Inc. We are excited to have you on board!
          </p>
          
          <p class="text">
            Chào <span class="highlight">${studentName}</span>,<br>
            Cảm ơn bạn đã đăng ký khóa học <strong>${courseName}</strong> tại MUSE Inc. Chúng tôi rất vui mừng được đồng hành cùng bạn!
          </p>
          
          <div class="details-box">
            <div class="detail-row">
              <div class="detail-label">Course / Khóa học</div>
              <div>${courseName}</div>
            </div>
            ${
              courseDetails.startDate
                ? `
            <div class="detail-row">
              <div class="detail-label">Start Date / Ngày bắt đầu</div>
              <div>${courseDetails.startDate}</div>
            </div>`
                : ""
            }
             ${
               courseDetails.schedule
                 ? `
            <div class="detail-row">
              <div class="detail-label">Schedule / Lịch học</div>
              <div>${courseDetails.schedule}</div>
            </div>`
                 : ""
             }
          </div>
          
          <p class="text">
            Our team will contact you shortly with further instructions. If you have any questions, feel free to reply to this email.
          </p>
          <p class="text">
            Đội ngũ của chúng tôi sẽ liên hệ với bạn sớm nhất có thể để hướng dẫn các bước tiếp theo. Nếu bạn có thắc mắc, vui lòng phản hồi email này.
          </p>
        </div>
        
        <div class="footer">
          <p>
            <strong>MUSE INC</strong><br>
            409 Hai Ba Trung St., Dist. 3, HCMC<br>
            Hotline: 090 295 79 11<br>
            <a href="mailto:info@museinc.com.vn">info@museinc.com.vn</a>
          </p>
          <p>© ${new Date().getFullYear()} MUSE INC. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    htmlContent,
    textContent: `Dear ${studentName}, Thank you for registering for ${courseName}. Our team will contact you shortly. / Chào ${studentName}, Cảm ơn bạn đã đăng ký khóa học ${courseName}. Chúng tôi sẽ liên hệ sớm.`,
  });
}