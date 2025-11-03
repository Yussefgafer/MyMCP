import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function registerNetworkMonitorTool(server: McpServer) {
  server.registerTool(
    'network-monitor',
    {
      title: 'Network Monitor',
      description: 'Monitors network interfaces, connections, and traffic statistics.',
      inputSchema: {
        interface_name: z.string().optional().describe('Specific network interface to monitor (optional)'),
        include_connections: z.boolean().optional().default(false).describe('Include active connections'),
        include_routing: z.boolean().optional().default(false).describe('Include routing table'),
        include_dns: z.boolean().optional().default(false).describe('Include DNS configuration'),
      },
    },
    async (params: {
      interface_name?: string;
      include_connections?: boolean;
      include_routing?: boolean;
      include_dns?: boolean;
    }) => {
      try {
        const {
          interface_name,
          include_connections = false,
          include_routing = false,
          include_dns = false
        } = params;

        let output = `# Network Monitor Report

## Network Interfaces
`;

        // Get network interfaces
        const networkInterfaces = os.networkInterfaces();

        for (const [name, interfaces] of Object.entries(networkInterfaces)) {
          if (interfaces && (!interface_name || name === interface_name)) {
            output += `### ${name}\n`;
            for (const networkInterface of interfaces) {
              if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                output += `- **IPv4**: ${networkInterface.address} (netmask: ${networkInterface.netmask})\n`;
              } else if (networkInterface.family === 'IPv6' && !networkInterface.internal) {
                output += `- **IPv6**: ${networkInterface.address}\n`;
              }
            }
            output += `- **MAC**: ${interfaces[0]?.mac || 'N/A'}\n`;
            output += `- **MTU**: N/A (Not available in Node.js API)\n\n`;
          }
        }

        // Platform-specific network monitoring
        if (os.platform() === 'linux') {
          try {
            // Get wireless information if available
            const { stdout: iwconfigOutput } = await execPromise('iwconfig 2>/dev/null || echo "No wireless interfaces"');
            if (iwconfigOutput && !iwconfigOutput.includes('No wireless interfaces')) {
              output += `## Wireless Information\n\`\`\`\n${iwconfigOutput}\n\`\`\`\n\n`;
            }

            // Get routing table if requested
            if (include_routing) {
              const { stdout: routeOutput } = await execPromise('route -n');
              output += `## Routing Table\n\`\`\`\n${routeOutput}\n\`\`\`\n\n`;
            }

            // Get DNS configuration if requested
            if (include_dns) {
              const { stdout: resolvOutput } = await execPromise('cat /etc/resolv.conf 2>/dev/null || echo "Could not read DNS config"');
              output += `## DNS Configuration\n\`\`\`\n${resolvOutput}\n\`\`\`\n\n`;
            }
          } catch (error) {
            // Ignore Linux-specific command errors
          }
        }

        if (os.platform() === 'darwin') {
          try {
            // macOS specific network monitoring
            if (include_routing) {
              const { stdout: routeOutput } = await execPromise('netstat -rn');
              output += `## Routing Table\n\`\`\`\n${routeOutput}\n\`\`\`\n\n`;
            }

            if (include_dns) {
              const { stdout: dnsOutput } = await execPromise('scutil --dns | head -20');
              output += `## DNS Configuration\n\`\`\`\n${dnsOutput}\n\`\`\`\n\n`;
            }
          } catch (error) {
            // Ignore macOS-specific command errors
          }
        }

        if (os.platform() === 'win32') {
          try {
            // Windows specific network monitoring
            if (include_routing) {
              const { stdout: routeOutput } = await execPromise('route print');
              output += `## Routing Table\n\`\`\`\n${routeOutput}\n\`\`\`\n\n`;
            }

            if (include_dns) {
              const { stdout: dnsOutput } = await execPromise('ipconfig /displaydns | findstr "Record Name\|A (Host)" | head -10');
              output += `## DNS Cache\n\`\`\`\n${dnsOutput}\n\`\`\`\n\n`;
            }
          } catch (error) {
            // Ignore Windows-specific command errors
          }
        }

        // Get active connections if requested
        if (include_connections) {
          try {
            let connectionsCommand = '';
            if (os.platform() === 'win32') {
              connectionsCommand = 'netstat -an | findstr "LISTENING\|ESTABLISHED" | head -20';
            } else {
              connectionsCommand = 'ss -tuln | head -20';
            }

            const { stdout: connectionsOutput } = await execPromise(connectionsCommand);
            output += `## Active Connections\n\`\`\`\n${connectionsOutput}\n\`\`\`\n\n`;
          } catch (error) {
            output += `## Active Connections (Unavailable)\nCould not retrieve connection information.\n\n`;
          }
        }

        // Add network statistics
        output += `## Network Statistics\n`;
        output += `- **Hostname**: ${os.hostname()}\n`;
        output += `- **Platform**: ${os.platform()}\n`;
        output += `- **Architecture**: ${os.arch()}\n`;

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error monitoring network: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
