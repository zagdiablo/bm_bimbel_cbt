import { toast } from 'sonner';
import { ApiError } from './api-client';

const FRIENDLY: Record<string, string> = {
  NETWORK: 'Koneksi ke server terputus.',
  TIMEOUT: 'Server terlalu lama merespons.',
  LOCK_TIMEOUT: 'Server sedang sibuk memproses pengumpulan lain.',
  BACKEND_HTML: 'Konfigurasi Web App GAS belum benar.',
  NO_BACKEND: 'URL backend belum dikonfigurasi.',
  SESSION_EXPIRED: 'Sesi Anda berakhir. Silakan masuk kembali.',
  UNAUTHORIZED: 'Anda tidak memiliki akses.',
  FORBIDDEN: 'Tindakan ini tidak diizinkan.',
  RESULT_HIDDEN: 'Nilai belum dibuka oleh guru.',
  ALREADY_SUBMITTED: 'Ujian ini sudah Anda selesaikan.',
  INVALID_TOKEN: 'Token ujian tidak sesuai.',
  LOCKED: 'Data sedang diproses, coba lagi.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return FRIENDLY[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan yang tidak diketahui.';
}

export function toastError(error: unknown, title = 'Gagal'): void {
  toast.error(title, { description: errorMessage(error), duration: 6000 });
}

export function toastSuccess(message: string, description?: string): void {
  toast.success(message, { description });
}
