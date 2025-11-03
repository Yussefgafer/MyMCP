import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

interface CodeSuggestion {
  file: string;
  line: number;
  type: 'performance' | 'security' | 'maintainability' | 'best_practice';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
}

export default function registerCodeSuggestionsTool(server: McpServer) {
  server.registerTool(
    'code-suggestions',
    {
      title: 'Code Suggestions',
      description: 'Analyzes code files and provides suggestions for improvements.',
      inputSchema: {
        directory: z.string().describe('Directory path to analyze'),
        include_patterns: z.array(z.string()).optional().default(['**/*.{js,ts,jsx,tsx}']).describe('File patterns to include'),
        suggestion_types: z.array(z.enum(['performance', 'security', 'maintainability', 'best_practice'])).optional().default(['performance', 'security']).describe('Types of suggestions to generate'),
        max_suggestions: z.number().optional().default(50).describe('Maximum number of suggestions to return'),
      },
    },
    async (params: {
      directory: string;
      include_patterns?: string[];
      suggestion_types?: ('performance' | 'security' | 'maintainability' | 'best_practice')[];
      max_suggestions?: number;
    }) => {
      try {
        const {
          directory,
          include_patterns = ['**/*.{js,ts,jsx,tsx}'],
          suggestion_types = ['performance', 'security'],
          max_suggestions = 50
        } = params;

        if (!(await fs.pathExists(directory))) {
          return {
            content: [{ type: 'text', text: `Error: Directory does not exist: ${directory}` }],
            isError: true,
          };
        }

        const suggestions: CodeSuggestion[] = [];

        // Analyze files recursively
        const analyzeFile = async (filePath: string): Promise<void> => {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const ext = path.extname(filePath).toLowerCase();

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lineNumber = i + 1;

              // Performance suggestions
              if (suggestion_types.includes('performance')) {
                // Check for console.log in production code
                if (line.includes('console.log') && !line.trim().startsWith('//')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'performance',
                    severity: 'low',
                    message: 'Console.log statements in production code',
                    suggestion: 'Remove or replace console.log with proper logging'
                  });
                }

                // Check for synchronous file operations
                if (line.includes('fs.readFileSync') || line.includes('fs.writeFileSync')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'performance',
                    severity: 'medium',
                    message: 'Synchronous file operations',
                    suggestion: 'Consider using asynchronous file operations for better performance'
                  });
                }

                // Check for large loops without optimization
                if (line.includes('for (let i = 0; i < array.length; i++)') && lines[i + 1]?.includes('array[i]')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'performance',
                    severity: 'low',
                    message: 'Traditional for loop',
                    suggestion: 'Consider using array methods like forEach, map, or filter for better readability'
                  });
                }
              }

              // Security suggestions
              if (suggestion_types.includes('security')) {
                // Check for potential path traversal
                if (line.includes('path.join') && line.includes('..')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'security',
                    severity: 'high',
                    message: 'Potential path traversal vulnerability',
                    suggestion: 'Validate and sanitize file paths to prevent directory traversal attacks'
                  });
                }

                // Check for eval usage
                if (line.includes('eval(')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'security',
                    severity: 'high',
                    message: 'Use of eval() function',
                    suggestion: 'Avoid using eval() as it can execute arbitrary code. Consider safer alternatives.'
                  });
                }

                // Check for innerHTML usage
                if (line.includes('.innerHTML =')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'security',
                    severity: 'medium',
                    message: 'Direct innerHTML assignment',
                    suggestion: 'Consider using textContent or createElement to prevent XSS attacks'
                  });
                }
              }

              // Maintainability suggestions
              if (suggestion_types.includes('maintainability')) {
                // Check for long functions
                if (line.includes('function ') || line.includes('const ') && line.includes('= (')) {
                  // Count lines until next function or end of file
                  let functionLines = 1;
                  for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].includes('function ') || (lines[j].includes('const ') && lines[j].includes('= ('))) {
                      break;
                    }
                    functionLines++;
                  }

                  if (functionLines > 30) {
                    suggestions.push({
                      file: filePath,
                      line: lineNumber,
                      type: 'maintainability',
                      severity: 'medium',
                      message: 'Long function detected',
                      suggestion: `Consider breaking this function into smaller, more focused functions (currently ${functionLines} lines)`
                    });
                  }
                }

                // Check for long lines
                if (line.length > 120) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'maintainability',
                    severity: 'low',
                    message: 'Line too long',
                    suggestion: 'Consider breaking long lines for better readability (current length: ' + line.length + ')'
                  });
                }
              }

              // Best practice suggestions
              if (suggestion_types.includes('best_practice')) {
                // Check for missing error handling
                if ((line.includes('async ') || line.includes('Promise')) && !line.includes('catch') && !line.includes('try')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'best_practice',
                    severity: 'medium',
                    message: 'Missing error handling',
                    suggestion: 'Consider adding try-catch blocks or .catch() handlers for async operations'
                  });
                }

                // Check for missing TypeScript types
                if (ext === '.ts' && line.includes('function') && !line.includes(': ')) {
                  suggestions.push({
                    file: filePath,
                    line: lineNumber,
                    type: 'best_practice',
                    severity: 'low',
                    message: 'Missing return type annotation',
                    suggestion: 'Consider adding explicit return type annotations for better type safety'
                  });
                }
              }

              // Limit suggestions to prevent overwhelming output
              if (suggestions.length >= max_suggestions) {
                return;
              }
            }
          } catch (error) {
            // Ignore file reading errors
          }
        };

        const analyzeDirectory = async (dir: string): Promise<void> => {
          try {
            const items = await fs.readdir(dir, { withFileTypes: true });

            for (const item of items) {
              const itemPath = path.join(dir, item.name);

              if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'dist') {
                await analyzeDirectory(itemPath);
              } else if (item.isFile()) {
                const isIncluded = include_patterns.some(pattern => {
                  const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.'));
                  return regex.test(itemPath);
                });

                if (isIncluded) {
                  await analyzeFile(itemPath);
                }
              }

              if (suggestions.length >= max_suggestions) {
                break;
              }
            }
          } catch (error) {
            // Ignore directory reading errors
          }
        };

        await analyzeDirectory(directory);

        // Sort suggestions by severity and type
        suggestions.sort((a, b) => {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          const typeOrder = { security: 4, performance: 3, maintainability: 2, best_practice: 1 };

          if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[b.severity] - severityOrder[a.severity];
          }
          return typeOrder[b.type] - typeOrder[a.type];
        });

        // Generate output
        let output = `# Code Analysis & Suggestions

**Analyzed directory**: ${directory}
**Total suggestions**: ${suggestions.length}
**Suggestion types**: ${suggestion_types.join(', ')}

`;

        if (suggestions.length === 0) {
          output += `## ✅ No suggestions found!

Your code follows best practices! Great job maintaining clean, secure, and efficient code.
`;
        } else {
          // Group suggestions by type
          const suggestionsByType: { [key: string]: CodeSuggestion[] } = {};
          for (const suggestion of suggestions) {
            if (!suggestionsByType[suggestion.type]) {
              suggestionsByType[suggestion.type] = [];
            }
            suggestionsByType[suggestion.type].push(suggestion);
          }

          for (const [type, typeSuggestions] of Object.entries(suggestionsByType)) {
            output += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Suggestions (${typeSuggestions.length})\n\n`;

            for (const suggestion of typeSuggestions) {
              output += `### ${suggestion.severity.toUpperCase()} - ${suggestion.message}
- **File**: ${suggestion.file}
- **Line**: ${suggestion.line}
- **Suggestion**: ${suggestion.suggestion}

`;
            }
          }
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error analyzing code for suggestions: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
