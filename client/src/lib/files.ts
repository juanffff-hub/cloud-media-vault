export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf';
export type MediaCategory = 'imagen' | 'video' | 'pdf';
const formats: Record<string, { extensions: string[]; category: MediaCategory }> = {
  'image/jpeg': { extensions: ['jpg', 'jpeg'], category: 'imagen' },
  'image/png': { extensions: ['png'], category: 'imagen' },
  'image/webp': { extensions: ['webp'], category: 'imagen' },
  'video/mp4': { extensions: ['mp4'], category: 'video' },
  'video/webm': { extensions: ['webm'], category: 'video' },
  'application/pdf': { extensions: ['pdf'], category: 'pdf' },
};
export interface UploadDraft { titulo: string; subidoPor: string; archivo: File }
export type FormErrors = Partial<Record<'titulo' | 'subidoPor' | 'archivo', string>>;
export function fileCategory(file: File): MediaCategory | undefined { return formats[file.type]?.category; }
export function validateFile(file?: File | null): string | undefined {
  if (!file) return 'Selecciona un archivo para continuar.';
  if (!file.size) return 'Este archivo está vacío. Elige otro.';
  if (file.size > MAX_FILE_BYTES) return 'El archivo supera los 10 MB. Elige uno más pequeño.';
  const format = Object.hasOwn(formats, file.type) ? formats[file.type] : undefined;
  if (!format || !format.extensions.includes(file.name.split('.').at(-1)?.toLowerCase() ?? '')) return 'Elige una imagen JPEG, PNG o WebP, un video MP4 o WebM, o un PDF.';
}
export function validateDraft(titulo: string, subidoPor: string, archivo?: File | null): FormErrors {
  const errors: FormErrors = {};
  for (const [key, raw, max, label] of [['titulo', titulo, 160, 'título'], ['subidoPor', subidoPor, 100, 'autor']] as const) {
    const value = raw.normalize('NFC').trim();
    if (!value) errors[key] = `Escribe el ${label} del archivo.`;
    else if (value.length > max || /[\x00-\x1f\x7f-\x9f]/.test(value)) errors[key] = `Revisa el ${label}: máximo ${max} caracteres, sin caracteres de control.`;
  }
  const fileError = validateFile(archivo);
  if (fileError) errors.archivo = fileError;
  return errors;
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}
