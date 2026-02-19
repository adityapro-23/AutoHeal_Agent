const { StateGraph, END } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { runTestsInSandbox } = require('./docker');

// --- Helper Functions ---

const git = simpleGit();

/**
 * Clones the repository and creates the required branch.
 */
async function cloneAndSetup(state) {
    const { repoUrl, teamName, leaderName } = state;
    const repoName = repoUrl.split('/').pop().replace('.git', '');
    const localPath = path.resolve(__dirname, '../../temp', repoName + '-' + uuidv4());

    // Strict Branch Naming Rule: UPPERCASE(TEAM_NAME)_UPPERCASE(LEADER_NAME)_AI_Fix
    const branchName = `${teamName.toUpperCase().replace(/ /g, '_')}_${leaderName.toUpperCase().replace(/ /g, '_')}_AI_Fix`;

    try {
        console.log(`Cloning ${repoUrl} to ${localPath}...`);

        // Inject token for authentication
        // NOTE: The user must have GITHUB_TOKEN in .env
        const token = process.env.GITHUB_TOKEN;
        let authUrl = repoUrl;

        if (token && repoUrl.startsWith('https://')) {
            authUrl = repoUrl.replace('https://', `https://${token}@`);
        }

        await git.clone(authUrl, localPath);

        const repoGit = simpleGit(localPath);
        console.log(`Checking out branch ${branchName}...`);
        await repoGit.checkoutLocalBranch(branchName);

        // Configure git user for the container
        await repoGit.addConfig('user.name', 'VicRaptors AI Agent');
        await repoGit.addConfig('user.email', 'agent@vicraptors.com');

        return {
            localPath,
            branchName,
            status: 'CLONED',
            logs: [`Cloned ${repoUrl}`, `Created branch ${branchName}`]
        };
    } catch (error) {
        console.error("Clone failed:", error);
        return { status: 'FAILED', error: error.message };
    }
}

/**
 * Runs tests and updates state with failures.
 */
async function runTests(state) {
    const { localPath, iteration } = state;
    console.log(`Running tests (Iteration ${iteration})...`);

    let outputs = [];
    let passed = true;
    let detectedTypes = [];

    // --- Python Check ---
    if (fs.existsSync(path.join(localPath, 'requirements.txt'))) {
        console.log('Detected Python project');
        detectedTypes.push('Python');
        const imageName = 'python:3.9-alpine';

        // Install flake8 and run it BEFORE pytest to catch linting/syntax errors.
        // Added F401 (unused imports) which is a common linting error in the demo.
        const testCmd = 'pip install flake8 pytest && flake8 . --count --select=E9,F63,F7,F82,F401 --show-source --statistics && pytest';

        const result = await runTestsInSandbox(localPath, testCmd, imageName);
        outputs.push(`--- PYTHON OUTPUT ---\n${result.output}`);

        // Force failure if specific Python errors are detected in output, even if exit code was 0
        if (!result.success || (result.output.includes('SyntaxError') || result.output.includes('E999') || result.output.includes('F401'))) {
            console.log('Detected Python errors in output.');
            passed = false;
        }
    }

    // --- Node.js Check ---
    let nodeDir = null;

    // Debug: List files to understand structure
    try {
        console.log('Files in repo root:', fs.readdirSync(localPath));
        if (fs.existsSync(path.join(localPath, 'frontend'))) {
            console.log('Files in frontend/:', fs.readdirSync(path.join(localPath, 'frontend')));
        }
    } catch (e) { console.error('Error listing files:', e); }

    if (fs.existsSync(path.join(localPath, 'package.json'))) {
        nodeDir = '.';
    } else if (fs.existsSync(path.join(localPath, 'frontend', 'package.json'))) {
        nodeDir = 'frontend';
    }

    if (nodeDir) {
        console.log(`Detected Node.js project in directory: ${nodeDir}`);
        detectedTypes.push('Node.js');
        const imageName = 'node:18-alpine';

        let commands = ['npm install']; // 'npm ci' is better for CI but requires lockfile
        const pkgPath = nodeDir === '.' ? path.join(localPath, 'package.json') : path.join(localPath, nodeDir, 'package.json');

        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts) {
                if (pkg.scripts.test) commands.push('npm test');
                if (pkg.scripts.lint) commands.push('npm run lint');
                // If no test/lint, try build as a fallback to catch errors
                if (!pkg.scripts.test && !pkg.scripts.lint && pkg.scripts.build) commands.push('npm run build');
            }
        } catch (e) {
            console.error("Error reading package.json", e);
        }

        // Access via correct path inside container
        // Container mounts repo at /app.
        // If nodeDir is '.', command is 'npm install ...' (runs in /app)
        // If nodeDir is 'frontend', command is 'cd frontend && npm install ...' (runs in /app/frontend)
        let testCmd = commands.join(' && ');
        if (nodeDir !== '.') {
            testCmd = `cd ${nodeDir} && ${testCmd}`;
        }

        // Increase timeout for npm install? Docker default is usually fine.
        const result = await runTestsInSandbox(localPath, testCmd, imageName);
        outputs.push(`--- NODE.JS OUTPUT ---\n${result.output}`);

        if (!result.success) {
            console.log('Detected Node.js errors.');
            passed = false;
        }
    }

    const finalOutput = outputs.join('\n\n');
    console.log(`\n--- COMBINED TEST OUTPUT (Iter ${iteration}) ---\n`, finalOutput, `\n-----------------------------------\n`);

    return {
        testOutput: finalOutput,
        passed: passed,
        logs: [...state.logs, `Tests ${passed ? 'PASSED' : 'FAILED'} (Iteration ${iteration}) - Detected: ${detectedTypes.join(', ')}`]
    };
}

/**
 * Analyzes test output using LLM to identify bugs.
 */
async function analyzeFailure(state) {
    const { testOutput } = state;
    const model = new ChatOpenAI({
        modelName: "gpt-4-turbo", // Or configured model
        temperature: 0
    });

    // Prompt to strictly follow the output format
    const prompt = `
    Analyze the following test output and identify the failures.
    You must output a JSON object with a "bugs" array.
    Each bug object must have: "file", "type", "line", "description".
    
    Allowed Bug Types: LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION.
    
    STRICT OUTPUT FORMAT for description:
    "LINTING error in src/utils.py line 15 Fix: remove the import statement"
    "SYNTAX error in src/validator.py line 8 Fix: add the colon at the correct position"
    "LINTING error in src/App.js line 10 Fix: 'React' is defined but never used"
    
    Test Output:
    ${testOutput}
    `;

    const response = await model.invoke([new HumanMessage(prompt)]);

    // Parse JSON from LLM response (robust parsing needed)
    let bugs = [];
    try {
        const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        bugs = JSON.parse(content).bugs || [];
    } catch (e) {
        console.error("Failed to parse LLM analysis", e);
    }

    return { bugs, logs: [...state.logs, `Identified ${bugs.length} bugs`] };
}

/**
 * Generates and applies fixes.
 */
/**
 * Generates and applies fixes.
 */
async function applyFixes(state) {
    const { bugs, localPath, branchName } = state;
    const model = new ChatOpenAI({ modelName: "gpt-4-turbo", temperature: 0 });
    let currentIterationFixes = [];

    for (const bug of bugs) {
        const filePath = path.join(localPath, bug.file);
        if (!fs.existsSync(filePath)) continue;

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const prompt = `Fix the bug: ${bug.description}\nCode:\n${fileContent}\nReturn ONLY the full corrected file content.`;

        const response = await model.invoke([new HumanMessage(prompt)]);
        const fixedContent = response.content.replace(/```[\w]*\n/g, '').replace(/```/g, '').trim();

        fs.writeFileSync(filePath, fixedContent);

        const repoGit = simpleGit(localPath);
        await repoGit.add(bug.file);
        await repoGit.commit(`[AI-AGENT] Fixed ${bug.type} in ${bug.file}`);

        let pushedSuccessfully = false;
        try {
            console.log(`Pushing branch ${branchName} to remote...`);
            await repoGit.push('origin', branchName, { '--force': null, '--set-upstream': null });
            pushedSuccessfully = true;
        } catch (pushError) {
            console.error(`Push failed:`, pushError);
        }

        currentIterationFixes.push({
            file: bug.file,
            type: bug.type,
            line: bug.line,
            commitMessage: `[AI-AGENT] Fixed ${bug.type} in ${bug.file}`,
            status: 'Fixed',
            pushed: pushedSuccessfully
        });
    }

    return {
        fixesApplied: [...(state.fixesApplied || []), ...currentIterationFixes], // Return FULL history
        iteration: state.iteration + 1,
        logs: [...state.logs, `Applied ${currentIterationFixes.length} fixes`]
    };
}

/**
 * Main Workflow Definition
 */
const workflow = new StateGraph({
    channels: {
        repoUrl: {
            value: (x, y) => y,
            default: () => ""
        },
        teamName: {
            value: (x, y) => y,
            default: () => ""
        },
        leaderName: {
            value: (x, y) => y,
            default: () => ""
        },
        localPath: {
            value: (x, y) => y,
            default: () => ""
        },
        branchName: {
            value: (x, y) => y,
            default: () => ""
        },
        iteration: {
            value: (x, y) => (y !== undefined ? y : x),
            default: () => 1
        },
        testOutput: {
            value: (x, y) => y,
            default: () => ""
        },
        passed: {
            value: (x, y) => y,
            default: () => false
        },
        bugs: {
            value: (x, y) => y,
            default: () => []
        },
        fixesApplied: {
            value: (x, y) => y, // Replace strategy (Node returns full state)
            default: () => []
        },
        logs: {
            value: (x, y) => y, // Replace strategy (Node returns full state)
            default: () => []
        },
        status: {
            value: (x, y) => y,
            default: () => "PENDING"
        },
        error: {
            value: (x, y) => y,
            default: () => null
        }
    }
});

// Add Nodes
workflow.addNode("setup", cloneAndSetup);
workflow.addNode("test", runTests);
workflow.addNode("analyze", analyzeFailure);
workflow.addNode("fix", applyFixes);

// Add Edges
workflow.setEntryPoint("setup");

workflow.addEdge("setup", "test");

workflow.addConditionalEdges(
    "test",
    (state) => {
        if (state.passed) return "end";
        if (state.iteration > 5) return "end"; // Max retries
        return "analyze";
    },
    {
        end: END,
        analyze: "analyze"
    }
);

workflow.addEdge("analyze", "fix");
workflow.addEdge("fix", "test");

const app = workflow.compile();

async function runAgent(inputs) {
    const config = { recursionLimit: 50 };
    const result = await app.invoke({
        repoUrl: inputs.repoUrl,
        teamName: inputs.teamName,
        leaderName: inputs.leaderName,
        iteration: 1,
        fixesApplied: [],
        logs: []
    }, config);

    // If passed is true, there are 0 CURRENT failures
    const finalFailures = result.passed ? 0 : (result.bugs ? result.bugs.length : 0);

    const output = {
        repoUrl: result.repoUrl,
        teamName: result.teamName,
        leaderName: result.leaderName,
        branchName: result.branchName,
        totalFailures: finalFailures, // Shows 0 if the agent fixed everything
        totalFixes: result.fixesApplied ? result.fixesApplied.length : 0,
        status: result.passed ? 'PASSED' : 'FAILED',
        logs: result.logs,
        fixes: result.fixesApplied
    };

    const resultsPath = path.resolve(__dirname, '../../results.json');
    try {
        fs.writeFileSync(resultsPath, JSON.stringify(output, null, 2));
        console.log(`Results saved to ${resultsPath}`);
    } catch (e) {
        console.error("Failed to save results.json", e);
    }

    return output;
}

module.exports = { runAgent };
