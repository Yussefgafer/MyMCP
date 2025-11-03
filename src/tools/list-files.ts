
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { withTimeout, normalizeTimeout } from '../utils/timeout';

interface FileDetails {
  path: string;
  type: 'file' | 'directory';
  size: number; // in bytes
  modified_date: Date; // Use Date object for easier comparison
}

// Helper function for recursive listing and filtering
async function listFilesRecursive(dir: string, params: { 
  includeHidden?: boolean; 
  pattern?: string; 
  recursive?: boolean; 
  max_depth?: number; 
  min_size_kb?: number; 
  max_size_kb?: number; 
  modified_since_days?: number; 
  include_folders?: boolean; 
}, currentDepth = 0): Promise<FileDetails[]> {
  let results: FileDetails[] = [];
  let items: fs.Dirent[] = [];

  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    // Ignore errors for directories we can't access (e.g., permissions)
    console.warn(`Could not read directory ${dir}: ${err}`);
    return [];
  }

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    // Apply common filters first
    if (!params.includeHidden && item.name.startsWith('.')) continue;
    if (params.pattern && !new RegExp(params.pattern).test(item.name)) continue;
    
    try {
      const stats = await fs.stat(itemPath);
      const modifiedDate = stats.mtime;

      // Apply modified_since_days filter
      if (params.modified_since_days !== undefined) {
        const cutoffDate = new Date(Date.now() - params.modified_since_days * 86400000);
        if (modifiedDate < cutoffDate) continue;
      }

      if (item.isDirectory()) {
        if (params.include_folders) {
          results.push({
            path: itemPath,
            type: 'directory',
            size: stats.size,
            modified_date: modifiedDate,
          });
        }
        // Recurse if allowed by recursive flag and max_depth
        if (params.recursive && (params.max_depth === undefined || currentDepth < params.max_depth)) {
          results = results.concat(await listFilesRecursive(itemPath, params, currentDepth + 1));
        }
      } else if (item.isFile()) {
        // Apply size filters for files
        if (params.min_size_kb !== undefined && stats.size < params.min_size_kb * 1024) continue;
        if (params.max_size_kb !== undefined && stats.size > params.max_size_kb * 1024) continue;
        
        results.push({
          path: itemPath,
          type: 'file',
          size: stats.size,
          modified_date: modifiedDate,
        });
      }
    } catch (err) {
      // Ignore errors for files/directories we can't access (e.g., permissions)
      console.warn(`Could not stat item ${itemPath}: ${err}`);
    }
  }
  return results;
}

export default function registerListFilesTool(server: McpServer) {
  server.registerTool(
    'list-files',
    {
      description: 'Lists files and/or directories with advanced filtering and output options.',
      inputSchema: {
        folderPath: z.string().optional().describe("The directory to list. Defaults to the user's desktop."),
        includeHidden: z.boolean().optional().default(false).describe("Include hidden files and folders."),
        include_folders: z.boolean().optional().default(false).describe("Include folders in the output."),
        recursive: z.boolean().optional().default(false).describe("List files in subdirectories recursively."),
        pattern: z.string().optional().describe("A regex pattern to filter files by name."),
        max_depth: z.number().int().min(0).optional().describe("Maximum recursion depth."),
        min_size_kb: z.number().int().min(0).optional().describe("Minimum file size in kilobytes."),
        max_size_kb: z.number().int().min(0).optional().describe("Maximum file size in kilobytes."),
        modified_since_days: z.number().int().min(0).optional().describe("Filter files modified within the last N days."),
        sort_by: z.enum(['path', 'size', 'modified_date']).optional().describe("Sort results by this field."),
        sort_order: z.enum(['asc', 'desc']).optional().default('asc').describe("Sort order: 'asc' or 'desc'."),
        output_format: z.enum(['list_of_paths', 'json', 'detailed_list']).optional().default('list_of_paths').describe("Output format."),
        timeout: z.number().optional().describe("Timeout in seconds for the operation (default: 120 seconds, max: 600 seconds)"),
      }
    },
    async (params: { 
      folderPath?: string; 
      includeHidden?: boolean; 
      include_folders?: boolean; 
      recursive?: boolean; 
      pattern?: string; 
      max_depth?: number; 
      min_size_kb?: number; 
      max_size_kb?: number; 
      modified_since_days?: number; 
      sort_by?: 'path' | 'size' | 'modified_date'; 
      sort_order?: 'asc' | 'desc'; 
      output_format?: 'list_of_paths' | 'json' | 'detailed_list'; 
      timeout?: number;
    }) => {
      try {
        // Normalize and apply timeout
        const timeoutMs = normalizeTimeout(params.timeout);

        const targetPath = params.folderPath || path.join(os.homedir(), 'Desktop');

        if (!(await fs.pathExists(targetPath))) {
          return { content: [{ type: 'text', text: `Error: Path does not exist: ${targetPath}` }], isError: true };
        }

        // Wrap the entire operation with timeout
        const operation = async () => {
          let files = await listFilesRecursive(targetPath, params);

          // Sorting logic
          if (params.sort_by) {
            // FIX: Assign params.sort_by to a new const to help TypeScript's type inference inside the closure.
            const sortBy = params.sort_by;
            files.sort((a, b) => {
              // Use the new 'sortBy' const which is guaranteed to not be undefined here.
              const fieldA = sortBy === 'modified_date' ? a[sortBy].getTime() : a[sortBy];
              const fieldB = sortBy === 'modified_date' ? b[sortBy].getTime() : b[sortBy];

              let comparison = 0;
              if (fieldA > fieldB) {
                comparison = 1;
              } else if (fieldA < fieldB) {
                comparison = -1;
              }
              return params.sort_order === 'desc' ? comparison * -1 : comparison; // Apply sort order
            });
          }

          return files;
        };

        // Execute with timeout
        const files = await withTimeout(operation(), timeoutMs, `File listing operation timed out after ${timeoutMs}ms`);

        // Output formatting
        if (params.output_format === 'json') {
          // Convert Date objects to ISO strings for JSON output
          const jsonOutput = files.map(f => ({ ...f, modified_date: f.modified_date.toISOString() }));
          return { content: [{ type: 'text', text: JSON.stringify(jsonOutput, null, 2) }] };
        } else if (params.output_format === 'detailed_list') {
          const detailedList = files.map(f => 
            `${f.type === 'directory' ? 'D' : 'F'} | ` +
            `${(f.size / 1024).toFixed(2).padStart(8)} KB | ` +
            `${f.modified_date.toISOString().substring(0, 10)} | ` + // Format date for display
            `${f.path}`
          ).join('\\n');
          return { content: [{ type: 'text', text: `Type | Size (KB) | Modified   | Path\\n${'-'.repeat(60)}\\n${detailedList}` }] };
        } else { // list_of_paths
          const filePaths = files.map(file => file.path);
          return { content: [{ type: 'text', text: `Found items:\\n${filePaths.join('\\n')}` }] };
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `An unexpected error occurred: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
}
