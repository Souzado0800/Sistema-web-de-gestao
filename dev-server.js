/**
 * Servidor de Desenvolvimento Local.
 * Emula o ambiente da Netlify (executando as Netlify Functions e servindo a SPA estática em public/).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const config = require('./backend/config');
const apiFunction = require('./netlify/functions/api');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Roteamento de API Serverless (emula Netlify Functions)
  if (pathname.startsWith('/api') || pathname.startsWith('/.netlify/functions')) {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      const event = {
        httpMethod: req.method,
        path: pathname,
        queryStringParameters: parsedUrl.query,
        headers: req.headers,
        body: bodyData || null
      };

      try {
        const result = await apiFunction.handler(event, {});
        const headers = result.headers || {};
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        res.writeHead(result.statusCode || 200);
        res.end(result.body || '');
      } catch (err) {
        console.error('Erro no handler da API:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro interno no servidor local' }));
      }
    });
    return;
  }

  // 2. Arquivos Estáticos (public/)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // 3. Fallback de SPA (Regra da Netlify: /* -> /index.html 200)
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('index.html não encontrado na pasta public/');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
    }
  });
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`  SISTEMA DE GESTÃO DE ESTOQUE — AMBIENTE LOCAL (NETLIFY EMULATOR)`);
  console.log(`  Acesse no navegador: http://localhost:${PORT}`);
  console.log(`  API Serverless em:  http://localhost:${PORT}/api/`);
  console.log('================================================================');
});
