// CMS REPORT Login Proxy Server — HTTPS (fixes ERR_CLEARTEXT_NOT_PERMITTED)
// Zero dependencies — Node built-ins only
// Run: node secure-server.js   → open https://localhost:3443

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const HTTPS_PORT = 3443;
const HTTP_PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const KEY_FILE = path.join(__dirname, 'key.pem');
const CERT_FILE = path.join(__dirname, 'cert.pem');

const CONFIG = {
  LOGIN_PAGE: 'https://cms.indianrail.gov.in/CMSREPORT/JSPRWD/rpt/ReportLogin.jsp',
  CAPTCHA_URL: 'https://cms.indianrail.gov.in/CMSREPORT/JSP/rpt/LoginAction.do?hmode=getCaptch',
  LOGIN_ACTION_URL: 'https://cms.indianrail.gov.in/CMSREPORT/JSP/rpt/LoginAction.do',
  UA: 'Mozilla/5.0 (X11; Linux x86_64; rv:159.0) Gecko/20100101 Firefox/159.0',
};

let sessionCookie = '';

function httpsGet(url, extraHeaders) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = Object.assign({
      'User-Agent': CONFIG.UA,
      'Referer': CONFIG.LOGIN_PAGE,
      'Accept': '*/*',
      'Cookie': sessionCookie,
    }, extraHeaders || {});
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers,
    }, (res) => {
      const sc = res.headers['set-cookie'];
      if (sc) sessionCookie = sc.map(c => c.split(';')[0]).join('; ');
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function httpsPost(url, formData) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = new URLSearchParams(formData).toString();
    const headers = {
      'User-Agent': CONFIG.UA,
      'Referer': CONFIG.LOGIN_PAGE,
      'Origin': 'https://cms.indianrail.gov.in',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Accept': 'text/html, application/xhtml+xml, */*',
      'Cookie': sessionCookie,
    };
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers,
    }, (res) => {
      const sc = res.headers['set-cookie'];
      if (sc) sessionCookie = sc.map(c => c.split(';')[0]).join('; ');
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

function sendJSON(res, obj, code = 200) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

// ====== HTTPS Server ======
const httpsServer = https.createServer({
  key: fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
}, async (req, res) => {
  const u = new URL(req.url, `https://localhost:${HTTPS_PORT}`);
  const pathname = u.pathname;
  console.log(`[HTTPS REQ] ${req.method} ${pathname}`);

  try {
    // Serve index.html
    if (pathname === '/' || pathname === '/index.html') {
      const fp = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(500); return res.end('index.html missing'); }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }

    // GET /captcha
    if (pathname === '/captcha' && req.method === 'GET') {
      const rand = Math.random().toString().substring(0, 9);
      const url = `${CONFIG.CAPTCHA_URL}&rand_number=${rand}&random=${rand}`;
      try {
        const r = await httpsGet(url, { 'Accept': 'image/jpeg, image/png, */*' });
        res.writeHead(r.status, {
          'Content-Type': r.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'no-store',
        });
        res.end(r.body);
      } catch (err) {
        res.writeHead(500); res.end('captcha error: ' + err.message);
      }
      return;
    }

    // POST /login
    if (pathname === '/login' && req.method === 'POST') {
      const { username, password, captcha } = await readBody(req);
      if (!username || !password || !captcha) {
        return sendJSON(res, { error: 'Missing username, password, or captcha' }, 400);
      }
      const rand = Math.random().toString().substring(0, 9);
      try {
        const r = await httpsPost(CONFIG.LOGIN_ACTION_URL, {
          userId: username,
          userPassword: password,
          jcaptcha: captcha,
          random: rand,
          isResponsive: 'Y',
          hmode: 'Login',
        });
        const loc = r.headers['location'] || null;
        const bodyText = r.body;
        console.log('[LOGIN] Status:', r.status, 'Location:', loc);
        console.log('[LOGIN] Body:', bodyText.slice(0, 300));
        const captchaError = /valid captcha|captcha|invalid/i.test(bodyText);
        const success = !captchaError && r.status === 200;
        sendJSON(res, {
          status: r.status, location: loc, success, captchaError,
          bodySnippet: bodyText.slice(0, 400),
          message: captchaError ? 'Invalid captcha' :
            (loc ? 'Login OK — redirected to OTP page' : 'Login response received'),
        });
      } catch (err) {
        sendJSON(res, { error: 'login error: ' + err.message }, 500);
      }
      return;
    }

    // GET /otp
    if (pathname === '/otp' && req.method === 'GET') {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OTP</title>
        <style>body{font-family:sans-serif;max-width:400px;margin:40px auto;padding:20px}
        input{width:100%;padding:12px;margin:12px 0;border:1px solid #ddd;border-radius:6px}
        button{width:100%;padding:12px;background:#003366;color:#fff;border:none;border-radius:6px;font-size:1rem}</style>
        </head><body><h2>📱 OTP Verification</h2><p>Enter OTP sent to registered mobile.</p>
        <input type="text" id="otp" maxlength="6" placeholder="6-digit OTP">
        <button onclick="verify()">Verify OTP</button><div id="msg" style="margin-top:12px;color:#d33"></div>
        <script>
          async function verify(){
            const otp = document.getElementById('otp').value.trim();
            if(!otp){ document.getElementById('msg').innerText='Enter OTP'; return; }
            const r = await fetch('/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({otp})});
            const d = await r.json();
            document.getElementById('msg').innerText = d.message || d.error || 'OK';
          }
        </script></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    if (pathname === '/verify-otp' && req.method === 'POST') {
      return sendJSON(res, { success: false, message: 'OTP endpoint not yet mapped (Phase 1)' });
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error('[HTTPS ERROR]', err.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('server error: ' + err.message);
    }
  }
});

// ====== HTTP Redirect Server ======
const httpServer = http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://localhost:${HTTPS_PORT}${req.url}` });
  res.end();
});

httpsServer.listen(HTTPS_PORT, () => {
  console.log('====================================');
  console.log(' CMS REPORT Login Proxy Server');
  console.log('====================================');
  console.log(` HTTPS: https://localhost:${HTTPS_PORT}`);
  console.log(` HTTP:  http://localhost:${HTTP_PORT} (redirects to HTTPS via server.js)`);
  console.log(' Open in browser: https://localhost:3443');
  console.log('====================================');
});