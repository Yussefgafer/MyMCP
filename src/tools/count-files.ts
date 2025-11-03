
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

interface FileDetails {
  path: string;
  type: 'file' | 'directory';
  size: number; // in bytes
  modified_date: Date; // Use Date object for easier comparison
}

// Helper function for recursive listing and filtering (reused from list-files.ts for consistency)
async function listFilesRecursiveForCount(dir: string, params: { 
  includeHidden?: boolean; 
  pattern?: string; 
  recursive?: boolean; 
  max_depth?: number; 
  min_size_kb?: number; 
  max_size_kb?: number; 
  modified_since_days?: number; 
  count_files?: boolean; // Specific to count-files, passed as include_files
  count_folders?: boolean; // Specific to count-files, passed as include_folders
}, currentDepth = 0): Promise<FileDetails[]> {
  let results: FileDetails[] = [];
  let items: fs.Dirent[] = [];

  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`Could not read directory ${dir}: ${err}`);
    return [];
  }

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    if (!params.includeHidden && item.name.startsWith('.')) continue;
    if (params.pattern && !new RegExp(params.pattern).test(item.name)) continue;
    
    try {
      const stats = await fs.stat(itemPath);
      const modifiedDate = stats.mtime;

      if (params.modified_since_days !== undefined) {
        const cutoffDate = new Date(Date.now() - params.modified_since_days * 86400000);
        if (modifiedDate < cutoffDate) continue;
      }

      if (item.isDirectory()) {
        if (params.count_folders) { // Use count_folders directly
          results.push({
            path: itemPath,
            type: 'directory',
            size: stats.size,
            modified_date: modifiedDate,
          });
        }
        if (params.recursive && (params.max_depth === undefined || currentDepth < params.max_depth)) {
          results = results.concat(await listFilesRecursiveForCount(itemPath, params, currentDepth + 1));
        }
      } else if (item.isFile()) {
        if (params.min_size_kb !== undefined && stats.size < params.min_size_kb * 1024) continue;
        if (params.max_size_kb !== undefined && stats.size > params.max_size_kb * 1024) continue;
        
        if (params.count_files) { // Use count_files directly
          results.push({
            path: itemPath,
            type: 'file',
            size: stats.size,
            modified_date: modifiedDate,
          });
        }
      }
    } catch (err) {
      console.warn(`Could not stat item ${itemPath}: ${err}`);
    }
  }
  return results;
}

export default function registerCountFilesTool(server: McpServer) {
  server.registerTool(
    'count-files',
    {
      description: 'Counts files and/or directories in a path with advanced filtering options.',
      inputSchema: {
        folderPath: z.string().optional().describe("The directory to analyze. Defaults to the user's desktop."),
        count_files: z.boolean().optional().default(true).describe("Whether to include files in the count."),
        count_folders: z.boolean().optional().default(false).describe("Whether to include folders in the count."),
        recursive: z.boolean().optional().default(false).describe("Count items in subdirectories recursively."),
        pattern: z.string().optional().describe("A regex pattern to filter items by name."),
        max_depth: z.number().int().min(0).optional().describe("Maximum recursion depth."),
        min_size_kb: z.number().int().min(0).optional().describe("Minimum file size in kilobytes."),
        max_size_kb: z.number().int().min(0).optional().describe("Maximum file size in kilobytes."),
        modified_since_days: z.number().int().min(0).optional().describe("Filter items modified within the last N days."),
      }
    },
    async (params: { 
      folderPath?: string; 
      count_files?: boolean; 
      count_folders?: boolean; 
      recursive?: boolean; 
      pattern?: string; 
      max_depth?: number; 
      min_size_kb?: number; 
      max_size_kb?: number; 
      modified_since_days?: number; 
    }) => {
      try {
        const targetPath = params.folderPath || path.join(os.homedir(), 'Desktop');

        if (!(await fs.pathExists(targetPath))) {
          return { content: [{ type: 'text', text: `Error: Path does not exist: ${targetPath}` }], isError: true };
        }
        
        if (!params.count_files && !params.count_folders) {
            return { content: [{ type: 'text', text: "Error: You must choose to count files, folders, or both." }], isError: true };
        }

        // Pass all relevant params to the recursive function
        const items = await listFilesRecursiveForCount(targetPath, params);
        
        const fileCount = items.filter(i => i.type === 'file').length;
        const folderCount = items.filter(i => i.type === 'directory').length;

        let resultText = `Analysis of '${targetPath}':\\n`;
        if (params.count_files) resultText += `- Files found: ${fileCount}\\n`;
        if (params.count_folders) resultText += `- Folders found: ${folderCount}\\n`;

        return {
          content: [{ type: 'text', text: resultText.trim() }]
        };
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
