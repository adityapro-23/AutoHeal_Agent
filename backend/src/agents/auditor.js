const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const git = simpleGit();

/**
 * Agent One: The Auditor
 * Tasks:
 * 1. Clone the repository
 * 2. Analyze structure (language detection)
 * 3. Generate initial issues_log.json
 * 4. Generate unique branch name
 */
async function runAuditor(repoUrl, teamName, leaderName) {
    console.log('[Auditor] Starting analysis...');

    const repoName = repoUrl.split('/').pop().replace('.git', '');
    const runId = uuidv4(); // Unique ID for this run
    const localPath = path.resolve(__dirname, '../../../temp', `${repoName}-${runId}`);

    // Unique Branch Name: TEAM_LEADER_AI_Fix_<timestamp>
    const timestamp = Date.now();
    const branchName = `${teamName.toUpperCase().replace(/ /g, '_')}_${leaderName.toUpperCase().replace(/ /g, '_')}_AI_Fix_${timestamp}`;

    try {
        // 1. Clone
        console.log(`[Auditor] Cloning ${repoUrl} to ${localPath}...`);

        let authUrl = repoUrl;
        const token = process.env.GITHUB_TOKEN;
        if (token && repoUrl.startsWith('https://')) {
            authUrl = repoUrl.replace('https://', `https://${token}@`);
        }

        await git.clone(authUrl, localPath);

        // 2. Setup Git User
        const repoGit = simpleGit(localPath);
        await repoGit.addConfig('user.name', 'VicRaptors AI Agent');
        await repoGit.addConfig('user.email', 'agent@vicraptors.com');

        // 3. Checkout Branch
        console.log(`[Auditor] Creating branch ${branchName}...`);
        await repoGit.checkoutLocalBranch(branchName);

        // 4. Initialize Issues Log
        const issuesLog = {
            runId,
            repoUrl,
            branchName,
            status: 'IN_PROGRESS',
            startTime: new Date().toISOString(),
            issues: [] // Will be populated by Orchestrator analyzing test output
        };

        const logPath = path.join(localPath, 'issues_log.json');
        fs.writeFileSync(logPath, JSON.stringify(issuesLog, null, 2));

        return {
            success: true,
            localPath,
            branchName,
            runId,
            repoGit: repoGit // Passed for commiting later
            // Note: We can't pass the git instance object easily via JSON if serialized,
            // but we can re-instantiate simpleGit(localPath) in other agents.
        };

    } catch (error) {
        console.error('[Auditor] Failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { runAuditor };
