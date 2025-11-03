import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Tool: Set Environment Variable
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'set-environment-variable',
    {
      title: 'Set Environment Variable',
      description:
        "Sets or deletes an environment variable for the current session. System-wide scope is not supported.",
      inputSchema: {
        key: z.string().describe("The key of the environment variable."),
        value: z.string().optional().describe("The string value to set."),
        scope: z.enum(['session', 'system']).optional().default('session').describe("The scope of the variable. Only 'session' is currently supported."),
        delete: z.boolean().optional().default(false).describe("If true, deletes the environment variable."),
      }
    },
    async ({
      key,
      value,
      scope,
      delete: delete_var,
    }) => {
      if (scope === 'system') {
        return { 
          content: [{ type: 'text', text: 'Error: Setting system-wide environment variables is not supported.' }], 
          isError: true 
        };
      }

      try {
        if (delete_var) {
          if (key in process.env) {
            delete process.env[key];
            return { content: [{ type: 'text', text: `Successfully deleted environment variable "${key}" for the current session.` }] };
          } else {
            return { content: [{ type: 'text', text: `Info: Environment variable "${key}" was not set.` }] };
          }
        } 
        
        if (value === undefined) {
          return { 
            content: [{ type: 'text', text: 'Error: A value must be provided to set an environment variable. To delete a variable, set the `delete` flag to true.' }], 
            isError: true 
          };
        }

        process.env[key] = value;
        return { 
          content: [{ type: 'text', text: `Successfully set environment variable "${key}" to "${value}" for the current session.` }] 
        };

      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error setting environment variable: ${error.message}` }],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
