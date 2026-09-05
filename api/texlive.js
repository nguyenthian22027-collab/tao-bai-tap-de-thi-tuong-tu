export default async function handler(req, res) {
  // Bật CORS cho phép frontend gọi từ mọi nguồn
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let documentContent = '';
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        documentContent = parsed.document || parsed.code || '';
      } catch {
        documentContent = req.body;
      }
    } else if (req.body && typeof req.body === 'object') {
      documentContent = req.body.document || req.body.code || '';
    }

    if (!documentContent || !documentContent.trim()) {
      return res.status(400).json({ error: 'Nội dung mã LaTeX/TikZ không được để trống.' });
    }

    // Đóng gói FormData gửi lên TeXLive.net pdflatex
    const formData = new FormData();
    const blob = new Blob([documentContent], { type: 'text/plain; charset=utf-8' });
    formData.append('filecontents[]', blob, 'document.tex');
    formData.append('filename[]', 'document.tex');
    formData.append('engine', 'pdflatex');
    formData.append('return', 'pdf');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    const upstream = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = upstream.headers.get('content-type') || '';
    if (upstream.ok && contentType.includes('pdf')) {
      const arrayBuffer = await upstream.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="figure.pdf"');
      return res.status(200).send(Buffer.from(arrayBuffer));
    } else {
      const errorLog = await upstream.text();
      return res.status(422).setHeader('Content-Type', 'text/plain; charset=utf-8').send(errorLog);
    }
  } catch (err) {
    return res.status(502).json({ error: 'Lỗi kết nối máy chủ TeXLive.net: ' + (err.message || String(err)) });
  }
}
