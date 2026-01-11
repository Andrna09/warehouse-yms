import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target, message } = req.body;

  // SECURITY UPDATE: Menggunakan Environment Variables
  const token = process.env.FONNTE_TOKEN;

  if (!token) {
    console.error("Fonnte Token is missing from env variables");
    return res.status(500).json({ error: 'Server configuration error: WA Token missing' });
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: target, // Group ID or Phone Number
        message: message,
        countryCode: '62',
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('WhatsApp Error:', error);
    return res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
}
