/**
 * Servicio modular de envío de correos electrónicos para GPQR.
 * Permite enviar invitaciones a validadores con enlaces seguros HTTPS.
 * Si no hay un proveedor externo configurado (ej. RESEND_API_KEY),
 * opera en modo modular de desarrollo registrando el enlace en la consola del servidor.
 */

export interface SendInvitationEmailParams {
  toEmail: string;
  eventName: string;
  creatorEmail: string;
  invitationUrl: string;
  expiresAt: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

export async function sendValidatorInvitationEmail({
  toEmail,
  eventName,
  creatorEmail,
  invitationUrl,
  expiresAt,
}: SendInvitationEmailParams): Promise<EmailSendResult> {
  const formattedExpiry = new Date(expiresAt).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Invitación para validar asistencia en: ${eventName}`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000; color: #ededed; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #0a0a0a; border: 1px solid #27272a; border-radius: 12px; padding: 32px; }
          .header { font-size: 20px; font-weight: bold; color: #ffffff; margin-bottom: 12px; }
          .badge { display: inline-block; background: #18181b; border: 1px solid #3f3f46; color: #a1a1aa; padding: 4px 10px; border-radius: 6px; font-size: 11px; margin-bottom: 20px; }
          .content { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px; }
          .button { display: inline-block; background: #ffffff; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 8px; }
          .footer { font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; margin-top: 28px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">GPQR • Invitación de Validador</div>
          <div class="badge">Evento Privado</div>
          <p class="content">
            Hola,<br><br>
            <strong>${creatorEmail}</strong> te ha invitado a formar parte del equipo de validación del evento <strong>"${eventName}"</strong> en la plataforma GPQR.
          </p>
          <p class="content">
            Como validador autorizado, podrás utilizar la cámara de tu dispositivo para escanear credenciales QR y controlar el acceso de los participantes en tiempo real.
          </p>
          <p>
            <a href="${invitationUrl}" class="button" target="_blank" rel="noopener noreferrer">Aceptar Invitación</a>
          </p>
          <p class="content" style="font-size: 12px; color: #a1a1aa; margin-top: 24px;">
            Este enlace es de uso único y vencerá el <strong>${formattedExpiry}</strong>.<br>
            Asegúrate de iniciar sesión en GPQR con este correo (<strong>${toEmail}</strong>) para activar tu acceso.
          </p>
          <div class="footer">
            Si no reconoces esta invitación o consideras que se trata de un error, puedes ignorar este mensaje.<br>
            GPQR — Sistema de Control de Asistencia y Acreditación Digital.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Integración con Resend si la clave existe
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || "GPQR <no-reply@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn("Resend API warning:", errorText);
        return { success: false, error: errorText };
      }

      const resData = (await res.json()) as { id?: string };
      return { success: true, messageId: resData.id };
    } catch (err) {
      console.error("Error al enviar correo con Resend:", err);
      return { success: false, error: String(err) };
    }
  }

  // 2. Modo fallback: Log en consola y soporte seguro en desarrollo
  console.info("=================================================");
  console.info("✉️ [GPQR EMAIL SIMULATOR] Invitación a Validador");
  console.info(`Destinatario: ${toEmail}`);
  console.info(`Evento: ${eventName}`);
  console.info(`Enlace para aceptar: ${invitationUrl}`);
  console.info(`Expira: ${formattedExpiry}`);
  console.info("=================================================");

  return {
    success: true,
    previewUrl: invitationUrl,
  };
}
