import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec } from 'child_process';
import { quote } from 'shell-quote';
import * as fs from 'fs/promises'; // Use promises version of fs

/**
 * Tool: Ping Tool
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'ping-tool',
    {
      title: 'Ping Tool',
      description: 'Performs a network ping to a specified host and returns detailed JSON results.',
      inputSchema: {
        target: z.string().describe('The IP address or hostname to ping.'),
        count: z.string().optional().describe('The number of ping requests to send. Default is 4.'),
        timeout: z.string().optional().describe('The timeout in seconds for each ping request. Default is 5.'),
        output_path: z.string().optional().describe('Path to a file to save the ping results.'),
      },
    },
    async (params) => {
      const { target, count = '4', timeout = '5', output_path } = params;

      try {
        const platform = process.platform;
        let command: string;
        let rawResult: string = '';
        let parsedResult: any = { target: target };

        if (platform === 'win32') {
          // Windows ping command
          command = `ping -n ${quote([count])} -w ${quote([timeout])} ${quote([target])}`;
        } else {
          // Linux/Unix ping command
          command = `ping -c ${quote([count])} -W ${quote([timeout])} ${quote([target])}`;
        }

        rawResult = await new Promise<string>((resolve, reject) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`Ping failed: ${stderr || stdout}`));
            } else {
              resolve(stdout);
            }
          });
        });

        parsedResult.raw_output = rawResult;

        // Parse ping output for more detailed results (Linux-focused regex)
        if (platform !== 'win32') {
          const transmittedMatch = rawResult.match(/(\d+)\s+packets\s+transmitted/);
          const receivedMatch = rawResult.match(/(\d+)\s+received/);
          const lossMatch = rawResult.match(/(\d+)%\s+packet\s+loss/);
          const rttMatch = rawResult.match(/rtt\s+min\/avg\/max\/mdev\s+=\s+(\d+\.\d+)\/(\d+\.\d+)\/(\d+\.\d+)\/(\d+\.\d+)\s+ms/);
          const ipMatch = rawResult.match(/PING\s+.*\s+\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/);

          if (ipMatch && ipMatch[1]) {
            parsedResult.ip_address = ipMatch[1];
          }

          parsedResult.packets = {
            transmitted: transmittedMatch ? parseInt(transmittedMatch[1], 10) : null,
            received: receivedMatch ? parseInt(receivedMatch[1], 10) : null,
            loss_percentage: lossMatch ? parseInt(lossMatch[1], 10) : null,
          };

          if (rttMatch) {
            parsedResult.rtt = {
              min_ms: parseFloat(rttMatch[1]),
              avg_ms: parseFloat(rttMatch[2]),
              max_ms: parseFloat(rttMatch[3]),
              mdev_ms: parseFloat(rttMatch[4]),
            };
          }
        } // Could add Windows parsing here if needed

        const jsonResult = JSON.stringify(parsedResult, null, 2);

        if (output_path) {
          await fs.writeFile(output_path, jsonResult);
          return {
            content: [{ type: 'text', text: `Ping results saved to ${output_path}` }],
          };
        }

        return { content: [{ type: 'text', text: jsonResult }] };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error performing ping: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
};

export default registerTool;
