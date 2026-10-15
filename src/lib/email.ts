import nodemailer from "nodemailer";
import { generateQRBuffer } from "./qr";

/**
 * Servicio de envío de correos electrónicos para GPQR.
 * Soporta Gmail SMTP (usando contraseñas de aplicación) y fallback en desarrollo.
 * 
 * Variables de entorno requeridas para Gmail SMTP:
 * - GMAIL_USER: tu cuenta de correo de Gmail (ej: miempresa@gmail.com)
 * - GMAIL_APP_PASSWORD: tu contraseña de aplicación de 16 caracteres de Google
 * - EMAIL_FROM: (opcional) ej: "GPQR Asistencia <miempresa@gmail.com>"
 * 
 * Variables opcionales para servidores SMTP genéricos:
 * - SMTP_HOST (default: smtp.gmail.com)
 * - SMTP_PORT (default: 465)
 * - SMTP_SECURE (default: true)
 */

export interface SendInvitationEmailParams {
  toEmail: string;
  eventName: string;
  creatorEmail: string;
  invitationUrl: string;
  expiresAt: string;
}

export interface SendGuestTicketEmailParams {
  toEmail: string;
  participantName: string;
  documentNumber: string;
  eventName: string;
  eventLocation?: string | null;
  startsAt: string;
  endsAt?: string | null;
  qrToken: string;
  ticketUrl: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

/**
 * Obtiene la configuración de transporte SMTP
 */
function getSmtpTransporter() {
  const user = (
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER
  )?.trim();

  const pass = (
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_PASSWORD ||
    process.env.EMAIL_PASSWORD
  )?.trim().replace(/\s+/g, "");

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Obtiene la dirección de remitente configurada
 */
function getSenderAddress(): string {
  const configuredFrom = process.env.EMAIL_FROM;
  if (configuredFrom && configuredFrom.trim().length > 0) {
    return configuredFrom.trim();
  }
  const user = (
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER
  )?.trim();
  if (user) {
    return `GPQR Asistencia <${user}>`;
  }
  return "GPQR <no-reply@gpqr.local>";
}

/**
 * Envía la invitación por correo a un validador de evento
 */
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
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050505; color: #ededed; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #0c0c0e; border: 1px solid #27272a; border-radius: 14px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { font-size: 20px; font-weight: bold; color: #ffffff; margin-bottom: 8px; }
          .badge { display: inline-block; background: #18181b; border: 1px solid #3f3f46; color: #a1a1aa; padding: 4px 10px; border-radius: 6px; font-size: 11px; margin-bottom: 20px; font-family: monospace; }
          .content { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px; }
          .button { display: inline-block; background: #ffffff; color: #000000 !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 8px; }
          .footer { font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; margin-top: 28px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">GPQR • Invitación de Validador</div>
          <div class="badge">Equipo de Control • Evento Privado</div>
          <p class="content">
            Hola,<br><br>
            <strong>${creatorEmail}</strong> te ha invitado a formar parte del equipo de validación del evento <strong>"${eventName}"</strong> en la plataforma GPQR.
          </p>
          <p class="content">
            Como validador autorizado, podrás utilizar la cámara de tu dispositivo móvil o computadora para escanear credenciales QR y controlar el acceso de los participantes en tiempo real.
          </p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${invitationUrl}" class="button" target="_blank" rel="noopener noreferrer">Aceptar Invitación de Validador</a>
          </p>
          <p class="content" style="font-size: 12px; color: #a1a1aa; margin-top: 24px;">
            Este enlace es seguro y vencerá el <strong>${formattedExpiry}</strong>.<br>
            Asegúrate de iniciar sesión en GPQR con tu correo (<strong>${toEmail}</strong>) para activar tus credenciales.
          </p>
          <div class="footer">
            Si no reconoces esta invitación o consideras que se trata de un error, puedes ignorar este mensaje.<br>
            GPQR — Sistema de Control de Asistencia y Acreditación Digital.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Envío vía Gmail SMTP / Nodemailer
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const from = getSenderAddress();
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html: htmlBody,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      console.error("Error al enviar invitación con Gmail SMTP:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 2. Fallback si no hay variables SMTP configuradas
  console.warn("⚠️ [GPQR EMAIL] No hay credenciales SMTP configuradas (SMTP_USER y SMTP_PASSWORD)");
  return {
    success: false,
    error: "Servidor de correo no configurado (faltan variables SMTP_USER y SMTP_PASSWORD en el servidor).",
    previewUrl: invitationUrl,
  };
}

/**
 * Envía el pase digital y código QR al invitado/participante de un evento
 */
export async function sendGuestTicketEmail({
  toEmail,
  participantName,
  documentNumber,
  eventName,
  eventLocation,
  startsAt,
  endsAt,
  qrToken,
  ticketUrl,
}: SendGuestTicketEmailParams): Promise<EmailSendResult> {
  const formattedStart = new Date(startsAt).toLocaleString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedEnd = endsAt
    ? new Date(endsAt).toLocaleString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const subject = `Tu pase de acceso oficial: ${eventName}`;

  // Generar código QR en buffer para adjunto inline en el correo
  let qrBuffer: Buffer | null = null;
  try {
    qrBuffer = await generateQRBuffer(qrToken, { width: 320, margin: 2 });
  } catch (qrErr) {
    console.warn("No se pudo generar el buffer del QR para el correo:", qrErr);
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050505; color: #ededed; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #0c0c0e; border: 1px solid #27272a; border-radius: 14px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { font-size: 22px; font-weight: bold; color: #ffffff; margin-bottom: 6px; }
          .badge { display: inline-block; background: #10b981; color: #000000; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 20px; }
          .card { background: #141418; border: 1px solid #27272a; border-radius: 10px; padding: 18px; margin: 20px 0; }
          .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
          .card-label { color: #a1a1aa; }
          .card-value { color: #ffffff; font-weight: 600; text-align: right; }
          .qr-box { text-align: center; background: #ffffff; border-radius: 12px; padding: 20px; margin: 24px auto; max-width: 260px; }
          .button { display: inline-block; background: #ffffff; color: #000000 !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 12px; }
          .footer { font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; margin-top: 28px; line-height: 1.5; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">GPQR • Pase Oficial de Acceso</div>
          <div class="badge">Entrada Confirmada</div>
          <p class="content">
            Hola <strong>${participantName}</strong>,<br><br>
            Tu registro para el evento <strong>"${eventName}"</strong> ha sido procesado exitosamente. A continuación encontrarás tu credencial digital y código QR individual para el ingreso.
          </p>

          <!-- Datos del Evento -->
          <div class="card">
            <div style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; margin-bottom: 12px; font-weight: 600;">Detalles de la Inscripción</div>
            <div style="margin-bottom: 8px; font-size: 13px;"><span style="color:#a1a1aa;">Asistente:</span> <strong style="color:#ffffff;">${participantName}</strong></div>
            <div style="margin-bottom: 8px; font-size: 13px;"><span style="color:#a1a1aa;">Documento:</span> <strong style="color:#ffffff; font-family: monospace;">${documentNumber}</strong></div>
            <div style="margin-bottom: 8px; font-size: 13px;"><span style="color:#a1a1aa;">Fecha y Hora:</span> <strong style="color:#ffffff;">${formattedStart}${formattedEnd ? ` - ${formattedEnd}` : ""}</strong></div>
            ${eventLocation ? `<div style="font-size: 13px;"><span style="color:#a1a1aa;">Lugar:</span> <strong style="color:#ffffff;">${eventLocation}</strong></div>` : ""}
          </div>

          <!-- Código QR -->
          <div style="text-align: center; margin: 28px 0;">
            <div class="qr-box">
              <img src="cid:ticketqr@gpqr" alt="Código QR de Acceso" style="width: 220px; height: 220px; display: block; margin: 0 auto;" />
              <div style="color: #000000; font-family: monospace; font-size: 10px; margin-top: 10px; font-weight: 600;">Muestra este código al ingresar</div>
            </div>
            <p>
              <a href="${ticketUrl}" class="button" target="_blank" rel="noopener noreferrer">Abrir Pase Digital en el Celular</a>
            </p>
          </div>

          <p class="content" style="font-size: 12px; color: #a1a1aa; text-align: center;">
            Presenta este código QR en la entrada del evento para que el equipo de acreditación valide tu ingreso.<br>
            También puedes abrir el enlace para guardar el pase en tu dispositivo o descargar la imagen.
          </p>

          <div class="footer">
            Este correo contiene un código de acceso personal e intransferible.<br>
            GPQR — Sistema de Control de Asistencia y Acreditación Digital.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Envío vía Gmail SMTP / Nodemailer
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const from = getSenderAddress();
      const attachments = qrBuffer
        ? [
            {
              filename: `pase_qr_${documentNumber}.png`,
              content: qrBuffer,
              cid: "ticketqr@gpqr",
            },
          ]
        : [];

      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html: htmlBody,
        attachments,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      console.error("Error al enviar credencial con Gmail SMTP:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 2. Fallback si no hay variables SMTP configuradas
  console.warn("⚠️ [GPQR EMAIL] No hay credenciales SMTP configuradas (SMTP_USER y SMTP_PASSWORD)");
  return {
    success: false,
    error: "Servidor de correo no configurado (faltan variables SMTP_USER y SMTP_PASSWORD en el servidor).",
    previewUrl: ticketUrl,
  };
}
