// Stands in for the Supabase API gateway in front of the local PostgREST.
//
// supabase-js posts to <url>/rest/v1/rpc/<fn> and attaches `apikey` and an
// Authorization bearer. The bearer is a publishable key, not a JWT, and PostgREST
// with no configured jwt-secret rejects it as malformed, so this strips both
// headers and maps the path. Real Supabase does the same translation in Kong.
import http from 'node:http';

const UPSTREAM = { host: '127.0.0.1', port: 3002 };

http
  .createServer((request, response) => {
    const path = request.url.replace(/^\/rest\/v1/, '') || '/';

    const headers = { ...request.headers };
    delete headers.authorization;
    delete headers.apikey;
    delete headers.host;

    const upstream = http.request(
      { ...UPSTREAM, method: request.method, path, headers },
      (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      },
    );

    upstream.on('error', (error) => {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: String(error) }));
    });

    request.pipe(upstream);
  })
  .listen(3001, '127.0.0.1', () => console.log('supabase shim on 3001 -> postgrest 3002'));
