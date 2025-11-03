import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * Tool: Write to a file
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'write-file',
    {
      title: 'Write to File',
      description:
        "Writes content to a specified file, with options for encoding, mode, and atomic operations. Accepts string or Buffer for content.",
      inputSchema: {
        filePath: z.string().describe("The path of the file to write to."),
        content: z.union([z.string(), z.instanceof(Buffer)]).describe("The content to write, can be a string or a Buffer for binary data."),
        encoding: z.string().optional().default('utf-8').describe("Specifies the file's character encoding. Only used for text modes ('w', 'a')."),
        mode: z.enum(['w', 'a', 'wb', 'ab']).optional().default('w').describe("File opening mode: 'w' (write, overwrites), 'a' (append to end), 'wb' (write bytes), 'ab' (append bytes)."),
        atomic: z.boolean().optional().default(false).describe("If true, performs an atomic write by using a temporary file. This ensures data integrity."),
      }
    },
    async ({
      filePath,
      content,
      encoding,
      mode,
      atomic
    }) => {
      try {
        const dir = path.dirname(filePath);
        await fs.ensureDir(dir);

        const isBinaryMode = mode.endsWith('b');
        if (isBinaryMode && typeof content === 'string') {
            return { content: [{ type: 'text', text: "Error: In binary mode ('wb' or 'ab'), content must be a Buffer." }], isError: true };
        }
        if (!isBinaryMode && content instanceof Buffer) {
            return { content: [{ type: 'text', text: "Error: To write a Buffer, use a binary mode ('wb' or 'ab')." }], isError: true };
        }

        const options = { encoding: isBinaryMode ? undefined : (encoding as BufferEncoding), flag: mode };

        if (atomic) {
          const tempFile = filePath + `.${Date.now()}.tmp`;
          await fs.writeFile(tempFile, content, options);
          await fs.rename(tempFile, filePath);
        } else {
          await fs.writeFile(filePath, content, options);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote ${content instanceof Buffer ? `${content.length} bytes` : 'content'} to ${filePath}`
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `An unexpected error occurred while writing to file: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
