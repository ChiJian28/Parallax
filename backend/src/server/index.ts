import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadX402Config } from './config.js';
import { handleRunCorrelation } from './routes/correlation-run.js';
import { handleRunAcquisition } from './routes/acquisition.js';
import { handleAgentCard } from './routes/agent-card.js';
import { handleGetTask, handleListTasks, handleMessageSend } from './routes/a2a.js';
import { handleListMacroEvents, handleResolveMacroEvent } from './routes/macro-events.js';
import { handleGetReport, handleListReports } from './routes/reports.js';
import { handleGetFeedbackFeed, handleGetReputation } from './routes/reputation.js';
import { handlePrepareFeedbackIpfs } from './routes/feedback-prepare.js';
import { sendJson } from './http-utils.js';

type RouteHandler = (
  config: Awaited<ReturnType<typeof loadX402Config>>,
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => Promise<void> | void;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames?: string[];
  handler: RouteHandler;
}

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/health$/,
    handler: (_config, _req, res) => {
      sendJson(res, 200, { status: 'ok', service: 'parallax-gateway' });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/run-correlation$/,
    handler: (config, req, res) => handleRunCorrelation(config, req, res),
  },
  {
    method: 'POST',
    pattern: /^\/api\/acquisition\/run$/,
    handler: (config, req, res) => handleRunAcquisition(config, req, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/reports$/,
    handler: (config, _req, res) => handleListReports(config, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/macro-events$/,
    handler: (config, _req, res) => handleListMacroEvents(config, res),
  },
  {
    method: 'POST',
    pattern: /^\/api\/macro-events\/resolve$/,
    handler: (config, req, res) => handleResolveMacroEvent(config, req, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/reputation\/([^/]+)$/,
    paramNames: ['agentId'],
    handler: (_config, _req, res, params) => handleGetReputation(res, params.agentId),
  },
  {
    method: 'GET',
    pattern: /^\/api\/reputation\/([^/]+)\/feedback$/,
    paramNames: ['agentId'],
    handler: (_config, _req, res, params) => handleGetFeedbackFeed(res, params.agentId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/feedback\/prepare-ipfs$/,
    handler: (_config, req, res) => handlePrepareFeedbackIpfs(req, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/report\/([^/]+)$/,
    paramNames: ['eventId'],
    handler: (config, req, res, params) => handleGetReport(config, req, res, params.eventId),
  },
  {
    method: 'GET',
    pattern: /^\/\.well-known\/agent-card\.json$/,
    handler: (config, _req, res) => handleAgentCard(config, res),
  },
  {
    method: 'GET',
    pattern: /^\/a2a\/\.well-known\/agent-card\.json$/,
    handler: (config, _req, res) => handleAgentCard(config, res),
  },
  {
    method: 'POST',
    pattern: /^\/a2a\/v1\/message:send$/,
    handler: (config, req, res) => handleMessageSend(config, req, res),
  },
  {
    method: 'POST',
    pattern: /^\/a2a\/message:send$/,
    handler: (config, req, res) => handleMessageSend(config, req, res),
  },
  {
    method: 'GET',
    pattern: /^\/a2a\/v1\/tasks$/,
    handler: (config, _req, res) => handleListTasks(config, res),
  },
  {
    method: 'GET',
    pattern: /^\/a2a\/tasks$/,
    handler: (config, _req, res) => handleListTasks(config, res),
  },
  {
    method: 'GET',
    pattern: /^\/a2a\/v1\/tasks\/([^/]+)$/,
    paramNames: ['taskId'],
    handler: (config, _req, res, params) => handleGetTask(config, res, params.taskId),
  },
  {
    method: 'GET',
    pattern: /^\/a2a\/tasks\/([^/]+)$/,
    paramNames: ['taskId'],
    handler: (config, _req, res, params) => handleGetTask(config, res, params.taskId),
  },
];

function matchRoute(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    const names = route.paramNames ?? [];
    for (let i = 0; i < names.length; i++) {
      const value = match[i + 1];
      if (value !== undefined) params[names[i]] = decodeURIComponent(value);
    }

    return { route, params };
  }
  return null;
}

export async function startServer(): Promise<void> {
  const config = await loadX402Config();
  const port = Number(process.env.PORT ?? 8787);

  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT, A2A-Version',
          'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
        });
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const matched = matchRoute(req.method ?? 'GET', url.pathname);

      if (!matched) {
        sendJson(res, 404, { error: 'Not found', path: url.pathname });
        return;
      }

      await matched.route.handler(config, req, res, matched.params);
    } catch (error) {
      console.error('Request error:', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  server.listen(port, () => {
    console.log('Parallax Module 4 — x402 & A2A Gateway');
    console.log(`  Listening:  http://localhost:${port}`);
    console.log(`  Correlation: POST /api/run-correlation`);
    console.log(`  Acquisition: POST /api/acquisition/run`);
    console.log(`  Reports:    GET /api/report/:eventId`);
    console.log(`  Macro:      POST /api/macro-events/resolve`);
    console.log(`  Agent card: GET /.well-known/agent-card.json`);
    console.log(`  A2A:        POST /a2a/v1/message:send`);
    console.log(`  Pay-to:     ${config.payTo}`);
    console.log(`  x402 dev:   ${config.devBypass ? 'BYPASS enabled' : 'facilitator verify'}`);
  });
}
