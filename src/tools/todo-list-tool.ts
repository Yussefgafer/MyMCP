import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';

const TODO_FILE_PATH = 'todo-list.json';

interface Task {
  id: number;
  text: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  completed: boolean;
}

interface Project {
  name: string;
  tasks: Task[];
}

interface TodoData {
  projects: Project[];
  current_project: string | null;
}

async function readTodoData(): Promise<TodoData> {
  if (await fs.pathExists(TODO_FILE_PATH)) {
    const content = await fs.readFile(TODO_FILE_PATH, 'utf-8');
    return JSON.parse(content);
  }
  return { projects: [], current_project: null };
}

async function writeTodoData(data: TodoData): Promise<void> {
  await fs.writeFile(TODO_FILE_PATH, JSON.stringify(data, null, 2));
}

/**
 * Tool: To-Do List Tool
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'todo-list-tool',
    {
      title: 'To-Do List Tool',
      description: 'Manages multiple to-do lists for different projects.',
      inputSchema: {
        operation: z.string().describe("The operation to perform: create_project, add_task, remove_task, list_tasks, complete_task, list_projects, switch_project"),
        project_name: z.string().optional().describe('The name of the project.'),
        task: z.string().optional().describe('The text of the task to add.'),
        task_id: z.string().optional().describe('The ID of the task to remove or complete.'),
        priority: z.string().optional().describe("The priority of the task: low, medium, high."),
        due_date: z.string().optional().describe("The due date of the task in YYYY-MM-DD format."),
      },
    },
    async (params) => {
      const { operation, project_name, task, task_id, priority, due_date } = params;
      let data = await readTodoData();

      try {
        switch (operation) {
          case 'create_project':
            if (!project_name) {
              return { content: [{ type: 'text', text: "Error: 'project_name' is required." }], isError: true };
            }
            if (data.projects.find(p => p.name === project_name)) {
              return { content: [{ type: 'text', text: `Error: Project '${project_name}' already exists.` }], isError: true };
            }
            data.projects.push({ name: project_name, tasks: [] });
            await writeTodoData(data);
            return { content: [{ type: 'text', text: `Project '${project_name}' created.` }] };

          case 'add_task':
            if (!data.current_project) {
              return { content: [{ type: 'text', text: "Error: No project selected. Use 'switch_project' first." }], isError: true };
            }
            if (!task) {
              return { content: [{ type: 'text', text: "Error: 'task' is required." }], isError: true };
            }
            const project = data.projects.find(p => p.name === data.current_project);
            if (project) {
              const new_task: Task = {
                id: project.tasks.length + 1,
                text: task,
                priority: (priority as any) || 'medium',
                due_date,
                completed: false,
              };
              project.tasks.push(new_task);
              await writeTodoData(data);
              return { content: [{ type: 'text', text: `Task added to project '${data.current_project}'.` }] };
            }
            return { content: [{ type: 'text', text: "Error: Current project not found." }], isError: true };

          case 'remove_task':
            if (!data.current_project) {
              return { content: [{ type: 'text', text: "Error: No project selected." }], isError: true };
            }
            if (!task_id) {
              return { content: [{ type: 'text', text: "Error: 'task_id' is required." }], isError: true };
            }
            const project_to_remove_from = data.projects.find(p => p.name === data.current_project);
            if (project_to_remove_from) {
              project_to_remove_from.tasks = project_to_remove_from.tasks.filter(t => t.id !== parseInt(task_id));
              await writeTodoData(data);
              return { content: [{ type: 'text', text: `Task with ID ${task_id} removed.` }] };
            }
            return { content: [{ type: 'text', text: "Error: Current project not found." }], isError: true };

          case 'list_tasks':
            if (!data.current_project) {
              return { content: [{ type: 'text', text: "Error: No project selected." }], isError: true };
            }
            const project_to_list = data.projects.find(p => p.name === data.current_project);
            if (project_to_list) {
              return { content: [{ type: 'text', text: JSON.stringify(project_to_list.tasks, null, 2) }] };
            }
            return { content: [{ type: 'text', text: "Error: Current project not found." }], isError: true };

          case 'complete_task':
            if (!data.current_project) {
              return { content: [{ type: 'text', text: "Error: No project selected." }], isError: true };
            }
            if (!task_id) {
              return { content: [{ type: 'text', text: "Error: 'task_id' is required." }], isError: true };
            }
            const project_to_complete_in = data.projects.find(p => p.name === data.current_project);
            if (project_to_complete_in) {
              const task_to_complete = project_to_complete_in.tasks.find(t => t.id === parseInt(task_id));
              if (task_to_complete) {
                task_to_complete.completed = true;
                await writeTodoData(data);
                return { content: [{ type: 'text', text: `Task with ID ${task_id} marked as completed.` }] };
              }
              return { content: [{ type: 'text', text: `Error: Task with ID ${task_id} not found.` }], isError: true };
            }
            return { content: [{ type: 'text', text: "Error: Current project not found." }], isError: true };

          case 'list_projects':
            return { content: [{ type: 'text', text: JSON.stringify(data.projects.map(p => p.name), null, 2) }] };

          case 'switch_project':
            if (!project_name) {
              return { content: [{ type: 'text', text: "Error: 'project_name' is required." }], isError: true };
            }
            if (!data.projects.find(p => p.name === project_name)) {
              return { content: [{ type: 'text', text: `Error: Project '${project_name}' not found.` }], isError: true };
            }
            data.current_project = project_name;
            await writeTodoData(data);
            return { content: [{ type: 'text', text: `Switched to project '${project_name}'.` }] };

          default:
            return { content: [{ type: 'text', text: `Error: Unknown operation '${operation}'.` }], isError: true };
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error performing to-do list operation: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
};

export default registerTool;
