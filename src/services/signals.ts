import type { Signal } from '@/types/signals'

// Alamat backend. Bisa diganti lewat VITE_API_URL di file .env.local.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Backend FastAPI mengirim alasan kegagalan di field `detail`.
async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = await response.json()
    return typeof body?.detail === 'string' ? body.detail : null
  } catch {
    return null
  }
}

export async function getSignals(): Promise<Signal[]> {
  let response: Response

  try {
    response = await fetch(`${API_URL}/signals`)
  } catch {
    throw new Error(`Tidak bisa menghubungi backend di ${API_URL}. Pastikan server berjalan.`)
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    const suffix = detail ? `: ${detail}` : ''
    throw new Error(`Gagal memuat sinyal (HTTP ${response.status})${suffix}`)
  }

  return response.json()
}
