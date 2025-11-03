import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';

export default function getSystemInfo(server: McpServer) {
  server.registerTool(
    'get-system-info',
    {
      title: 'Get System Information',
      description: 'Retrieves information about the host system, such as OS, CPU, and memory.',
      inputSchema: {},
    },
    async () => {
      try {
        const cpus = os.cpus();
        const systemInfo = {
          platform: os.platform(),
          osType: os.type(),
          osRelease: os.release(),
          architecture: os.arch(),
          hostname: os.hostname(),
          totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
          freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
          cpuCount: cpus.length,
          cpuModel: cpus.length > 0 ? cpus[0].model : 'N/A',
          uptimeSeconds: Math.round(os.uptime()),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(systemInfo, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `An error occurred: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
