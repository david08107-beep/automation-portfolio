import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createDemoSystem} from './src/operations.js';
import {createStoredDemoSystem} from './src/local-state.js';
import {fileURLToPath} from 'node:url';

// Local demonstration only: one fictional owner, in-memory records, no providers.
export function createDashboardServer(system = createDemoSystem()) {
  const caller = {actorId: 'demo-dave', workspaceId: 'work'};
  const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/drafts.js': ['drafts.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css']};
  return createServer(async (req, res) => {
    const respond = (status, value) => {res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const address = res.socket.localAddress;
    const port = res.socket.localPort;
    const expectedHost = `127.0.0.1:${port}`;
    if (req.headers.host !== expectedHost || !['127.0.0.1', '::ffff:127.0.0.1'].includes(address)) return respond(403, {error: {message: 'Use the local dashboard address.'}});
    try {
      const path = new URL(req.url, `http://${expectedHost}`).pathname;
      if (req.method === 'GET' && files[path]) {
        const [file, type] = files[path];
        const content = await readFile(new URL(`./web/${file}`, import.meta.url));
        res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`}); return res.end(content);
      }
      if (req.method === 'GET' && path === '/api/workflows') return respond(200, {workflows: system.repository.list().filter(w => w.actorId === caller.actorId && w.workspaceId === caller.workspaceId)});
      if (req.method !== 'POST' || path !== '/api/commands') return respond(404, {error: {message: 'Not found.'}});
      if (req.headers.origin !== `http://${expectedHost}` || req.headers['content-type'] !== 'application/json') return respond(403, {error: {message: 'Open this action from the local dashboard.'}});
      let body = '';
      for await (const chunk of req) {body += chunk; if (Buffer.byteLength(body) > 64_000) return respond(413, {error: {message: 'The draft is too large.'}});}
      let input;
      try {input = JSON.parse(body);} catch {return respond(400, {error: {message: 'Invalid request.'}});}
      if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(400, {error: {message: 'Invalid request.'}});
      const {action, workflowId, request, payload, versionId, payloadDigest, approvalId} = input;
      if (!['start', 'revise', 'approve', 'execute', 'cancel', 'retryPreparation'].includes(action)) return respond(400, {error: {message: 'Unknown action.'}});
      if (action === 'revise' && (!payload || typeof payload.launchPost !== 'string' || typeof payload.shortVideoScript !== 'string' || !Array.isArray(payload.calendar) || !payload.calendar.every(v => typeof v === 'string'))) return respond(400, {error: {message: 'Draft must contain a launch post, video script, and calendar.'}});
      const result = system.operations[action]({...caller, workflowId, request, payload, versionId, payloadDigest, approvalId});
      return respond(result.ok ? 200 : 409, result);
    } catch {return respond(500, {error: {message: 'The local dashboard could not complete this request.'}});}
  });
}

if (process.argv[1] && new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const system = createStoredDemoSystem(fileURLToPath(new URL('./local-data/history.json', import.meta.url)));
  const server = createDashboardServer(system);
  server.listen(4317, '127.0.0.1', () => console.log('Orbit: http://127.0.0.1:4317 — local preview; history saved on this computer.'));
}
