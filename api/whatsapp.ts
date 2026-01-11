import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Pastikan Metode Pengiriman Benar (Harus POST)
  // Mencegah akses iseng lewat browser biasa (GET)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed (Gunakan POST)' });
  }

  const { target, message } = req.body;

  // 2. AMBIL TOKEN DARI VERCEL SETTINGS
  // Pastikan di Dashboard Vercel > Settings > Env Variables namanya PERSIS "FONNTE_TOKEN"
  const token = process.env.FONNTE_TOKEN;

  // Cek Kritis: Apakah token ada?
  if (!token) {
    console.error("FATAL ERROR: FONNTE_TOKEN hilang dari Environment Variables Vercel.");
    console.error("Solusi: Buka Vercel > Settings > Environment Variables > Tambahkan FONNTE_TOKEN");
    
    return res.status(500).json({ 
      error: 'Server Misconfiguration: Token WA belum disetting.',
      action: 'Check Vercel Logs'
    });
  }

  try {
    // 3. KIRIM PERMINTAAN KE API FONNTE
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: '62', // Fitur Bagus: Otomatis ubah 08xx jadi 628xx
      }),
    });

    const data = await response.json();

    // 4. VALIDASI RESPON FONNTE (BAGIAN PENTING!)
    // Fonnte kadang merespon status 200 meskipun gagal kirim (misal: kuota habis / nomor salah).
    // Kita harus cek body response-nya.
    
    if (!data.status) {
        // Jika status = false, berarti GAGAL.
        console.error("Fonnte API Menolak:", data);
        
        // Kita kembalikan error 500 agar Frontend tahu ini gagal
        return res.status(500).json({ 
            error: 'Gagal mengirim WA (Ditolak Provider)',
            reason: data.reason || 'Token salah, kuota habis, atau nomor tidak valid',
            debug: data
        });
    }

    // Jika sampai sini, berarti SUKSES
    return res.status(200).json(data);

  } catch (error: any) {
    // Error Jaringan / Server Crash
    console.error('WhatsApp Handler Crash:', error);
    return res.status(500).json({ 
        error: 'Internal Server Error saat menghubungi WhatsApp',
        details: error.message 
    });
  }
}
