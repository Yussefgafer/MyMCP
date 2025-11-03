import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function registerMemoryManagementTool(server: McpServer) {
  server.registerTool(
    'memory-management',
    {
      title: 'Memory Management',
      description: 'Manages system memory including cache clearing, memory info, and optimization.',
      inputSchema: {
        action: z.enum(['info', 'clear_cache', 'free_memory', 'monitor', 'optimize']).describe('Action to perform'),
        target: z.enum(['page_cache', 'swap', 'slab', 'all', 'processes']).optional().describe('Target for cache clearing'),
        interval: z.number().optional().default(5).describe('Monitoring interval in seconds'),
        duration: z.number().optional().default(30).describe('Monitoring duration in seconds'),
      },
    },
    async (params: {
      action: 'info' | 'clear_cache' | 'free_memory' | 'monitor' | 'optimize';
      target?: 'page_cache' | 'swap' | 'slab' | 'all' | 'processes';
      interval?: number;
      duration?: number;
    }) => {
      try {
        const { action, target = 'all', interval = 5, duration = 30 } = params;

        let output = `# Memory Management - ${action.toUpperCase()}\n\n`;

        switch (action) {
          case 'info':
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);

            output += `## Memory Information\n`;
            output += `- **Total Memory**: ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
            output += `- **Used Memory**: ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
            output += `- **Free Memory**: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
            output += `- **Usage**: ${memoryUsagePercent}%\n\n`;

            // Platform-specific memory info
            if (os.platform() === 'linux') {
              try {
                const { stdout: meminfo } = await execPromise('cat /proc/meminfo | head -10');
                output += `## Linux Memory Info\n\`\`\`\n${meminfo}\n\`\`\`\n\n`;
              } catch (error) {
                // Ignore Linux-specific errors
              }
            }
            break;

          case 'clear_cache':
            if (os.platform() !== 'linux') {
              return {
                content: [{ type: 'text', text: 'Cache clearing is only supported on Linux systems.' }],
                isError: true,
              };
            }

            let clearCommand = '';
            switch (target) {
              case 'page_cache':
                clearCommand = 'echo 1 > /proc/sys/vm/drop_caches';
                break;
              case 'swap':
                clearCommand = 'swapoff -a && swapon -a';
                break;
              case 'slab':
                clearCommand = 'echo 2 > /proc/sys/vm/drop_caches';
                break;
              case 'all':
                clearCommand = 'echo 3 > /proc/sys/vm/drop_caches';
                break;
              default:
                return {
                  content: [{ type: 'text', text: `Invalid target: ${target}` }],
                  isError: true,
                };
            }

            try {
              await execPromise(`sudo ${clearCommand}`);
              output += `## Cache Cleared\nSuccessfully cleared ${target} cache.\n\n`;

              // Show new memory info
              const newTotalMemory = os.totalmem();
              const newFreeMemory = os.freemem();
              const newUsedMemory = newTotalMemory - newFreeMemory;
              const newMemoryUsagePercent = ((newUsedMemory / newTotalMemory) * 100).toFixed(1);

              output += `## Updated Memory Information\n`;
              output += `- **Free Memory**: ${(newFreeMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
              output += `- **Usage**: ${newMemoryUsagePercent}%\n`;
            } catch (error: any) {
              output += `## Cache Clearing Failed\n${error.message}\n`;
            }
            break;

          case 'free_memory':
            if (os.platform() !== 'linux') {
              return {
                content: [{ type: 'text', text: 'Memory freeing is only supported on Linux systems.' }],
                isError: true,
              };
            }

            try {
              // Force garbage collection and free memory
              const { stdout: syncOutput } = await execPromise('sync');
              const { stdout: dropCachesOutput } = await execPromise('echo 3 | sudo tee /proc/sys/vm/drop_caches');

              output += `## Memory Freed\n`;
              output += `- **Sync**: ${syncOutput || 'Completed'}\n`;
              output += `- **Cache Drop**: ${dropCachesOutput || 'Completed'}\n\n`;

              // Show updated memory info
              const freedTotalMemory = os.totalmem();
              const freedFreeMemory = os.freemem();
              output += `## Updated Memory Information\n`;
              output += `- **Available Memory**: ${(freedFreeMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
            } catch (error: any) {
              output += `## Memory Free Failed\n${error.message}\n`;
            }
            break;

          case 'monitor':
            output += `## Memory Monitor (${duration}s interval)\n`;
            output += `Starting memory monitoring for ${duration} seconds...\n\n`;

            // This is a simplified monitoring - in a real implementation,
            // you would want to implement continuous monitoring
            const startTime = Date.now();
            const endTime = startTime + (duration * 1000);

            let monitoringData = '';
            while (Date.now() < endTime) {
              const currentMemory = os.freemem();
              const currentTime = new Date().toLocaleTimeString();
              monitoringData += `${currentTime}: ${(currentMemory / 1024 / 1024 / 1024).toFixed(2)} GB free\n`;

              // Wait for interval
              await new Promise(resolve => setTimeout(resolve, interval * 1000));
            }

            output += `## Monitoring Results\n\`\`\`\n${monitoringData}\n\`\`\`\n`;
            break;

          case 'optimize':
            output += `## Memory Optimization\n`;

            if (os.platform() === 'linux') {
              try {
                // Linux-specific optimizations
                const { stdout: oomScore } = await execPromise('cat /proc/$(pgrep -f "node\|bun" | head -1)/oom_score_adj 2>/dev/null || echo "0"');
                const { stdout: swappiness } = await execPromise('cat /proc/sys/vm/swappiness');

                output += `### Linux Optimizations\n`;
                output += `- **OOM Score**: ${oomScore.trim()}\n`;
                output += `- **Swappiness**: ${swappiness.trim()}\n\n`;

                // Suggest optimizations
                output += `### Recommendations\n`;
                if (parseInt(swappiness.trim()) > 10) {
                  output += `- Consider reducing swappiness: \`echo 10 | sudo tee /proc/sys/vm/swappiness\`\n`;
                }
                output += `- Consider increasing oom_score_adj for critical processes\n`;
              } catch (error) {
                output += `Could not retrieve Linux optimization info.\n`;
              }
            } else {
              output += `Memory optimization recommendations:\n`;
              output += `- Close unused applications\n`;
              output += `- Restart memory-intensive processes\n`;
              output += `- Consider adding more RAM if consistently high usage\n`;
            }
            break;
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error in memory management: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
