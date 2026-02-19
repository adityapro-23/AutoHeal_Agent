const { runTestsInSandbox } = require('../agents/docker');
const path = require('path');
const fs = require('fs');

/**
 * Node.js Engine
 * discover: Checks for package.json
 * run: Installs dependencies and runs tests
 */
const engineNode = {
    discover: (localPath) => {
        // Support root or frontend/ subdir
        if (fs.existsSync(path.join(localPath, 'package.json'))) return '.';
        if (fs.existsSync(path.join(localPath, 'frontend', 'package.json'))) return 'frontend';
        return null;
    },

    run: async (localPath, subDir) => {
        console.log(`[NodeEngine] Running in ${subDir} ...`);
        const imageName = 'node:18-alpine';

        let commands = ['npm install --no-audit --no-fund --prefer-offline']; // Optimized install
        const pkgPath = subDir === '.' ? path.join(localPath, 'package.json') : path.join(localPath, subDir, 'package.json');

        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts) {
                if (pkg.scripts.test) commands.push('npm test');
                else if (pkg.scripts.lint) commands.push('npm run lint');
                else if (pkg.scripts.build) commands.push('npm run build');
            }
        } catch (e) {
            console.error("[NodeEngine] Error reading package.json", e);
            return { success: false, output: `Error reading package.json: ${e.message}` };
        }

        let testCmd = commands.join(' && ');
        if (subDir !== '.') {
            testCmd = `cd ${subDir} && ${testCmd}`;
        }

        // Run in docker
        return await runTestsInSandbox(localPath, testCmd, imageName);
    }
};

module.exports = engineNode;
