import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import * as path from 'path';

const execPromise = promisify(exec);

/**
 * Tool: Install Dependencies
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'install-dependencies',
    {
      title: 'Install Dependencies',
      description:
        "Installs project dependencies using the appropriate package manager (npm, pip, composer) with advanced options.",
      inputSchema: {
        project_path: z.string().describe("The path to the project directory."),
        manager: z.enum(['auto', 'npm', 'pip', 'composer']).optional().default('auto').describe("The package manager to use."),
        proxy: z.string().optional().describe("Proxy server to use for the installation."),
        force_reinstall: z.boolean().optional().default(false).describe("Force reinstallation of packages."),
        no_dev_dependencies: z.boolean().optional().default(false).describe("Skip installation of development dependencies."),
        lock_file_path: z.string().optional().describe("Path to a specific lock file or requirements file."),
      }
    },
    async ({
      project_path,
      manager,
      proxy,
      force_reinstall,
      no_dev_dependencies,
      lock_file_path,
    }) => {
      try {
        let detectedManager = manager;

        if (manager === 'auto') {
          if (await fs.pathExists(path.join(project_path, 'package-lock.json'))) detectedManager = 'npm';
          else if (await fs.pathExists(path.join(project_path, 'requirements.txt'))) detectedManager = 'pip';
          else if (await fs.pathExists(path.join(project_path, 'composer.json'))) detectedManager = 'composer';
          else {
            return { content: [{ type: 'text', text: 'Could not automatically detect a package manager in the specified project path.' }], isError: true };
          }
        }

        let command = '';
        switch (detectedManager) {
          case 'npm':
            command = `npm install ${force_reinstall ? '--force' : ''} ${no_dev_dependencies ? '--production' : ''}`;
            break;
          case 'pip':
            const requirementsFile = lock_file_path || 'requirements.txt';
            command = `pip install ${force_reinstall ? '--force-reinstall' : ''} -r ${requirementsFile}`;
            break;
          case 'composer':
            command = `composer install ${no_dev_dependencies ? '--no-dev' : ''}`;
            break;
        }

        const options: ExecOptions = {
            cwd: project_path,
            env: {
                ...process.env,
                ...(proxy ? { https_proxy: proxy, http_proxy: proxy } : {})
            }
        };

        const { stdout, stderr } = await execPromise(command, options);

        let resultMessage = `Dependencies installed successfully using ${detectedManager}.\n`;
        if (stdout) resultMessage += `STDOUT:\n${stdout}\n`;
        if (stderr) resultMessage += `STDERR (warnings):\n${stderr}\n`;

        return { content: [{ type: 'text', text: resultMessage }] };
      } catch (error: any) {
        let errorMessage = `Error installing dependencies: ${error.message}\n`;
        if (error.stdout) errorMessage += `STDOUT:\n${error.stdout}\n`;
        if (error.stderr) errorMessage += `STDERR:\n${error.stderr}\n`;
        return { content: [{ type: 'text', text: errorMessage }], isError: true };
      }
    }
  );
};

export default registerTool;
