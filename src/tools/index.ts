import registerMergePdfTool from './merge-pdf';
import registerSplitPdfTool from './split-pdf';
import registerCompressImagesTool from './compress-images';
import registerMonitorResourcesTool from './monitor-resources';
import registerMemoryManagementTool from './memory-management';
import registerNetworkMonitorTool from './network-monitor';
import registerPermissionsManagerTool from './permissions-manager';
import registerCodeAnalysisTool from './code-analysis';
import registerCodeSuggestionsTool from './code-suggestions';
import registerGenerateDocsTool from './generate-docs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import knowledgeBaseManager from './knowledge-base-manager';
import dataTransformation from './data-transformation';
import networkDiagnostics from './network-diagnostics';
import watchFileChanges from './watch-file-changes';
import generateProjectMap from './generate-project-map';
import manageBackgroundProcess from './manage-background-process';
import systemControl from './system-control';
import listProcesses from './list-processes';
import getSystemInfo from './get-system-info';
import findAndReplace from './find-and-replace';
import getFileMetadata from './get-file-metadata';
import countFiles from './count-files';
import listFiles from './list-files';
import createArchive from './create-archive';
import extractArchive from './extract-archive';
import copyFiles from './copy-files';
import moveFiles from './move-files';
import writeFile from './write-file';
import registerReadFileTool from './read-file';
import registerExecuteCommandTool from './execute-command';
import createDir from './create-dir';
import deleteDir from './delete-dir';
import deleteFile from './delete-file';
import gitCommand from './git-command';
import lintFiles from './lint-files';
import installDependencies from './install-dependencies';
import formatCode from './format-code';
import runTests from './run-tests';
import searchCode from './search-code';
import setEnvironmentVariable from './set-environment-variable';
import makeHttpRequest from './make-http-request';
import executeSqlQuery from './execute-sql-query';
import scrapeWeb from './scrape-web';
import querySqlite from './query-sqlite';
import compressFiles from './compress-files';
import processText from './process-text';
import pingTool from './ping-tool';
import todoListTool from './todo-list-tool';
import registerPackageManagerTool from './package-manager';
import registerManageSystemServiceTool from './manage-system-service';
import registerQuranBrowser from './quran-browser'; // Import the Quran browser tool

// Time limit configuration
export { DEFAULT_TIME_LIMIT, MAX_TIME_LIMIT } from '../config/time-limits';

export default function registryTools(server: McpServer) {
  // Create an array of all the imported registration functions
  const allToolFunctions = [
    // New tools
    registerMergePdfTool,
    registerSplitPdfTool,
    registerCompressImagesTool,
    registerMonitorResourcesTool,
    registerMemoryManagementTool,
    registerNetworkMonitorTool,
    registerPermissionsManagerTool,
    registerCodeAnalysisTool,
    registerCodeSuggestionsTool,
    registerGenerateDocsTool,

    // Existing tools
    knowledgeBaseManager,
    dataTransformation,
    networkDiagnostics,
    watchFileChanges,
    generateProjectMap,
    manageBackgroundProcess,
    systemControl,
    listProcesses,
    getSystemInfo,
    findAndReplace,
    getFileMetadata,
    countFiles,
    listFiles,
    createArchive,
    extractArchive,
    copyFiles,
    moveFiles,
    writeFile,
    registerReadFileTool,
    registerExecuteCommandTool,
    createDir,
    deleteDir,
    deleteFile,
    gitCommand,
    lintFiles,
    installDependencies,
    formatCode,
    runTests,
    searchCode,
    setEnvironmentVariable,
    makeHttpRequest,
    executeSqlQuery,
    scrapeWeb,
    querySqlite,
    compressFiles,
    processText,
    pingTool,
    todoListTool,
    registerPackageManagerTool,
    registerManageSystemServiceTool,
    registerQuranBrowser, // Add the new tool function to the array
  ];

  // Loop through the array and call each function with the server instance
  allToolFunctions.forEach((registryFn) => {
    // Check if the import is a valid function before calling
    if (typeof registryFn === 'function') {
      registryFn(server);
    } else {
      console.error('An imported tool is not a function:', registryFn);
    }
  });

  console.log(`${allToolFunctions.length} tools have been registered.`);
}
