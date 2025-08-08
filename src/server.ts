#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerPathRelativeTool } from './tools/path_relative.js';
import { registerGetWorkingDirectoryTool } from './tools/get_working_directory.js';
import { registerParseJunitXmlTool } from './tools/parse_junit_xml.js';
import { registerJunitParsePrompt } from './prompts/junit_parse.js';

const server = new McpServer({
    name: 'various-utils',
    version: '0.1.0',
    title: 'Various Utilities',
});

registerPathRelativeTool(server);
registerGetWorkingDirectoryTool(server);
registerParseJunitXmlTool(server);
registerJunitParsePrompt(server);

const transport = new StdioServerTransport();
await server.connect(transport);