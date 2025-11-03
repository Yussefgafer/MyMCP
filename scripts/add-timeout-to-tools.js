#!/usr/bin/env node

/**
 * Script to add timeout parameter to all tools
 * This script will automatically add timeout functionality to all tools in the project
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_DIR = path.join(__dirname, 'src', 'tools');
const UTILS_DIR = path.join(__dirname, 'src', 'utils');

async function addTimeoutToAllTools() {
  console.log('🔧 Adding timeout parameter to all tools...');

  // Ensure timeout utility exists
  const timeoutUtilPath = path.join(UTILS_DIR, 'timeout.ts');
  if (!(await fs.pathExists(timeoutUtilPath))) {
    console.log('❌ Timeout utility not found, creating it...');
    await fs.ensureDir(UTILS_DIR);

    const timeoutUtilContent = `/**
 * Timeout utility for operations
 * Provides timeout functionality with AbortController
 */

export interface TimeoutOptions {
  timeout?: number; // timeout in milliseconds
  signal?: AbortSignal;
}

/**
 * Wraps a promise with timeout functionality
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Custom timeout message
 * @returns Promise that rejects with timeout error if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = \`Operation timed out after \${timeoutMs}ms\`
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Creates an AbortController with timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Clear timeout if operation completes
  const originalSignal = controller.signal;
  const cleanup = () => clearTimeout(timeoutId);

  originalSignal.addEventListener('abort', cleanup);

  return controller;
}

/**
 * Validates and normalizes timeout value
 * @param timeout Timeout value from parameters
 * @param defaultTimeout Default timeout in seconds
 * @param maxTimeout Maximum allowed timeout in seconds
 * @returns Timeout in milliseconds
 */
export function normalizeTimeout(
  timeout?: number,
  defaultTimeout: number = 120,
  maxTimeout: number = 600
): number {
  const timeoutSeconds = timeout ?? defaultTimeout;
  const clampedTimeout = Math.min(Math.max(timeoutSeconds, 1), maxTimeout);
  return clampedTimeout * 1000; // Convert to milliseconds
}
`;

    await fs.writeFile(timeoutUtilPath, timeoutUtilContent);
    console.log('✅ Created timeout utility');
  }

  // Get all tool files
  const toolFiles = await fs.readdir(TOOLS_DIR);
  const tsFiles = toolFiles.filter(file => file.endsWith('.ts') && file !== 'index.ts');

  console.log(\`📋 Found \${tsFiles.length} tool files\`);

  for (const file of tsFiles) {
    const filePath = path.join(TOOLS_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // Skip if already has timeout import
    if (content.includes('normalizeTimeout')) {
      console.log(\`⏭️  Skipping \${file} (already has timeout)\`);
      continue;
    }

    try {
      // Add timeout import
      let updatedContent = content.replace(
        /import.*from.*utils.*timeout.*;/,
        ''
      );

      // Add timeout import after other imports
      updatedContent = updatedContent.replace(
        /(import.*;\s*)$/m,
        '$1import { withTimeout, normalizeTimeout } from \'../utils/timeout\';\n'
      );

      // Add timeout parameter to inputSchema
      updatedContent = updatedContent.replace(
        /(timeout:\s*z\.number\(\)\.optional\(\)\.describe\([^)]+\))/,
        '$1, // Already exists'
      );

      // Add timeout to inputSchema if not exists
      if (!updatedContent.includes('timeout:')) {
        updatedContent = updatedContent.replace(
          /(inputSchema:\s*\{[^}]*\})/,
          (match) => {
            const schema = match.slice(0, -1); // Remove closing brace
            return schema + ',\n        timeout: z.number().optional().describe("Timeout in seconds for the operation (default: 120 seconds, max: 600 seconds)"),\n      }';
          }
        );
      }

      // Add timeout to function parameters
      updatedContent = updatedContent.replace(
        /(\}\s*=>\s*\{)/,
        (match) => {
          if (!match.includes('timeout')) {
            return match.replace('})', ', timeout })');
          }
          return match;
        }
      );

      // Add timeout logic to function body
      updatedContent = updatedContent.replace(
        /(async\s*\([^)]*\{)/,
        (match) => {
          if (!match.includes('timeoutMs')) {
            return match.replace('{', '{\n        // Normalize and apply timeout\n        const timeoutMs = normalizeTimeout(timeout);\n\n');
          }
          return match;
        }
      );

      // Wrap main operation with timeout
      updatedContent = updatedContent.replace(
        /(return\s*\{[^}]*content:\s*\[)/,
        (match) => {
          return `        // Execute with timeout\n        const result = await withTimeout(operation(), timeoutMs, \`Operation timed out after \${timeoutMs}ms\`);\n\n        return \{${match.slice(7)}`;
        }
      );

      await fs.writeFile(filePath, updatedContent);
      console.log(\`✅ Updated \${file}\`);

    } catch (error) {
      console.log(\`❌ Failed to update \${file}: \${error.message}\`);
    }
  }

  console.log('🎉 Finished adding timeout to all tools!');
}

// Run the script
addTimeoutToAllTools().catch(console.error);
