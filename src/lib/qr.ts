import QRCode from "qrcode";
import JSZip from "jszip";
import { RegistrationItem } from "./db";

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Genera un DataURL en formato PNG para un código QR
 */
export async function generateQRDataURL(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options?.width ?? 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark ?? "#000000",
      light: options?.color?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

/**
 * Genera un Buffer en formato PNG para un código QR (para correos y adjuntos en Node.js)
 */
export async function generateQRBuffer(
  text: string,
  options?: QRCodeOptions
): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    width: options?.width ?? 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark ?? "#000000",
      light: options?.color?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

/**
 * Genera un SVG string para un código QR
 */
export async function generateQRSvg(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width: options?.width ?? 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark ?? "#000000",
      light: options?.color?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

/**
 * Descarga una imagen Data URL en el navegador
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Genera un archivo ZIP con todos los códigos QR de los participantes
 */
export async function generateQRCodesZip(
  registrations: RegistrationItem[],
  eventName: string = "Evento"
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `QRs_${eventName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const folder = zip.folder(folderName);

  for (const reg of registrations) {
    const dataUrl = await generateQRDataURL(reg.qr_token, {
      width: 600,
      margin: 2,
    });
    // Remove data:image/png;base64, prefix
    const base64Data = dataUrl.split(",")[1];
    const cleanDoc = reg.document_number.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanName = reg.full_name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${cleanDoc}_${cleanName}.png`;

    folder?.file(fileName, base64Data, { base64: true });
  }

  // Include a summary index in JSON format
  const manifest = registrations.map((r) => ({
    documento: r.document_number,
    nombre: r.full_name,
    email: r.email,
    token: r.qr_token,
    archivo: `${r.document_number}_${r.full_name}.png`,
  }));
  folder?.file("asistentes_indice.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "blob" });
}
