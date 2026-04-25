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

  // TEST: verificar que la función corre
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'funcion OK', node: process.version }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const texto = body.texto || '';
    
    if (!texto) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'sin texto recibido', bodyRecibido: event.body ? event.body.substring(0,100) : 'vacio' }) };
    }

    const APIKEY = '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';

    const respuesta = await new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 800,
        system: 'Eres experto en polizas de seguros mexicanas. Extrae datos del ASEGURADO unicamente. Devuelve SOLO JSON sin markdown:\n{"nombre":"","rfc":"","tel":"","email":"","direccion":"","nacimiento":"","numPoliza":"","tipo":"","aseg":"","vigencia":"","prima":"","coberturas":""}',
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
            const txt = json.content[0].text.replace(/```json|```/g,'').trim();
            const match = txt.match(/\{[\s\S]*\}/);
            resolve(match ? JSON.parse(match[0]) : { error: 'no JSON en respuesta', raw: txt.substring(0,100) });
          } catch(e) {
            reject(new Error('parse: ' + e.message + ' data: ' + data.substring(0,100)));
          }
        });
      });

      req.on('error', e => reject(new Error('https error: ' + e.message)));
      req.setTimeout(25000, () => reject(new Error('timeout 25s')));
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify(respuesta) };

  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
      
