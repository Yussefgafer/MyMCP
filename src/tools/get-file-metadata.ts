import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';

export default function getFileMetadata(server: McpServer) {
  server.registerTool(
    'get-file-metadata',
    {
      title: 'Get File Metadata',
      description: 'Retrieves metadata for a specified file or directory.',
      inputSchema: {
        path: z.string().describe('The path to the file or directory.'),
      },
    },
    async (params: { path: string }) => {
      try {
        if (!(await fs.pathExists(params.path))) {
          return { content: [{ type: 'text', text: `Error: Path does not exist: ${params.path}` }], isError: true };
        }

        const stats = await fs.stat(params.path);
        const permissions = (stats.mode & 0o777).toString(8);

        const metadata = {
          path: params.path,
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          isSymbolicLink: stats.isSymbolicLink(),
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          accessedAt: stats.atime.toISOString(),
          permissions: permissions,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Failed to get metadata for ${params.path}: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
