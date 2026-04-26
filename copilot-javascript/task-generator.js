const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const getFileSection = (title, filePath, language) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return `### ${title}\n**Path:** \`${filePath}\`\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    } catch (e) {
        return `### ${title}\n[File not found: ${filePath}]\n`;
    }
};

function generateTask(options = {}) {
    const {
        filesToEmbed = [
            { title: 'Reference: Code Return Style', filePath: 'prompt-files/code-return-style.txt', language: 'text' },
            { title: 'Reference: Code Style', filePath: 'prompt-files/js-variables.txt', language: 'text' },
            { title: 'Last Generated Code', filePath: 'generated-implementation.js', language: 'javascript' },
            { title: 'Last Execution Output', filePath: 'execution-output.txt', language: 'text' }
        ],
        requirements = `
**Task**:
Analyze the last generated code and execution output. Improve the code to:
1. Use fs module to read files from the current working directory
2. Filter only .js and .md files (exclude node_modules)
3. Read file contents and calculate total character count
4. Include getEvenSorted(arr) function that filters even numbers, sorts ascending, returns [] for invalid input
5. Output JSON with: filesFound (array of file paths), totalChars (number), mathResult (result of getEvenSorted with [42, 11, 8, 103, 4, 1])

**Requirements**:
- Do not add any comments into the code
- Use proper JavaScript syntax
- Use console.log for output
- Output valid JSON: {filesFound, totalChars, mathResult}`,
        outputFile = 'task-javascript.md'
    } = options;

    const embeddedContent = filesToEmbed.map(f => getFileSection(f.title, f.filePath, f.language)).join('\n---\n\n');

    const taskContent = `# Task

## Context
${embeddedContent}

---

## Instructions

Write code based on the context above.

${requirements}`;

    fs.writeFileSync(outputFile, taskContent);
    
    return taskContent;
}

function copyPromptToClipboard(prompt) {
    try {
        const command = process.platform === 'win32' ? `echo ${prompt} | clip` : `echo "${prompt}" | pbcopy`;
        execSync(command);
        return true;
    } catch (e) {
        console.error('Could not copy to clipboard.');
        return false;
    }
}

function generateAndCopy(options = {}) {
    const {
        promptText = 'Read task file and implement the requested changes. Return only the code.'
    } = options;
    
    generateTask(options);
    return copyPromptToClipboard(promptText);
}

module.exports = {
    getFileSection,
    generateTask,
    copyPromptToClipboard,
    generateAndCopy
};

if (require.main === module) {
    generateAndCopy();
    console.log('Created: task-javascript.md');
}