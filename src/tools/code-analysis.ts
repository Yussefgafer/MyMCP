import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

interface CodeAnalysis {
  fileCount: number;
  totalLines: number;
  totalCharacters: number;
  languageBreakdown: { [key: string]: number };
  complexityScore: number;
  issues: string[];
}

export default function registerCodeAnalysisTool(server: McpServer) {
  server.registerTool(
    'code-analysis',
    {
      title: 'Code Analysis',
      description: 'Analyzes code files for complexity, structure, and potential issues.',
      inputSchema: {
        directory: z.string().describe('Directory path to analyze'),
        include_patterns: z.array(z.string()).optional().default(['**/*.{js,ts,jsx,tsx,py,java,go,rs,cpp,c}']).describe('File patterns to include'),
        exclude_patterns: z.array(z.string()).optional().default(['**/node_modules/**', '**/dist/**', '**/*.min.js']).describe('Patterns to exclude'),
        max_depth: z.number().optional().default(10).describe('Maximum directory depth to analyze'),
      },
    },
    async (params: {
      directory: string;
      include_patterns?: string[];
      exclude_patterns?: string[];
      max_depth?: number;
    }) => {
      try {
        const { directory, include_patterns = ['**/*.{js,ts,jsx,tsx,py,java,go,rs,cpp,c}'], exclude_patterns = ['**/node_modules/**', '**/dist/**', '**/*.min.js'], max_depth = 10 } = params;

        if (!(await fs.pathExists(directory))) {
          return {
            content: [{ type: 'text', text: `Error: Directory does not exist: ${directory}` }],
            isError: true,
          };
        }

        const analysis: CodeAnalysis = {
          fileCount: 0,
          totalLines: 0,
          totalCharacters: 0,
          languageBreakdown: {},
          complexityScore: 0,
          issues: [],
        };

        // Simple file extension to language mapping
        const languageMap: { [key: string]: string } = {
          '.js': 'JavaScript',
          '.ts': 'TypeScript',
          '.jsx': 'React JSX',
          '.tsx': 'React TSX',
          '.py': 'Python',
          '.java': 'Java',
          '.go': 'Go',
          '.rs': 'Rust',
          '.cpp': 'C++',
          '.c': 'C',
          '.php': 'PHP',
          '.rb': 'Ruby',
          '.swift': 'Swift',
          '.kt': 'Kotlin',
          '.scala': 'Scala',
          '.clj': 'Clojure',
          '.ex': 'Elixir',
          '.exs': 'Elixir',
        };

        // Analyze files recursively
        const analyzeDirectory = async (dir: string, depth: number = 0): Promise<void> => {
          if (depth > max_depth) return;

          try {
            const items = await fs.readdir(dir, { withFileTypes: true });

            for (const item of items) {
              const itemPath = path.join(dir, item.name);

              // Skip excluded patterns
              const isExcluded = exclude_patterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                return regex.test(itemPath.replace(directory, ''));
              });

              if (isExcluded) continue;

              if (item.isDirectory()) {
                await analyzeDirectory(itemPath, depth + 1);
              } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();

                // Check if file matches include patterns
                const isIncluded = include_patterns.some(pattern => {
                  const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.'));
                  return regex.test(itemPath);
                });

                if (!isIncluded) continue;

                try {
                  const content = await fs.readFile(itemPath, 'utf-8');
                  const lines = content.split('\n');
                  const lineCount = lines.length;
                  const charCount = content.length;

                  analysis.fileCount++;
                  analysis.totalLines += lineCount;
                  analysis.totalCharacters += charCount;

                  const language = languageMap[ext] || 'Other';
                  analysis.languageBreakdown[language] = (analysis.languageBreakdown[language] || 0) + lineCount;

                  // Simple complexity analysis
                  const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|def\s+\w+|class\s+\w+/g) || []).length;
                  const commentCount = (content.match(/\/\/.*$|\/\*[\s\S]*?\*\/|#[^!].*$/gm) || []).length;
                  const blankLines = lines.filter(line => line.trim() === '').length;

                  // Calculate complexity score (simple heuristic)
                  const codeLines = lineCount - commentCount - blankLines;
                  const complexity = Math.max(1, Math.min(10, (functionCount * 0.1) + (codeLines / 100)));

                  analysis.complexityScore += complexity;

                  // Check for potential issues
                  if (lineCount > 500) {
                    analysis.issues.push(`${itemPath}: Large file (${lineCount} lines)`);
                  }
                  if (functionCount > 20) {
                    analysis.issues.push(`${itemPath}: High function count (${functionCount})`);
                  }
                  if (lines.some(line => line.length > 120)) {
                    analysis.issues.push(`${itemPath}: Lines longer than 120 characters`);
                  }
                } catch (error) {
                  analysis.issues.push(`${itemPath}: Could not read file`);
                }
              }
            }
          } catch (error) {
            analysis.issues.push(`${dir}: Could not read directory`);
          }
        };

        await analyzeDirectory(directory);

        // Calculate average complexity
        const avgComplexity = analysis.fileCount > 0 ? (analysis.complexityScore / analysis.fileCount).toFixed(2) : '0';

        let output = `# Code Analysis Report

## Summary
- **Total Files**: ${analysis.fileCount}
- **Total Lines**: ${analysis.totalLines.toLocaleString()}
- **Total Characters**: ${analysis.totalCharacters.toLocaleString()}
- **Average Complexity**: ${avgComplexity}/10
- **Issues Found**: ${analysis.issues.length}

## Language Breakdown
`;

        for (const [language, lines] of Object.entries(analysis.languageBreakdown)) {
          output += `- ${language}: ${lines.toLocaleString()} lines\n`;
        }

        if (analysis.issues.length > 0) {
          output += '\n## Issues Found\n';
          analysis.issues.forEach(issue => {
            output += `- ${issue}\n`;
          });
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error analyzing code: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
