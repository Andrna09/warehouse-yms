import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Pastikan Method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed (Gunakan POST)' });
  }

  // --- REVISI: SEMUA LOGIKA MASUK KE DALAM TRY/CATCH ---
  try {
    // Cek apakah body ada isinya
    if (!req.body) {
      throw new Error("Request Body kosong. Pastikan mengirim JSON.");
    }

    const { target, message } = req.body;

    // Validasi input
    if (!target || !message) {
      return res.status(400).json({ error: 'Target dan Message wajib diisi' });
    }

    // 2. Ambil Token
    const token = process.env.FONNTE_TOKEN;
    if (!token) {
      console.error("FATAL: FONNTE_TOKEN belum di-setting di Vercel.");
      return res.status(500).json({ 
        error: 'Server Config Error: Token WA belum ada.',
        action: 'Cek Environment Variables di Vercel'
      });
    }

    // 3. Kirim ke Fonnte
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: '62',
      }),
    });

    const data = await response.json();

    // 4. Cek Status dari Fonnte
    if (!data.status) {
      console.error("Fonnte Reject:", data);
      return res.status(500).json({
        error: 'Gagal kirim WA (Ditolak Provider)',
        reason: data.reason || 'Token salah / Kuota habis / Nomor invalid',
        debug: data
      });
    }

    // Sukses
    return res.status(200).json(data);

  } catch (error: any) {
    // JIKA CRASH, TANGKAP DISINI
    console.error('SERVER CRASH:', error);
    
    // Return JSON Error supaya frontend tidak "SyntaxError"
    return res.status(500).json({
      error: 'Terjadi kesalahan di Server (API Crash)',
      details: error.message || String(error)
    });
  }
}
