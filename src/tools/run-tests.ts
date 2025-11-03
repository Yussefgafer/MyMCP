import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import * as path from 'path';

const execPromise = promisify(exec);

/**
 * Tool: Run Tests
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'run-tests',
    {
      title: 'Run Tests',
      description:
        "Runs automated tests for a project, automatically detecting the test runner.",
      inputSchema: {
        project_path: z.string().describe("The path to the project directory."),
        test_suite: z.string().optional().describe("The specific test suite or file to run."),
        output_format: z.enum(['text', 'json', 'junit_xml']).optional().default('text').describe("Specifies the test output format."),
        fail_on_error: z.boolean().optional().default(true).describe("If false, the tool will not exit with an error code on test failure."),
        coverage: z.boolean().optional().default(false).describe("If true, collects test coverage information."),
        report_path: z.string().optional().describe("Path to save a test report (e.g., for JUnit XML)."),
        extra_args: z.string().optional().describe("Extra arguments to pass to the test runner."),
      }
    },
    async (params) => {
      const { project_path, test_suite, output_format, fail_on_error, coverage, report_path, extra_args } = params;
      
      try {
        let command = '';
        
        // Auto-detect test runner
        if (await fs.pathExists(path.join(project_path, 'package.json'))) {
            command = 'npm test';
            if (test_suite) command += ` -- ${test_suite}`;
            if (coverage) command += ` -- --coverage`; // npm needs -- to pass args
        } else if (await fs.pathExists(path.join(project_path, 'pytest.ini'))) {
            command = 'pytest';
            if (test_suite) command += ` ${test_suite}`;
            if (coverage) command += ` --cov`;
        } else {
            return { content: [{ type: 'text', text: 'Could not automatically detect a test runner.' }], isError: true };
        }

        if (output_format === 'junit_xml' && report_path) {
            command += ` --junitxml=${report_path}`;
        }
        if (extra_args) {
            command += ` ${extra_args}`;
        }

        const options: ExecOptions = { cwd: project_path, env: process.env };

        const { stdout, stderr } = await execPromise(command, options);

        let resultMessage = `Tests completed successfully.\n`;
        if (stdout) resultMessage += `STDOUT:\n${stdout}\n`;
        if (stderr) resultMessage += `STDERR (warnings):\n${stderr}\n`;

        return { content: [{ type: 'text', text: resultMessage }] };

      } catch (error: any) {
        let errorMessage = `Tests failed: ${error.message}\n`;
        if (error.stdout) errorMessage += `STDOUT:\n${error.stdout}\n`;
        if (error.stderr) errorMessage += `STDERR:\n${error.stderr}\n`;
        
        if (fail_on_error) {
            return { content: [{ type: 'text', text: errorMessage }], isError: true };
        } else {
            return { content: [{ type: 'text', text: `Tests completed with non-critical errors:\n${errorMessage}` }] };
        }
      }
    }
  );
};

export default registerTool;
