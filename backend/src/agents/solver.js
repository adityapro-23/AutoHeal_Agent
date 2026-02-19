const fs = require('fs');
const path = require('path');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage } = require('@langchain/core/messages');

/**
 * Agent Three: The Solver
 * Fixes OPEN issues using full file content + test failure context.
 * Marks each issue FIXED (or FAILED_*) in issues_log.json immediately after.
 */
async function runSolver(localPath, openIssues, issuesLogPath, testOutput = '') {
    console.log('[Solver] Starting repairs...');
    const model = new ChatOpenAI({ modelName: 'gpt-4-turbo', temperature: 0 });
    const fixesApplied = [];

    if (!openIssues || openIssues.length === 0) return { fixesApplied };

    const updateIssueStatus = (file, type, line, newStatus) => {
        try {
            const log = JSON.parse(fs.readFileSync(issuesLogPath, 'utf8'));
            const issue = log.issues.find(i => i.file === file && i.type === type && i.line === line);
            if (issue) {
                issue.status = newStatus;
                issue.fixedAt = new Date().toISOString();
                fs.writeFileSync(issuesLogPath, JSON.stringify(log, null, 2));
                console.log(`[Solver] Marked ${file}::${type}::${line} as ${newStatus} in issues_log.json`);
            }
        } catch (e) {
            console.error('[Solver] Failed to update issues_log.json:', e.message);
        }
    };

    // Relevnt test output snippet for context
    const testSnippet = testOutput ? testOutput.substring(0, 3000) : '';

    for (const issue of openIssues) {
        try {
            console.log(`[Solver] Fixing ${issue.type} in ${issue.file}...`);
            const filePath = path.join(localPath, issue.file);

            if (!fs.existsSync(filePath)) {
                console.error(`[Solver] File not found: ${filePath}`);
                updateIssueStatus(issue.file, issue.type, issue.line, 'FAILED_FILE_NOT_FOUND');
                continue;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');

            const prompt = `
You are an expert software engineer. Fix the specific bug in the source file described below.

Bug Details:
- File: ${issue.file}
- Type: ${issue.type}
- Line: ${issue.line || 'unknown'}
- Description: ${issue.description}

Failing Test Output (for context only — do NOT edit test files):
\`\`\`
${testSnippet}
\`\`\`

Current content of "${issue.file}":
\`\`\`
${fileContent}
\`\`\`

Instructions:
1. Fix ONLY the specific bug described above. Do NOT change any other logic.
2. Do NOT modify test files — only fix the source/implementation file.
3. Return the COMPLETE corrected content of "${issue.file}" — nothing else.
4. No explanation, no markdown fences, just the raw corrected code.
`;

            const response = await model.invoke([new HumanMessage(prompt)]);
            let fixedContent = response.content;

            // Strip markdown fences
            if (fixedContent.includes('```')) {
                fixedContent = fixedContent
                    .replace(/^```[\w]*\n?/gm, '')
                    .replace(/```$/gm, '')
                    .trim();
            }

            fs.writeFileSync(filePath, fixedContent);

            // Mark fixed in issues_log immediately
            updateIssueStatus(issue.file, issue.type, issue.line, 'FIXED');

            fixesApplied.push({
                file: issue.file,
                type: issue.type,
                description: issue.description,
                line: issue.line,
                status: 'APPLIED'
            });

        } catch (error) {
            console.error(`[Solver] Failed to fix ${issue.file}:`, error.message);
            updateIssueStatus(issue.file, issue.type, issue.line, 'FAILED_GENERATION');
        }
    }

    return { fixesApplied };
}

module.exports = { runSolver };
