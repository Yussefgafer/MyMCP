
# Project Analysis: File Operation MCP Server

## Project Overview

The project is a File Operation MCP (Model Context Protocol) Server designed to provide a robust and flexible set of tools for file and system operations. It is built with TypeScript and now primarily runs on **Bun**, utilizing the MCP SDK for communication. The server has been significantly enhanced to improve tool functionality, standardize the codebase, resolve critical compatibility issues, and implement a highly reliable, automated build and deployment system via its `start_server.sh` script.

## Key Technologies

*   **TypeScript:** Core language for the server.
*   **Bun:** Used for running the server due to its superior speed and performance.
*   **pnpm:** Used for the build process (`rslib build`).
*   **MCP SDK:** Used for creating and managing the MCP server.
*   **Express:** Powers the SSE (Server-Sent Events) and `/health` check transport layer.
*   **Zod:** Used for input validation schema definition.
*   **shell-quote:** A critical security addition for safely executing shell commands.

---

## Build, Deployment, and Rollback System (`start_server.sh`)

The project features an advanced startup script that provides a safe and efficient development workflow, functioning as a local Continuous Integration/Continuous Deployment (CI/CD) system.

*   **Incremental Builds:** The script calculates a SHA256 hash of the `src` directory to detect code changes. The build step is skipped if the code has not changed, resulting in near-instantaneous server restarts.
*   **Automatic Rollback Mechanism:** To ensure the server is always in a runnable state, the script uses a "stable build" concept.
    1.  **Verification:** When code changes are detected, a new "candidate" version is built and started. The script then performs a health check by hitting the `/health` endpoint.
    2.  **Promotion:** Only if the health check is successful, the candidate build is "promoted" to become the new stable version by copying it to the `stable_build` directory.
    3.  **Rollback:** If the build fails or the health check fails, the script discards the faulty candidate and automatically starts the last known good version from the `stable_build` directory, ensuring no downtime.
*   **Current Status:** The script is currently being debugged to resolve a `command not found` error related to how `pnpm` is being called within the script's environment.

---

## Guide for Adding/Modifying Tools

To maintain project stability and compatibility, follow these guidelines when adding or modifying tools:

1.  **Create the Tool File:** Add a new `.ts` file in the `src/tools/` directory.
2.  **Follow the Established Pattern:** Use the `server.registerTool(name, options, handler)` structure.
3.  **Define `inputSchema`:** Define the schema as a **plain JavaScript object** directly inside the `options` object. This is what the SDK expects (`ZodRawShape`).
4.  **Manually Type the Handler:** Explicitly define the types for the `handler`'s parameters to match the `inputSchema` (e.g., `async (params: { param1: string; ... }) => { ... }`). Do not use `z.infer`, as it creates type conflicts with the SDK's generic handler definition.
5.  **Return Structure:** The handler must return an object with a specific structure: `{ content: [{ type: 'text', text: '...' }] }`. For errors, add `{ isError: true }` to the same object.
6.  **Security (Quote Shell Inputs):** Always use the `shell-quote` library to sanitize all user-provided inputs before including them in a command string to prevent command injection.
7.  **Register the Tool:** Import and add your new tool's registration function to the array in `src/tools/index.ts`.
8.  **Update Documentation:** Add a description of the new tool to this `project-analysis.md` file.

---

## Available Tools (Updated)

*   **`package-manager`**: Manages system packages (`apt`) on the host Linux system (install, remove, update, search).
*   **`manage-system-service`**: Controls `systemd` services (start, stop, status, etc.) on the host Linux system.
*   **`list-files`**: Lists files/directories with advanced filtering (size, date, pattern), sorting, and multiple output formats (json, detailed list).
*   **`count-files`**: Counts files/directories with the same advanced filtering capabilities as `list-files`.
*   **`knowledge-base-manager`**: A comprehensive tool for managing a SQLite-based knowledge base.
    *   **Description**: This tool allows for the creation and management of a knowledge base stored in a SQLite database. It supports various operations including database and table creation/deletion, adding, updating, deleting, retrieving, and searching knowledge items. Items consist of a `title`, `content`, and `tags`. It also provides functionality to list all items, retrieve schema information, execute raw SQL queries, and list all unique tags.
    *   **Input Schema**:
        ```typescript
        {
          operation: z.enum([
            'create_db',
            'create_table',
            'drop_table',
            'add_item',
            'update_item',
            'delete_item',
            'search_items',
            'get_item',
            'list_all_items',
            'get_schema',
            'execute_sql',
            'list_tags',
          ]),
          title: z.string().optional(),
          content: z.string().optional(),
          tags: z.string().optional(),
          id: z.number().int().optional(),
          query: z.string().optional(),
          search_tags: z.string().optional(),
          limit: z.number().int().min(1).optional(),
          offset: z.number().int().min(0).optional(),
          sql_query: z.string().optional(),
          fuzzy_threshold: z.number().min(0).max(1).optional(),
          fuzzy_keys: z.string().optional(), // Comma-separated string of keys
        }
        ```
    *   **Operations**:
        *   `create_db`: Initializes the SQLite database file.
        *   `create_table`: Creates the `knowledge_items` table if it doesn't exist.
        *   `drop_table`: Deletes the `knowledge_items` table.
        *   `add_item`: Adds a new knowledge item with a `title`, `content`, and optional `tags`.
        *   `update_item`: Modifies an existing knowledge item by `id`. Can update `title`, `content`, or `tags`.
        *   `delete_item`: Removes a knowledge item by `id`.
        *   `get_item`: Retrieves a single knowledge item by `id`.
        *   `search_items`: Searches knowledge items.
            *   If `query` is provided, performs a fuzzy search on `title`, `content`, and `tags` using `fuse.js`. Customizable with `fuzzy_threshold` (0-1, default 0.4) and `fuzzy_keys` (comma-separated string, default 'title,content,tags').
            *   If `search_tags` is provided (comma-separated), filters items by exact tag matches.
            *   If neither `query` nor `search_tags` are provided, lists all items.
        *   `list_all_items`: Retrieves all knowledge items, with optional `limit` and `offset` for pagination.
        *   `get_schema`: Returns the schema of the `knowledge_items` table.
        *   `execute_sql`: Executes a raw SQL query directly against the database.
        *   `list_tags`: Retrieves all unique tags used across all knowledge items.
    *   **Usage Examples**:
        ```xml
        <!-- Create the database -->
        <use_mcp_tool>
          <server_name>localhost</server_name>
          <tool_name>knowledge-base-manager</tool_name>
          <arguments>
            { "operation": "create_db" }
          </arguments>
        </use_mcp_tool>

        <!-- Create the knowledge_items table -->
        <use_mcp_tool>
          <server_name>localhost</server_name>
          <tool_name>knowledge-base-manager</tool_name>
          <arguments>
            { "operation": "create_table" }
          </arguments>
        </use_mcp_tool>

        <!-- Add a new item -->
        <use_mcp_tool>
          <server_name>localhost</server_name>
          <tool_name>knowledge-base-manager</tool_name>
          <arguments>
            {
              "operation": "add_item",
              "title": "MCP Server Setup",
              "content": "Steps to set up an MCP server locally.",
              "tags": "mcp, setup, server"
            }
          </arguments>
        </use_mcp_tool>

        <!-- Search for items with fuzzy search -->
        <use_mcp_tool>
          <server_name>localhost</server_name>
          <tool_name>knowledge-base-manager</tool_name>
          <arguments>
            {
              "operation": "search_items",
              "query": "server config",
              "fuzzy_threshold": 0.3,
              "fuzzy_keys": "title,content"
            }
          </arguments>
        </use_mcp_tool>

        <!-- List all unique tags -->
        <use_mcp_tool>
          <server_name>localhost</server_name>
          <tool_name>knowledge-base-manager</tool_name>
          <arguments>
            { "operation": "list_tags" }
          </arguments>
        </use_mcp_tool>
        ```
*   ... (and all other previously existing tools) ...
