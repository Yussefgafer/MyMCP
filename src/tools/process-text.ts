import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import { quote } from 'shell-quote';

/**
 * Tool: Text Processing
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'process-text',
    {
      title: 'Text Processing',
      description:
        "Performs various text processing operations including sorting lines, removing duplicates, filtering patterns, replacing text, counting words/lines, and more.",
      inputSchema: {
        file_path: z.string().describe("Path to the text file to process."),
        operation: z.string().describe("The operation to perform: sort, dedupe, filter, replace, count, convert_encoding, split, merge, case_transform, prefix_suffix, tabs_spaces, trim."),
        sort_order: z.string().optional().describe("Sort order (asc/desc) for sort operation."),
        filter_pattern: z.string().optional().describe("Pattern to filter lines (for filter operation)."),
        is_regex: z.string().optional().describe("Whether the pattern is a regex (for filter and replace operations). Should be 'true' or 'false'."),
        find_text: z.string().optional().describe("Text to find (for replace operation)."),
        replace_text: z.string().optional().describe("Replacement text (for replace operation)."),
        merge_paths: z.string().optional().describe("Space-separated paths of files to merge (for merge operation)."),
        case_option: z.string().optional().describe("Case transformation option (for case_transform operation): upper, lower, capitalize."),
        prefix: z.string().optional().describe("Prefix to add to lines (for prefix_suffix operation)."),
        suffix: z.string().optional().describe("Suffix to add to lines (for prefix_suffix operation)."),
        tab_size: z.string().optional().describe("Tab size in spaces (for tabs_spaces operation)."),
        output_path: z.string().optional().describe("Path for output file (optional, if not provided, results are returned as text)."),
      }
    },
    async (params) => {
      const { 
        file_path, 
        operation, 
        sort_order = 'asc', 
        filter_pattern, 
        is_regex, 
        find_text, 
        replace_text, 
        merge_paths, 
        case_option, 
        prefix, 
        suffix, 
        tab_size,
        output_path
      } = params;
      
      try {
        // Check if file exists (except for merge and create operations)
        if (operation !== 'merge' && !(await fs.pathExists(file_path))) {
          return { 
            content: [{ type: 'text', text: `Error: File not found at ${file_path}` }], 
            isError: true 
          };
        }
        
        let resultText = '';
        let processedLines: string[] = [];
        
        switch (operation) {
          case 'sort':
            const content = await fs.readFile(file_path, 'utf-8');
            processedLines = content.split('\n');
            
            if (sort_order === 'asc') {
              processedLines.sort();
            } else {
              processedLines.sort().reverse();
            }
            
            resultText = processedLines.join('\n');
            break;
            
          case 'dedupe':
            const dedupeContent = await fs.readFile(file_path, 'utf-8');
            const lines = dedupeContent.split('\n');
            const uniqueLines = Array.from(new Set(lines));
            resultText = uniqueLines.join('\n');
            break;
            
          case 'filter':
            if (!filter_pattern) {
              return { 
                content: [{ type: 'text', text: "Error: 'filter_pattern' parameter is required for filter operation." }], 
                isError: true 
              };
            }
            
            const filterContent = await fs.readFile(file_path, 'utf-8');
            const filterLines = filterContent.split('\n');
            
            if (is_regex === 'true') {
              try {
                const regex = new RegExp(filter_pattern);
                processedLines = filterLines.filter(line => regex.test(line));
              } catch (error: any) {
                return { 
                  content: [{ type: 'text', text: `Error: Invalid regex pattern - ${error.message}` }], 
                  isError: true 
                };
              }
            } else {
              processedLines = filterLines.filter(line => line.includes(filter_pattern));
            }
            
            resultText = processedLines.join('\n');
            break;
            
          case 'replace':
            if (!find_text) {
              return { 
                content: [{ type: 'text', text: "Error: 'find_text' parameter is required for replace operation." }], 
                isError: true 
              };
            }
            
            const replaceContent = await fs.readFile(file_path, 'utf-8');
            
            if (is_regex === 'true') {
              try {
                const regex = new RegExp(find_text, 'g');
                resultText = replaceContent.replace(regex, replace_text || '');
              } catch (error: any) {
                return { 
                  content: [{ type: 'text', text: `Error: Invalid regex pattern - ${error.message}` }], 
                  isError: true 
                };
              }
            } else {
              resultText = replaceContent.split(find_text).join(replace_text || '');
            }
            break;
            
          case 'count':
            const countContent = await fs.readFile(file_path, 'utf-8');
            const countLines = countContent.split('\n');
            const countWords = countContent.split(/\s+/).filter(word => word.length > 0);
            const countChars = countContent.split('');
            
            resultText = JSON.stringify({
              lines: countLines.length,
              words: countWords.length,
              characters: countChars.length
            }, null, 2);
            break;
            
          case 'convert_encoding':
            // This is a simplified version - actual encoding conversion would require additional dependencies
            resultText = "Encoding conversion is not implemented in this version. File is read as UTF-8 by default.";
            break;
            
          case 'split':
            resultText = "Split operation is not implemented in this version.";
            break;
            
          case 'merge':
            if (!merge_paths) {
              return { 
                content: [{ type: 'text', text: "Error: 'merge_paths' parameter is required for merge operation." }], 
                isError: true 
              };
            }
            
            const paths = merge_paths.split(' ').filter(p => p.trim() !== '');
            if (paths.length === 0) {
              return { 
                content: [{ type: 'text', text: "Error: At least one file path is required for merge operation." }], 
                isError: true 
              };
            }
            
            let mergedContent = '';
            for (const path of paths) {
              if (await fs.pathExists(path)) {
                const fileContent = await fs.readFile(path, 'utf-8');
                mergedContent += fileContent + '\n';
              } else {
                return { 
                  content: [{ type: 'text', text: `Error: File not found at ${path}` }], 
                  isError: true 
                };
              }
            }
            
            resultText = mergedContent;
            break;
            
          case 'case_transform':
            if (!case_option) {
              return { 
                content: [{ type: 'text', text: "Error: 'case_option' parameter is required for case_transform operation." }], 
                isError: true 
              };
            }
            
            const caseContent = await fs.readFile(file_path, 'utf-8');
            const caseLines = caseContent.split('\n');
            
            switch (case_option) {
              case 'upper':
                processedLines = caseLines.map(line => line.toUpperCase());
                break;
              case 'lower':
                processedLines = caseLines.map(line => line.toLowerCase());
                break;
              case 'capitalize':
                processedLines = caseLines.map(line => 
                  line.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ')
                );
                break;
            }
            
            resultText = processedLines.join('\n');
            break;
            
          case 'prefix_suffix':
            const prefixSuffixContent = await fs.readFile(file_path, 'utf-8');
            const prefixSuffixLines = prefixSuffixContent.split('\n');
            
            processedLines = prefixSuffixLines.map(line => {
              let result = line;
              if (prefix) result = prefix + result;
              if (suffix) result = result + suffix;
              return result;
            });
            
            resultText = processedLines.join('\n');
            break;
            
          case 'tabs_spaces':
            const tabsSpacesContent = await fs.readFile(file_path, 'utf-8');
            
            if (tab_size) {
              // Convert tabs to spaces
              const spaces = ' '.repeat(parseInt(tab_size));
              resultText = tabsSpacesContent.replace(/\t/g, spaces);
            } else {
              // Convert spaces to tabs (using 4 spaces as default)
              const defaultSpaces = ' '.repeat(4);
              resultText = tabsSpacesContent.replace(new RegExp(defaultSpaces, 'g'), '\t');
            }
            break;
            
          case 'trim':
            const trimContent = await fs.readFile(file_path, 'utf-8');
            const trimLines = trimContent.split('\n');
            processedLines = trimLines.map(line => line.trim());
            resultText = processedLines.join('\n');
            break;
        }
        
        // Write to output file if specified
        if (output_path) {
          await fs.writeFile(output_path, resultText);
          return { content: [{ type: 'text', text: `Text processing completed successfully. Output written to ${output_path}` }] };
        }
        
        return { content: [{ type: 'text', text: resultText }] };
      } catch (error: any) {
        return { 
          content: [{ type: 'text', text: `Error performing text processing operation: ${error.message}\n${error.stack || ''}` }], 
          isError: true 
        };
      }
    }
  );
};

export default registerTool;
