const { runAuditor } = require('./auditor');
const { runSolver } = require('./solver');
const engineNode = require('../engines/node');
const enginePython = require('../engines/python');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage } = require('@langchain/core/messages');

/**
 * Agent Two: The Orchestrator
 *
 * Flow:
 *  1. Clone repo, create fix branch, detect engine.
 *  2. Iteration 1: Run all tests. Pass → done. Fail → discover ALL issues.
 *  3. Solver fixes OPEN issues, marks each FIXED in issues_log.json.
 *  4. Re-run. Pass → commit issue-by-issue, push branch, status PASSED + endTime.
 *     Fail → re-scan, skip FIXED issues, fix remaining.
 *  5. At end (success OR failure after fixes), always push branch + set endTime.
 */
async function startOrchestrator(repoUrl, teamName, leaderName) {
    console.log('[Orchestrator] Initializing...');

    const resultsPath = path.resolve(__dirname, '../../../results.json');

    const updateFrontend = (data, reset = false) => {
        try {
            const base = (!reset && fs.existsSync(resultsPath))
                ? JSON.parse(fs.readFileSync(resultsPath))
                : {};
            fs.writeFileSync(resultsPath, JSON.stringify({ ...base, ...data }, null, 2));
        } catch (e) {
            console.error('[Orchestrator] Update frontend failed:', e);
        }
    };

    const startTime = Date.now();
    updateFrontend({
        repoUrl, teamName, leaderName,
        status: 'RUNNING', logs: ['Initializing Agent System...'],
        fixes: [], iterations: 0, startTime, endTime: null, filesScanned: 0, branchName: 'N/A'
    }, true);

    // --- Phase 1: Auditor ---
    const auditorResult = await runAuditor(repoUrl, teamName, leaderName);
    if (!auditorResult.success) {
        updateFrontend({ status: 'FAILED', endTime: Date.now(), logs: [`✗ Auditor failed: ${auditorResult.error}`] });
        return;
    }

    const { localPath, branchName } = auditorResult;
    const repoGit = simpleGit(localPath);
    const issuesLogPath = path.join(localPath, 'issues_log.json');

    updateFrontend({ branchName, logs: [`✓ Cloned repo`, `✓ Branch: ${branchName}`] });

    // --- Phase 2: Engine Detection ---
    let engine = null, subDir = '.';
    if (engineNode.discover(localPath)) {
        engine = engineNode;
        subDir = engineNode.discover(localPath);
        updateFrontend({ logs: ['✓ Detected Node.js project'] });
    } else if (enginePython.discover(localPath)) {
        engine = enginePython;
        updateFrontend({ logs: ['✓ Detected Python project'] });
    } else {
        updateFrontend({ status: 'FAILED', endTime: Date.now(), logs: ['✗ No supported language detected'] });
        return;
    }

    // --- Issues log helpers ---
    const readLog = () => {
        try { return JSON.parse(fs.readFileSync(issuesLogPath, 'utf8')); }
        catch { return { issues: [] }; }
    };
    const writeLog = (log) => fs.writeFileSync(issuesLogPath, JSON.stringify(log, null, 2));

    // Helper: collect fixed files for commit
    const commitFixes = async (fixes, outputLog) => {
        const committed = [];
        for (const fix of fixes) {
            try {
                await repoGit.add(fix.file);
                const msg = `[AI-AGENT] Fix ${fix.type} in ${fix.file}: ${fix.description.substring(0, 60)}`;
                await repoGit.commit(msg);
                committed.push({ ...fix, commitMessage: msg, status: 'Fixed' });
                outputLog.push(`  ✓ Committed: ${fix.file} [${fix.type}]`);
            } catch (e) {
                if (!e.message.includes('nothing to commit')) {
                    outputLog.push(`  ⚠ Commit skipped for ${fix.file}: ${e.message}`);
                }
            }
        }
        return committed;
    };

    // --- Phase 3: Healing Loop ---
    const outputLog = [];
    const allFixes = [];     // All fixes applied across iterations
    let isSuccess = false;
    const MAX_ITER = 6;
    let lastTestOutput = '';

    for (let i = 1; i <= MAX_ITER; i++) {
        console.log(`[Orchestrator] Iteration ${i}/${MAX_ITER}...`);
        outputLog.push(`━━━ Iteration ${i} / ${MAX_ITER} ━━━`);
        outputLog.push(`Running test suite...`);
        updateFrontend({ iterations: i, logs: [...outputLog] });

        // A. Run tests
        const runResult = await engine.run(localPath, subDir);
        lastTestOutput = runResult.output;
        outputLog.push(`Test result: ${runResult.success ? '✓ PASS' : '✗ FAIL'}`);

        // B. All tests pass → commit + push + done
        if (runResult.success) {
            isSuccess = true;
            outputLog.push(`🎉 All tests PASSED on iteration ${i}!`);
            updateFrontend({ logs: [...outputLog] });
            break;
        }

        // C. Build set of already-addressed issues
        const currentLog = readLog();
        const addressedKeys = new Set(
            currentLog.issues
                .filter(iss => iss.status !== 'OPEN')
                .map(iss => `${iss.file}::${iss.type}::${iss.line}`)
        );

        // D. Discover issues from LLM — pass full test output + source files list
        const scanLabel = i === 1 ? 'comprehensive scan' : 're-scan';
        outputLog.push(`Analyzing failures (${scanLabel})...`);
        updateFrontend({ logs: [...outputLog] });

        const discovered = await analyzeOutput(runResult.output, localPath);

        // Filter out already-addressed issues BUT check for persistence
        const newIssues = [];
        const reOpenedIssues = [];

        for (const disc of discovered) {
            const keys = [`${disc.file}::${disc.type}::${disc.line}`, `${disc.file}::${disc.type}::0`]; // fuzzy match line 0

            // Check if this issue was supposedly FIXED
            const existingFixed = currentLog.issues.find(iss =>
                (keys.includes(`${iss.file}::${iss.type}::${iss.line}`)) && iss.status === 'FIXED'
            );

            if (existingFixed) {
                // IT CAME BACK! Re-open it.
                console.log(`[Orchestrator] Issue reappeared: ${disc.file}::${disc.type}`);
                existingFixed.status = 'OPEN';
                existingFixed.description += " [NOTE: Previous fix failed. Try a different approach.]";
                reOpenedIssues.push(existingFixed);
            } else if (!addressedKeys.has(`${disc.file}::${disc.type}::${disc.line}`)) {
                // Truly new issue
                newIssues.push(disc);
            }
        }

        console.log(`[Orchestrator] Iter ${i}: ${discovered.length} found. New: ${newIssues.length}, Re-opened: ${reOpenedIssues.length}`);

        if (newIssues.length === 0 && reOpenedIssues.length === 0) {
            // All known issues are fixed but tests still fail — could be residual or env issue
            outputLog.push(`⚠ All known issues marked fixed, but tests still failing.`);
            outputLog.push(`This requires manual review or structural changes.`);
            updateFrontend({ logs: [...outputLog] });
            break;
        }

        if (reOpenedIssues.length > 0) {
            outputLog.push(`⚠ ${reOpenedIssues.length} issue(s) reappeared after fix. Re-opening...`);
        }

        if (newIssues.length > 0) {
            outputLog.push(`Found ${newIssues.length} new issue(s).`);
        }

        outputLog.push(`Found ${newIssues.length} issue(s) to fix:`);
        newIssues.forEach((iss, idx) => {
            outputLog.push(`  ${idx + 1}. [${iss.type}] ${iss.file}:${iss.line || '?'} — ${iss.description}`);
        });

        // E. Merge into log + push to frontend immediately
        const existingKeys = new Set(currentLog.issues.map(iss => `${iss.file}::${iss.type}::${iss.line}`));
        for (const iss of newIssues) {
            if (!existingKeys.has(`${iss.file}::${iss.type}::${iss.line}`)) {
                currentLog.issues.push({ ...iss, status: 'OPEN', discoveredAt: i });
            }
        }
        writeLog(currentLog);

        // Push all issues (any status) to the frontend immediately so they appear in the table
        const allIssuesForFrontend = currentLog.issues.map(iss => ({
            file: iss.file,
            type: iss.type,
            line: iss.line || 0,
            description: iss.description,
            status: iss.status,           // OPEN, FIXED, FAILED_*
            commitMessage: iss.commitMessage || null
        }));
        updateFrontend({ fixes: allIssuesForFrontend, logs: [...outputLog] });

        if (i === MAX_ITER) {
            outputLog.push(`Max iterations (${MAX_ITER}) reached.`);
            break;
        }

        // F. Fix OPEN issues
        outputLog.push(`Applying fixes to source files...`);
        updateFrontend({ logs: [...outputLog] });

        const openIssues = currentLog.issues.filter(iss => iss.status === 'OPEN');
        const solveResult = await runSolver(localPath, openIssues, issuesLogPath, lastTestOutput);

        allFixes.push(...solveResult.fixesApplied);
        solveResult.fixesApplied.forEach(fix => {
            outputLog.push(`  ✓ Fixed [${fix.type}] in ${fix.file}`);
        });

        // Re-read log (solver updated statuses) and push live to frontend
        const updatedLog = readLog();
        const updatedFixes = updatedLog.issues.map(iss => ({
            file: iss.file,
            type: iss.type,
            line: iss.line || 0,
            description: iss.description,
            status: iss.status,
            commitMessage: iss.commitMessage || null
        }));
        updateFrontend({ fixes: updatedFixes, logs: [...outputLog] });
    }

    // --- Phase 4: Commit + Push (always if fixes were applied) ---
    if (allFixes.length > 0 || isSuccess) {
        outputLog.push(`Committing ${allFixes.length} fix(es) to branch...`);
        updateFrontend({ logs: [...outputLog] });

        // Commit all fixes that were applied (using issues_log as source of truth)
        const logForCommit = readLog();
        const fixedIssues = logForCommit.issues.filter(iss => iss.status === 'FIXED');
        const committed = await commitFixes(fixedIssues, outputLog);

        // Push branch to remote
        try {
            outputLog.push(`Pushing branch "${branchName}"...`);
            updateFrontend({ logs: [...outputLog] });
            await repoGit.push('origin', branchName, { '--force': null, '--set-upstream': null });
            outputLog.push(`✓ Branch pushed successfully!`);
        } catch (e) {
            outputLog.push(`⚠ Push failed: ${e.message}`);
        }

        const finalStatus = isSuccess ? 'PASSED' : 'FAILED';
        updateFrontend({ status: finalStatus, endTime: Date.now(), fixes: committed, logs: [...outputLog] });
    } else {
        updateFrontend({ status: 'FAILED', endTime: Date.now(), logs: [...outputLog] });
    }

    console.log(`[Orchestrator] Done. Success: ${isSuccess}`);
}

/**
 * LLM: Analyze test output and map failures to SOURCE files (not test files).
 * Provides list of source files in the repo for better context.
 */
async function analyzeOutput(output, localPath) {
    const model = new ChatOpenAI({ modelName: 'gpt-4-turbo', temperature: 0 });

    // Enumerate source files to help LLM target the right ones
    let srcFiles = '';
    try {
        const srcPath = path.join(localPath, 'src');
        if (fs.existsSync(srcPath)) {
            const files = fs.readdirSync(srcPath).map(f => `src/${f}`);
            srcFiles = `Source files in this repo:\n${files.join('\n')}`;
        }
    } catch (e) { /* ignore */ }

    const prompt = `
You are a CI/CD diagnostic agent. Analyze the failing test output and identify issues in the SOURCE CODE.

CRITICAL RULES:
1. Tests fail because SOURCE CODE has bugs — fix the SOURCE FILES (e.g. src/calculator.js), NOT the test files.
2. Only fix test files if the test itself has an obvious error (e.g. wrong assertion with no corresponding source issue).
3. "file" MUST be a RELATIVE path from repo root (e.g. "src/calculator.js"). NEVER "/app/..." absolute paths.
4. "type": LINTING | SYNTAX | LOGIC | TYPE_ERROR | IMPORT | INDENTATION | RUNTIME
5. "line": the line number in the SOURCE FILE where the bug is. 0 if unknown.
6. Include EVERY distinct error from user source code.
7. Ignore node_modules, npm install logs, system paths.

${srcFiles}

Return ONLY this JSON:
{ "issues": [ { "description": "...", "file": "src/...", "type": "...", "line": 0, "status": "OPEN" } ] }

Test/Build Output:
${output.substring(0, 12000)}
`;

    try {
        const response = await model.invoke([new HumanMessage(prompt)]);
        const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(content).issues || [];
    } catch (e) {
        console.error('[Orchestrator] LLM Parse Error:', e.message);
        return [];
    }
}

module.exports = { startOrchestrator };
