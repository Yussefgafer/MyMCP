import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

interface DocumentationStructure {
  title: string;
  sections: {
    title: string;
    content: string;
    subsections?: DocumentationStructure[];
  }[];
}

export default function registerGenerateDocsTool(server: McpServer) {
  server.registerTool(
    'generate-docs',
    {
      title: 'Generate Documentation',
      description: 'Generates documentation for a project including README, API docs, and code documentation.',
      inputSchema: {
        project_path: z.string().describe('Path to the project directory'),
        output_dir: z.string().optional().default('./docs').describe('Output directory for generated documentation'),
        include_api_docs: z.boolean().optional().default(true).describe('Include API documentation'),
        include_code_docs: z.boolean().optional().default(true).describe('Include code documentation'),
        template: z.enum(['simple', 'detailed', 'api-focused']).optional().default('simple').describe('Documentation template style'),
      },
    },
    async (params: {
      project_path: string;
      output_dir?: string;
      include_api_docs?: boolean;
      include_code_docs?: boolean;
      template?: 'simple' | 'detailed' | 'api-focused';
    }) => {
      try {
        const {
          project_path,
          output_dir = './docs',
          include_api_docs = true,
          include_code_docs = true,
          template = 'simple'
        } = params;

        if (!(await fs.pathExists(project_path))) {
          return {
            content: [{ type: 'text', text: `Error: Project directory does not exist: ${project_path}` }],
            isError: true,
          };
        }

        // Ensure output directory exists
        const fullOutputDir = path.isAbsolute(output_dir) ? output_dir : path.join(project_path, output_dir);
        await fs.ensureDir(fullOutputDir);

        // Read package.json if it exists
        let packageInfo = null;
        const packageJsonPath = path.join(project_path, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          try {
            packageInfo = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          } catch (error) {
            // Ignore package.json parsing errors
          }
        }

        // Generate different documentation based on template
        const docs: { [key: string]: string } = {};

        // Main README
        docs['README.md'] = generateReadme(packageInfo, template);

        if (include_api_docs) {
          docs['API.md'] = generateApiDocs(project_path, template);
        }

        if (include_code_docs) {
          docs['CODE.md'] = await generateCodeDocs(project_path, template);
        }

        // Write all documentation files
        const createdFiles: string[] = [];
        for (const [filename, content] of Object.entries(docs)) {
          const filePath = path.join(fullOutputDir, filename);
          await fs.writeFile(filePath, content);
          createdFiles.push(filePath);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully generated documentation in ${createdFiles.length} files:\n${createdFiles.join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error generating documentation: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}

function generateReadme(packageInfo: any, template: string): string {
  const name = packageInfo?.name || 'Project';
  const description = packageInfo?.description || 'A software project';
  const version = packageInfo?.version || '1.0.0';

  let readme = `# ${name}

${description}

## Version
${version}

`;

  if (template === 'detailed') {
    readme += `## Installation

\`\`\`bash
npm install ${name}
\`\`\`

## Usage

\`\`\`javascript
import { ${name} } from '${name}';

// Example usage
const result = ${name}.example();
console.log(result);
\`\`\`

## API Reference

See [API.md](./API.md) for detailed API documentation.

## Development

See [CODE.md](./CODE.md) for code documentation.
`;
  }

  readme += `## License

This project is licensed under the MIT License.
`;

  return readme;
}

function generateApiDocs(projectPath: string, template: string): string {
  let apiDocs = `# API Documentation

This document contains the API reference for the project.

`;

  if (template === 'api-focused') {
    apiDocs += `## Core Modules

### Main Module
- **Location**: \`src/index.ts\`
- **Purpose**: Main entry point
- **Exports**: Public API functions and classes

### Utility Modules
- **Location**: \`src/utils/\`
- **Purpose**: Helper functions and utilities
- **Exports**: Utility functions

## API Reference

### Functions

#### \`main()\`
Main entry point function.

**Returns**: \`Promise<void>\`

### Classes

#### \`ExampleClass\`
Example class for demonstration.

**Constructor**: \`new ExampleClass(options)\`

**Methods**:
- \`method1(param: string): boolean\`
- \`method2(param: number): void\`
`;
  }

  return apiDocs;
}

async function generateCodeDocs(projectPath: string, template: string): Promise<string> {
  let codeDocs = `# Code Documentation

This document contains documentation for the codebase structure and implementation details.

`;

  try {
    // Try to analyze source files
    const srcDir = path.join(projectPath, 'src');
    if (await fs.pathExists(srcDir)) {
      const files = await fs.readdir(srcDir, { recursive: true });
      const tsFiles = files.filter(file => typeof file === 'string' && file.endsWith('.ts'));

      codeDocs += `## Source Files (${tsFiles.length} files)

### Core Files
`;

      for (const file of tsFiles.slice(0, 10)) { // Show first 10 files
        const filePath = path.join(srcDir, file as string);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          // Extract function/class names
          const functions = content.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g) || [];
          const classes = content.match(/class\s+(\w+)/g) || [];

          codeDocs += `- **${file}**`;
          if (functions.length > 0) {
            codeDocs += ` - Functions: ${functions.slice(0, 3).join(', ')}`;
          }
          if (classes.length > 0) {
            codeDocs += ` - Classes: ${classes.slice(0, 3).join(', ')}`;
          }
          codeDocs += '\n';
        } catch (error) {
          // Ignore file reading errors
        }
      }

      if (tsFiles.length > 10) {
        codeDocs += `\n*... and ${tsFiles.length - 10} more files*\n`;
      }
    }
  } catch (error) {
    codeDocs += `\n*Could not analyze source files: ${error}*\n`;
  }

  return codeDocs;
}
