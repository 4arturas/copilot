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
            { title: 'Reference: Variable Styles', filePath: 'prompt-progress-openedge-4g/progress-variables.txt', language: 'text' },
            { title: 'Reference: Code Style', filePath: 'prompt-progress-openedge-4g/code-style.txt', language: 'text' },
            { title: 'Reference: Code Return Style', filePath: 'prompt-progress-openedge-4g/code-return-style.txt', language: 'text' },
            { title: 'Last Execution Output', filePath: 'prompt-progress-openedge-4g/output.txt', language: 'text' }
        ],
        requirements = `
**Requirements**:

Implement a program that:

1. Takes a list of numbers as input (hardcoded array: 42, 11, 8, 103, 4, 1)
2. Filters only even numbers from the list
3. Sorts the even numbers in ascending order
4. Outputs the result either to screen or to a file called output.txt

Expected output: [4, 8, 42]

- Use proper variable naming conventions
- Handle edge cases (empty list, no even numbers)
- Wrap code with {CODE_START}...{CODE_END} markers
`,
        outputFile = 'task-progress-openedge-4g.md'
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
    console.log('Created: task-progress-openedge-4g.md');
}