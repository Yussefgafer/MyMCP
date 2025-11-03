import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { withTimeout, normalizeTimeout } from '../utils/timeout';

/**
 * Tool: Read File
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerReadFileTool = (server: McpServer) => {
  server.registerTool(
    'read-file',
    {
      title: 'Read File',
      description:
        "Reads content from one or more files with advanced options. Can read in binary mode, or as text with line slicing, encoding, and byte limits. Options are applied to each file. Returns a JSON object mapping file paths to their content.",
      inputSchema: {
        filePaths: z.string().describe("A space-separated string of file paths to read."),
        startLine: z.number().int().min(1).optional().describe("The starting line number (1-indexed, inclusive). Applied to each file in text mode."),
        endLine: z.number().int().min(1).optional().describe("The ending line number (inclusive). Applied to each file in text mode."),
        encoding: z.string().optional().default('utf-8').describe("Specifies the file's character encoding (e.g., 'utf-8', 'latin-1'). Only used if `binary_mode` is false."),
        binary_mode: z.boolean().optional().default(false).describe("If true, reads the file as raw bytes instead of text."),
        max_bytes: z.number().int().min(1).optional().describe("Specifies the maximum number of bytes to read. Useful for large files."),
        timeout: z.number().optional().describe("Timeout in seconds for the operation (default: 120 seconds, max: 600 seconds)"),
      }
    },
    async ({
      filePaths,
      startLine,
      endLine,
      encoding,
      binary_mode,
      max_bytes,
      timeout
    }) => {
      try {
        // Normalize and apply timeout
        const timeoutMs = normalizeTimeout(timeout);

        const paths = filePaths.split(' ').filter(p => p);
        const results: { [key: string]: string } = {};

        // Wrap the entire operation with timeout
        const operation = async () => {
          for (const filePath of paths) {
            if (!(await fs.pathExists(filePath))) {
              results[filePath] = `Error: File not found at path: ${filePath}`;
              continue;
            }

            try {
              if (binary_mode) {
                const stats = await fs.stat(filePath);
                const bytes_to_read = max_bytes ? Math.min(max_bytes, stats.size) : stats.size;
                const buffer = Buffer.alloc(bytes_to_read);
                const fd = await fs.open(filePath, 'r');
                await fs.read(fd, buffer, 0, bytes_to_read, 0);
                await fs.close(fd);
                results[filePath] = `Read ${buffer.length} bytes (hex): ${buffer.toString('hex')}`;
                continue;
              }

              let fileContent: string;
              if (max_bytes) {
                const buffer = Buffer.alloc(max_bytes);
                const fd = await fs.open(filePath, 'r');
                const { bytesRead } = await fs.read(fd, buffer, 0, max_bytes, 0);
                await fs.close(fd);
                fileContent = buffer.toString(encoding as BufferEncoding, 0, bytesRead);
              } else {
                fileContent = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
              }

              let lines = fileContent.split(/\r?\n/);
              if (startLine || endLine) {
                const effectiveStartLine = startLine ? startLine - 1 : 0;
                const effectiveEndLine = endLine ? endLine : lines.length;
                if (effectiveStartLine >= lines.length) {
                  results[filePath] = `Error: startLine ${startLine} is out of bounds. File only has ${lines.length} lines.`;
                  continue;
                }
                lines = lines.slice(effectiveStartLine, effectiveEndLine);
              }
              results[filePath] = lines.join('\n');
            } catch (fileError: any) {
              results[filePath] = `Error reading file: ${fileError.message}`;
            }
          }

          return results;
        };

        // Execute with timeout
        const operationResults = await withTimeout(operation(), timeoutMs, `File reading operation timed out after ${timeoutMs}ms`);

        return {
          content: [{ type: 'text', text: JSON.stringify(operationResults, null, 2) }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `An unexpected error occurred: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
};

export default registerReadFileTool;
