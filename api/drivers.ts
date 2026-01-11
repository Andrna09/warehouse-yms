import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Pastikan Metode Pengiriman Benar (Harus POST)
  // Mencegah akses langsung dari browser (GET) yang tidak diinginkan
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed (Gunakan POST)' });
  }

  const { target, message } = req.body;

  // 2. AMBIL TOKEN DARI VERCEL ENVIRONMENT VARIABLES
  // Pastikan Anda sudah memasukkan "FONNTE_TOKEN" di Dashboard Vercel
  const token = process.env.FONNTE_TOKEN;

  // Cek Kritis: Apakah token ada?
  if (!token) {
    console.error("FATAL ERROR: FONNTE_TOKEN hilang dari Environment Variables Vercel.");
    console.error("Solusi: Buka Vercel > Project Settings > Environment Variables > Tambahkan FONNTE_TOKEN");
    
    return res.status(500).json({ 
      error: 'Server Misconfiguration: Token WA belum disetting di Vercel.',
      action: 'Check Vercel Logs for details'
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
        countryCode: '62', // Fitur: Otomatis ubah 08xx menjadi 628xx
      }),
    });

    const data = await response.json();

    // 4. VALIDASI RESPON DARI FONNTE (BAGIAN PENTING!)
    // Fonnte bisa me-return status 200 HTTP meskipun pesan GAGAL terkirim (misal: nomor salah).
    // Kita wajib mengecek properti "status" di dalam body JSON.
    
    if (!data.status) {
        // Jika status = false, berarti GAGAL.
        console.error("Fonnte API Menolak Request:", data);
        
        // Kita return Error 500 supaya Frontend (dataService.ts) tahu ini gagal
        return res.status(500).json({ 
            error: 'Gagal mengirim WA (Ditolak Provider)',
            reason: data.reason || 'Token salah, kuota habis, atau nomor tidak valid',
            debug_info: data
        });
    }

    // Jika sampai sini, berarti SUKSES Murni
    return res.status(200).json(data);

  } catch (error: any) {
    // Error Jaringan atau Server Crash
    console.error('WhatsApp Handler Crash:', error);
    return res.status(500).json({ 
        error: 'Internal Server Error saat menghubungi WhatsApp',
        details: error.message 
    });
  }
}
