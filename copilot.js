const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper to read file content safely.
 */
const getFileSection = (title, filePath, language) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return `### ${title}\n**Path:** \`${filePath}\`\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    } catch (e) {
        return `### ${title}\n[⚠️ Error: File not found at ${filePath}]\n`;
    }
};

// 1. Prepare the embedded content
const mcpToolsContent = getFileSection('MCP Tools Documentation', 'prompt-files/mcp-tools.md', 'markdown');
const mcpPlaywrightEx = getFileSection('Reference: Playwright MCP Example', 'prompt-files/mcp-playwright.js', 'javascript');
const lastCreatedFile = getFileSection('Previous Implementation (Reference)', 'implementation.js', 'javascript');
const promptJsContent = getFileSection('Target File: prompt.js', 'prompt-files/prompt.js', 'javascript');
const lastOutputContent = getFileSection('Last Execution Output', 'prompt-files/output.txt', 'text');

// 2. Define the core task requirements (Updated with direct Node.js instructions)
const concreteTask = `
3. **Modify the \`implementation\` Variable**:
   Update the string content of the \`implementation\` constant in \`prompt.js\` using native Node.js functionality:
   - **Direct Node.js Usage**: Use native Node.js \`fs.readdirSync\` and \`fs.readFileSync\` to perform file operations within the allowed directory: \`C:\\Users\\4artu\\IdeaProjects\\copilot\`.
   - **Functional Filtering**: Create \`findSourceFiles(entries)\` to return paths of all \`.js\` and \`.md\` files found, explicitly filtering out any paths containing \`node_modules\`.
   - **Content Analysis**: Read the found files and calculate the actual total character count of all combined content.
   - **Utility Requirement**: Include the \`getEvenSorted(arr)\` function (filters even numbers, sorts ascending, returns \`[]\` for invalid inputs).
   - **Final Test Output**: Use \`console.log\` to print a JSON object with:
     1. \`filesFound\`: The list of actual file paths analyzed.
     2. \`totalChars\`: The real character count from the read files.
     3. \`mathResult\`: The output of \`getEvenSorted([42, 11, 8, 103, 4, 1])\`.`;

// 3. Construct the task-to-implement.md
const taskContent = `# Task: Update Implementation in prompt.js

## 📂 Context & Reference Files
${mcpToolsContent}

> **Allowed Directory:** \`C:\\Users\\4artu\\IdeaProjects\\copilot\`
> **Instruction:** Use native Node.js \`fs\` and \`path\` modules for all filesystem tasks.

${mcpPlaywrightEx}

---

## 🛠️ Evolution Context
${lastCreatedFile}
${lastOutputContent}

---

## 🎯 Target File for Modification
${promptJsContent}

---

## 🛠️ Instructions for Copilot

1. **Update Script Logic (TODOs)**:
   - Synchronously delete \`prompt-files/output.txt\` before running the new code.
   - Execute the generated \`implementation.js\` and capture the output.

2. **Strict Constraints**:
   - **Non-Destructive**: DO NOT delete or update any existing files provided in the context other than generating the new content for \`prompt.js\`.
   - **Infrastructure**: DO NOT touch MCP SDK requires, server setup, or exports in \`prompt.js\`.
   - **Syntax**: Use **CommonJS** (\`require\`). No ESM (\`import\`).

${concreteTask}

---
**End of Task Description**`;

// 4. Save the file
fs.writeFileSync('task-to-implement.md', taskContent);

// !!! IMPORTANT: do not change this prompt
const promptForCopilot = `Read task-to-implement.md and implement the requested changes. Return only the code.`;

try {
    const command = process.platform === 'win32' ? `echo ${promptForCopilot} | clip` : `echo "${promptForCopilot}" | pbcopy`;
    execSync(command);
} catch (e) {
    console.error('Could not copy to clipboard.');
}

console.log('Created: task-to-implement.md (Direct Node.js instructions added)');