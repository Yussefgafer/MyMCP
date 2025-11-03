import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import registryTools from './tools';

// Create MCP server
const server = new McpServer({
  name: 'file-operation-server',
  version: '1.0.0'
});

// Register tools
registryTools(server);

// Start the server
async function main() {
  try {
    // SSE Server
    const app = express();
    app.use(express.json());

    // Store transport sessions
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // CORS Configuration
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // SSE Connection Endpoint
    app.get('/sse', async (req, res) => {
      console.log('New SSE connection');

      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      // Clean up disconnected connections
      res.on('close', () => {
        console.log(`SSE connection closed: ${sessionId}`);
        delete transports[sessionId];
      });

      await server.connect(transport);
    });

    // Message Endpoint
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];

      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('Transport for session ID not found');
      }
    });

    // Health Check Endpoint
    app.get('/health', (req, res) => {
      console.log('Health check endpoint hit');
      try {
        res.status(200).send('OK');
      } catch (error) {
        console.error('Error in health check endpoint:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`MCP File Operation Server started on port ${PORT}`);
      console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Start server
main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
