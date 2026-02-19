const { runTestsInSandbox } = require('../agents/docker');
const path = require('path');
const fs = require('fs');

/**
 * Python Engine
 * discover: Checks for requirements.txt
 * run: Installs dependencies and runs flake8 + pytest
 */
const enginePython = {
    discover: (localPath) => {
        if (fs.existsSync(path.join(localPath, 'requirements.txt'))) return '.';
        // Could add support for backend/ subdir if needed, but sticking to root for now based on requirements
        return null;
    },

    run: async (localPath, subDir = '.') => {
        console.log(`[PythonEngine] Running in ${subDir} ...`);
        const imageName = 'python:3.9-alpine';

        // Standard Python CI command
        // 1. Install deps
        // 2. Run flake8 (Linting) - Stop on errors? No, we want to report them.
        // 3. Run pytest (Logic/Unit Tests)
        const testCmd = `pip install -r requirements.txt flake8 pytest && 
                         flake8 . --count --select=E9,F63,F7,F82,F401 --show-source --statistics && 
                         pytest`;

        // Run in docker
        return await runTestsInSandbox(localPath, testCmd, imageName);
    }
};

module.exports = enginePython;
