import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

// Helper function for executing commands safely
async function executeSystemCommand(command: string) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      // Some commands like shutdown might output to stderr on success, so we check stdout first.
      if (stdout) {
        return { success: true, output: `Command executed. Stdout: ${stdout}. Stderr: ${stderr}` };
      }
      return { success: false, output: stderr };
    }
    return { success: true, output: stdout || 'Command executed successfully.' };
  } catch (error: any) {
    return { success: false, output: `Execution failed: ${error.message}` };
  }
}

export default function systemControl(server: McpServer) {
  server.registerTool(
    'system-control',
    {
      title: 'System Control',
      description: 'Performs various system-level actions like shutdown, restart, notifications, and app management. Use with extreme caution.',
      inputSchema: {
        action: z.enum([
          'notify', 
          'shutdown', 
          'restart', 
          'open_app', 
          'close_app',
          'close_app_by_pid',
          'list_open_apps'
        ]).describe('The system action to perform.'),
        payload: z.string().optional().describe('Payload for the action. Notify: "title|message|sound". App management: "app_name" or "pid".'),
      },
    },
    async (params: { action: string; payload?: string }) => {
      const platform = os.platform();
      let command: string;
      let result: { success: boolean; output: string };

      switch (params.action) {
        // --- SHUTDOWN / RESTART ---
        case 'shutdown':
          command = platform === 'win32' ? 'shutdown /s /t 0' : 'shutdown -h now';
          result = await executeSystemCommand(command);
          break;
        case 'restart':
          command = platform === 'win32' ? 'shutdown /r /t 0' : 'shutdown -r now';
          result = await executeSystemCommand(command);
          break;

        // --- NOTIFICATION ---
        case 'notify':
          const [title, message, sound] = params.payload?.split('|') || ['Notification', ''];
          const safeTitle = quote([title]);
          const safeMessage = quote([message]);
          if (platform === 'darwin') {
            const soundName = sound ? `sound name ${quote([sound])}` : '';
            command = `osascript -e 'display notification ${safeMessage} with title ${safeTitle} ${soundName}'`;
          } else if (platform === 'linux') {
            // The 'sound' here could be an icon name for Linux
            const icon = sound ? `-i ${quote([sound])}` : '';
            command = `notify-send ${safeTitle} ${safeMessage} ${icon}`;
          } else if (platform === 'win32') {
            // Windows notifications from command line are very limited without external libraries.
            command = `msg * ${quote([`${title}: ${message}`])}`;
          } else {
            result = { success: false, output: 'Notifications not supported on this platform.' };
            break;
          }
          result = await executeSystemCommand(command);
          break;

        // --- APP MANAGEMENT ---
        case 'open_app':
        case 'close_app':
          if (!params.payload) {
            result = { success: false, output: 'App name payload is required for this action.' };
            break;
          }
          const appName = quote([params.payload]);
          if (platform === 'win32') {
            command = params.action === 'open_app' ? `start "" ${appName}` : `taskkill /IM ${appName} /F`;
          } else if (platform === 'darwin') {
            command = params.action === 'open_app' ? `open -a ${appName}` : `killall ${appName}`;
          } else if (platform === 'linux') {
            command = params.action === 'open_app' ? `${params.payload}` : `killall ${appName}`; // Linux open is direct, close needs quoting
          } else {
             result = { success: false, output: 'App management not supported on this platform.' };
             break;
          }
          result = await executeSystemCommand(command);
          break;
        
        case 'close_app_by_pid':
          if (!params.payload || !/^\d+$/.test(params.payload)) {
            result = { success: false, output: 'A valid numeric PID payload is required.' };
            break;
          }
          const pid = parseInt(params.payload, 10);
          if (platform === 'win32') {
            command = `taskkill /PID ${pid} /F`;
          } else {
            command = `kill ${pid}`;
          }
          result = await executeSystemCommand(command);
          break;

        // --- LIST OPEN GUI APPS ---
        case 'list_open_apps':
           if (platform === 'darwin') {
             command = `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`;
           } else if (platform === 'win32') {
             command = `powershell -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize"`;
           } else {
             result = { success: false, output: 'Listing GUI apps is not reliably supported on Linux.' };
             break;
           }
           result = await executeSystemCommand(command);
           break;

        default:
          result = { success: false, output: `Unknown action: ${params.action}` };
      }

      return {
        content: [{ type: 'text', text: result.output }],
        isError: !result.success,
      };
    }
  );
}
