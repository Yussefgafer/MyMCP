import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function registerMonitorResourcesTool(server: McpServer) {
  server.registerTool(
    'monitor-resources',
    {
      title: 'Monitor System Resources',
      description: 'Monitors CPU, memory, disk usage, and other system resources.',
      inputSchema: {
        detail_level: z.enum(['basic', 'detailed']).optional().default('basic').describe('Level of detail to show'),
        include_processes: z.boolean().optional().default(false).describe('Include top processes consuming resources'),
        max_processes: z.number().min(1).max(20).optional().default(10).describe('Maximum number of processes to show'),
      },
    },
    async (params: { detail_level?: 'basic' | 'detailed'; include_processes?: boolean; max_processes?: number }) => {
      try {
        const { detail_level = 'basic', include_processes = false, max_processes = 10 } = params;

        // Get basic system information
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);

        const cpus = os.cpus();
        const cpuCount = cpus.length;
        const loadAverage = os.loadavg();

        // Get CPU usage (this is a simple approximation)
        const cpuUsage = ((loadAverage[0] / cpuCount) * 100).toFixed(1);

        let output = `# System Resource Monitor
## Memory Usage
- Total: ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB
- Used: ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB
- Free: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB
- Usage: ${memoryUsagePercent}%

## CPU Usage
- Cores: ${cpuCount}
- Usage: ${cpuUsage}%
- Load Average (1/5/15 min): ${loadAverage.map(l => l.toFixed(2)).join(', ')}

## Platform Info
- Platform: ${os.platform()}
- Architecture: ${os.arch()}
- Uptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m
`;

        if (detail_level === 'detailed') {
          try {
            // Get disk usage (Unix/Linux only)
            if (os.platform() !== 'win32') {
              const { stdout: dfOutput } = await execPromise('df -h /');
              output += `\n## Disk Usage (Root)\n${dfOutput}`;
            }

            // Get network interfaces
            const networkInterfaces = os.networkInterfaces();
            output += '\n## Network Interfaces\n';
            for (const [name, interfaces] of Object.entries(networkInterfaces)) {
              if (interfaces) {
                for (const networkInterface of interfaces) {
                  if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                    output += `- ${name}: ${networkInterface.address}\n`;
                  }
                }
              }
            }
          } catch (error) {
            // Ignore errors for additional details
          }
        }

        if (include_processes) {
          try {
            let processCommand = '';
            if (os.platform() === 'win32') {
              processCommand = `powershell "Get-Process | Sort-Object CPU -Descending | Select-Object -First ${max_processes} | Format-Table ProcessName, CPU, WorkingSet -AutoSize"`;
            } else {
              processCommand = `ps aux --sort=-%cpu | head -n ${max_processes + 1} | awk '{print $1, $2, $3"%", $4"%", $11}'`;
            }

            const { stdout: processOutput } = await execPromise(processCommand);

            output += `\n## Top ${max_processes} Processes by CPU Usage\n`;
            output += processOutput;
          } catch (error) {
            output += '\n## Process Information (Unavailable)\nCould not retrieve process information.\n';
          }
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error monitoring resources: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
