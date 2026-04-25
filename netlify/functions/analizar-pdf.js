const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { texto } = JSON.parse(event.body || '{}');
    if (!texto) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'sin texto' }) };
    }

    const APIKEY = process.env.ANTHROPIC_API_KEY;
    if (!APIKEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key no configurada' }) };
    }

    const respuesta = await new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 800,
        system: 'Eres experto en polizas de seguros mexicanas. Extrae datos del ASEGURADO unicamente, nunca de la aseguradora ni del agente. Devuelve SOLO JSON sin markdown:\n{"nombre":"","rfc":"","tel":"","email":"","direccion":"","nacimiento":"","numPoliza":"","tipo":"","aseg":"","vigencia":"","prima":"","coberturas":""}',
        messages: [{ role: 'user', content: texto.substring(0, 5000) }]
      });

      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': APIKEY,
          'anthropic-version': '2023-06-01'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error('Claude API ' + res.statusCode + ': ' + data.substring(0, 300)));
            return;
          }
          try {
            const json = JSON.parse(data);
            const txt = json.content[0].text.replace(/```json|```/g, '').trim();
            const match = txt.match(/\{[\s\S]*\}/);
            resolve(match ? JSON.parse(match[0]) : { error: 'sin JSON', raw: txt.substring(0, 100) });
          } catch(e) {
            reject(new Error('parse error: ' + e.message));
          }
        });
      });

      req.on('error', e => reject(new Error('https: ' + e.message)));
      req.setTimeout(25000, () => reject(new Error('timeout')));
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify(respuesta) };

  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
