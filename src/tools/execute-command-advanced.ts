import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Tool: Advanced Execute Command
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'execute-command-advanced',
    {
      title: 'Advanced Execute Command',
      description:
        "Executes a shell command with advanced options for stdin, timeout, working directory, environment variables, and output handling.",
      inputSchema: {
        command: z.string().describe("The shell command to execute."),
        stdin_data: z.string().optional().describe("Data to be passed to the command's standard input."),
        timeout: z.number().int().min(0).optional().describe("Optional timeout in milliseconds."),
        waitForCompletion: z.boolean().optional().default(true).describe("If true, waits for the command to complete. If false, runs it in the background and returns the PID."),
        working_directory: z.string().optional().describe("Sets the current working directory for the command's execution."),
        env_vars: z.string().optional().describe("A space-separated string of key=value pairs for environment variables (e.g., 'VAR1=value1 VAR2=value2')."),
        capture_output: z.boolean().optional().default(true).describe("If false, the command's output will not be captured."),
      }
    },
    async ({
      command,
      stdin_data,
      timeout,
      waitForCompletion,
      working_directory,
      env_vars,
      capture_output,
    }) => {
      const processedEnv: NodeJS.ProcessEnv = { ...process.env };
      if (env_vars) {
        env_vars.split(' ').forEach(pair => {
          const [key, ...valueParts] = pair.split('=');
          if (key) {
            processedEnv[key] = valueParts.join('=');
          }
        });
      }

      const spawnOptions: SpawnOptions = {
        cwd: working_directory,
        env: processedEnv,
        shell: true,
        detached: !waitForCompletion,
        stdio: waitForCompletion ? ['pipe', 'pipe', 'pipe'] : 'ignore',
      };

      if (!waitForCompletion) {
        const child = spawn(command, spawnOptions);
        child.unref();
        return {
          content: [{ type: 'text', text: `Command "${command}" started in background with PID: ${child.pid}` }]
        };
      }

      return new Promise((resolve) => {
        const child = spawn(command, { ...spawnOptions, timeout });
        
        let stdout = '';
        let stderr = '';

        if (capture_output) {
          child.stdout?.on('data', (data) => (stdout += data.toString()));
          child.stderr?.on('data', (data) => (stderr += data.toString()));
        }

        if (stdin_data) {
          child.stdin?.write(stdin_data);
          child.stdin?.end();
        }

        child.on('close', (code) => {
          if (code === 0) {
            let output = '';
            if (capture_output) {
              if (stdout) output += `STDOUT:\n${stdout}\n`;
              if (stderr) output += `STDERR:\n${stderr}\n`;
            }
            resolve({
              content: [{ type: 'text', text: output || 'Command executed successfully with no output.' }]
            });
          } else {
            let errorMessage = `Command failed with exit code ${code}\n`;
            if (capture_output) {
              if (stdout) errorMessage += `STDOUT:\n${stdout}\n`;
              if (stderr) errorMessage += `STDERR:\n${stderr}\n`;
            }
            resolve({
              content: [{ type: 'text', text: errorMessage }],
              isError: true
            });
          }
        });

        child.on('error', (err) => {
          resolve({
            content: [{ type: 'text', text: `Failed to start command: ${err.message}` }],
            isError: true
          });
        });
      });
    }
  );
};

export default registerTool;
