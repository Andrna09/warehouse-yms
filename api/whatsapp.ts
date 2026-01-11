import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https'; // Kita pakai library bawaan paling dasar

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Cek Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Ambil Token
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return res.status(500).json({ 
      error: 'Server Misconfiguration: FONNTE_TOKEN missing',
      action: 'Check Vercel Environment Variables'
    });
  }

  // 3. Ambil Data Body
  const { target, message } = req.body || {};
  if (!target || !message) {
    return res.status(400).json({ error: 'Target dan Message wajib diisi' });
  }

  // 4. Siapkan Data Kiriman
  const postData = JSON.stringify({
    target: target,
    message: message,
    countryCode: '62',
  });

  const options = {
    hostname: 'api.fonnte.com',
    path: '/send',
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  // 5. EKSEKUSI MANUAL (PENGGANTI FETCH)
  // Kode ini jalan di Node.js versi KUNO sekalipun
  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = '';

      // Terima data potong demi potong
      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      // Saat selesai terima data
      apiRes.on('end', () => {
        try {
          const jsonResponse = JSON.parse(data);
          
          if (!jsonResponse.status) {
             res.status(500).json({ error: 'Fonnte Rejected', detail: jsonResponse });
          } else {
             res.status(200).json(jsonResponse);
          }
          resolve();

        } catch (e) {
          res.status(500).json({ error: 'Invalid JSON from Fonnte', raw: data });
          resolve();
        }
      });
    });

    // Handle Error Koneksi
    apiReq.on('error', (e) => {
      console.error("Connection Error:", e);
      res.status(500).json({ error: 'Gagal koneksi ke Fonnte', details: e.message });
      resolve();
    });

    // Tulis data dan kirim
    apiReq.write(postData);
    apiReq.end();
  });
}
