import {createReplyGenerator} from './src/reply-generation.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createDemoSystem} from './src/operations.js';
import {createStoredDemoSystem} from './src/local-state.js';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Fictional demo only: one owner, optional server-side model providers, no delivery provider.
export function createDashboardServer(system = createDemoSystem(), replyGenerator = createReplyGenerator()) {
  const caller = {actorId: 'demo-dave', workspaceId: 'work'};
  const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/drafts.js': ['drafts.js', 'text/javascript'], '/campaign.js': ['campaign.js', 'text/javascript'], '/export.js': ['export.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css']};
  return createServer(async (req, res) => {
    const respond = (status, value) => {res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const address = res.socket.localAddress;
    const port = res.socket.localPort;
    const expectedHost = `127.0.0.1:${port}`;
    const allowedHosts = new Set([expectedHost, `localhost:${port}`]);
    if (!allowedHosts.has(req.headers.host) || !['127.0.0.1', '::ffff:127.0.0.1'].includes(address)) return respond(403, {error: {message: 'Use the local dashboard address.'}});
    try {
      const requestOrigin = `http://${req.headers.host}`;
      const path = new URL(req.url, requestOrigin).pathname;
      const showcaseFiles = {'/showcase': ['showcase.html', 'text/html'], '/showcase.js': ['showcase.js', 'text/javascript'], '/showcase.css': ['showcase.css', 'text/css']};
      const executiveFiles = {'/': 'index.html', '/executive/index.html': 'index.html', '/executive/app.js': 'app.js', '/executive/theme.js': 'theme.js', '/executive/workspace-policy.js': 'workspace-policy.js', '/executive/styles.css': 'styles.css', '/executive/theme.css': 'theme.css', '/executive/integration.js': 'integration.js', '/executive/integration.css': 'integration.css', '/executive/workspace.css': 'workspace.css', '/executive/reply/editor-state.js': 'reply/editor-state.js', '/executive/reply/core.js': 'reply/core.js', '/executive/reply/fixtures.js': 'reply/fixtures.js', '/executive/reply/browser-adapter.js': 'reply/browser-adapter.js'};
      if (req.method === 'GET' && Object.hasOwn(executiveFiles, path)) {
        const file = executiveFiles[path];
        const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript';
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        const content = await readFile(new URL(`./executive/${file}`, import.meta.url));
        res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`}); return res.end(content);
      }
      if (req.method === 'GET' && (Object.hasOwn(files, path) || Object.hasOwn(showcaseFiles, path) || path === '/campaigns')) {
        const [file, type] = path === '/campaigns' ? files['/'] : files[path] || showcaseFiles[path];
        const content = await readFile(new URL(`./web/${file}`, import.meta.url));
        res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`}); return res.end(content);
      }
      if (req.method === 'GET' && path === '/api/reply-generation/status') {
        const generation=replyGenerator.status || {defaultMode:'scripted',modes:{local:{enabled:replyGenerator.enabled===true},cloud:{enabled:false,configured:false,reason:'disabled'}}};
        return respond(200, {enabled:generation.modes.local.enabled,mode:generation.modes.local.enabled?'local-ollama':'scripted',...generation});
      }
      if (req.method === 'GET' && path === '/api/workflows') return respond(200, {workflows: system.repository.list().filter(w => w.actorId === caller.actorId && w.workspaceId === caller.workspaceId)});
      if (req.method !== 'POST' || !['/api/commands','/api/reply-generation','/api/assistant-query'].includes(path)) return respond(404, {error: {message: 'Not found.'}});
      if (req.headers.origin !== requestOrigin || req.headers['content-type'] !== 'application/json') return respond(403, {error: {message: 'Open this action from the local dashboard.'}});
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 64_000) return respond(413, {error: {message: 'The draft is too large.'}});
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let input;
      try {input = JSON.parse(body);} catch {return respond(400, {error: {message: 'Invalid request.'}});}
      if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(400, {error: {message: 'Invalid request.'}});
      if(path === '/api/reply-generation' || path === '/api/assistant-query') {
        const providerAbort=new AbortController();
        const abortProvider=()=>{if(!res.writableEnded)providerAbort.abort();};
        req.once('aborted',abortProvider);res.once('close',abortProvider);
        const result = path === '/api/assistant-query' && typeof replyGenerator.ask === 'function' ? await replyGenerator.ask(input,{signal:providerAbort.signal}) : path === '/api/reply-generation' ? await replyGenerator(input,{signal:providerAbort.signal}) : {ok:false,error:{code:'AI_UNAVAILABLE',message:'Optional AI answering is unavailable. Use Scripted mode.'}};
        req.off('aborted',abortProvider);res.off('close',abortProvider);
        if(res.destroyed)return;
        return respond(result.ok ? 200 : 409, result);
      }
      const {action, workflowId, request, campaignBrief, payload, versionId, baseVersionId, payloadDigest, approvalId} = input;
      if (!['start', 'revise', 'approve', 'execute', 'cancel', 'retryPreparation'].includes(action)) return respond(400, {error: {message: 'Unknown action.'}});
      if (action === 'start' && typeof request === 'string' && /\binbox\b|\b(reschedule|schedule|cancel|move|book)\b[^.!?\n]{0,80}\b(meetings?|appointments?)\b|\b(summarize|read|check)\b[^.!?\n]{0,40}\b(my|our)\s+emails?\b/i.test(request)) {
        return respond(400, {error: {code: 'UNSUPPORTED_REQUEST', message: 'Inbox and meeting tasks are not connected in this preview. Try a marketing campaign, launch post, or video script instead. Your request is kept for editing.'}});
      }
      if (action === 'revise' && (!payload || typeof payload.launchPost !== 'string' || typeof payload.shortVideoScript !== 'string' || !Array.isArray(payload.calendar) || !payload.calendar.every(v => typeof v === 'string'))) return respond(400, {error: {message: 'Draft must contain a launch post, video script, and calendar.'}});
      const result = system.operations[action]({...caller, workflowId, request, campaignBrief, payload, versionId, baseVersionId, payloadDigest, approvalId});
      return respond(result.ok ? 200 : 409, result);
    } catch {return respond(500, {error: {message: 'The local dashboard could not complete this request.'}});}
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const system = createStoredDemoSystem(fileURLToPath(new URL('./local-data/history.json', import.meta.url)));
  const server = createDashboardServer(system, createReplyGenerator({
    localEnabled:process.env.ORBIT_OLLAMA_ENABLED==='true',
    localModel:process.env.ORBIT_OLLAMA_MODEL || 'llama3.2',
    cloudEnabled:process.env.ORBIT_OLLAMA_CLOUD_ENABLED==='true',
    cloudModel:process.env.ORBIT_OLLAMA_CLOUD_MODEL || '',
    cloudApiKey:process.env.OLLAMA_API_KEY || ''
  }));
  server.listen(4317, '127.0.0.1', () => console.log('Orbit: http://127.0.0.1:4317 — local preview; history saved on this computer.'));
}
