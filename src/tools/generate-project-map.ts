import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

async function buildTree(
  directory: string,
  prefix = '',
  maxDepth?: number,
  ignoreSet?: Set<string>,
  currentDepth = 0
): Promise<string> {
  if (maxDepth !== undefined && currentDepth >= maxDepth) {
    return '';
  }

  let items;
  try {
    items = await fs.readdir(directory);
  } catch (error) {
    return ''; // Cannot read directory, return empty string
  }
  
  const filteredItems = items.filter(item => !ignoreSet?.has(item));
  let tree = '';

  for (let i = 0; i < filteredItems.length; i++) {
    const item = filteredItems[i];
    const itemPath = path.join(directory, item);
    const isLast = i === filteredItems.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    
    tree += `${prefix}${connector}${item}\n`;

    let stats;
    try {
      stats = await fs.stat(itemPath);
    } catch (error) {
      continue; // Cannot stat file, skip
    }

    if (stats.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      tree += await buildTree(itemPath, newPrefix, maxDepth, ignoreSet, currentDepth + 1);
    }
  }
  return tree;
}

export default function generateProjectMap(server: McpServer) {
  server.registerTool(
    'generate-project-map',
    {
      title: 'Generate Project Map',
      description: 'Generates a text-based tree map of a project directory.',
      inputSchema: {
        root_path: z.string().describe('The root directory path of the project to map.'),
        max_depth: z.number().int().positive().optional().describe('The maximum depth to traverse.'),
        ignore: z.string().optional().describe('A space-separated list of file/folder names to ignore (e.g., "node_modules .git").'),
      },
    },
    async (params: { root_path: string; max_depth?: number; ignore?: string }) => {
      try {
        if (!(await fs.pathExists(params.root_path))) {
          return { content: [{ type: 'text', text: `Error: Root path does not exist: ${params.root_path}` }], isError: true };
        }

        const ignoreSet = new Set(params.ignore?.split(' ') || []);
        const tree = await buildTree(params.root_path, '', params.max_depth, ignoreSet);
        const map = `${path.basename(params.root_path)}\n${tree}`;

        return { content: [{ type: 'text', text: map }] };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `An error occurred: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
