const Docker = require('dockerode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Initialize Docker client (assumes /var/run/docker.sock is mounted)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Runs tests in a sandbox container.
 * 
 * @param {string} localPath - Absolute path to the code on the host (where agent runs)
 * @param {string} testCmd - Command to run inside the container
 * @param {string} imageName - Docker image to use (e.g., 'node:18-alpine')
 * @returns {Promise<{success: boolean, output: string}>}
 */
async function runTestsInSandbox(localPath, testCmd, imageName) {
    let container;
    try {
        console.log(`[DockerSandbox] Preparing to run in ${imageName}...`);

        // 1. Create Container
        // We start it with a sleep command so it stays alive while we copy files and exec
        container = await docker.createContainer({
            Image: imageName,
            Cmd: ['/bin/sh', '-c', 'sleep 3600'],
            Tty: false,
            WorkingDir: '/app',
            HostConfig: {
                AutoRemove: false,
                // NetworkMode default (bridge) allows npm install to reach the internet
            }
        });

        await container.start();

        // 2. Copy Files
        // Use system 'tar' to stream files from localPath to the container
        // This avoids directory mounting issues (Docker-in-Docker volume mapping complexities)
        const tarStream = spawn('tar', ['-c', '-C', localPath, '.']).stdout;

        await container.putArchive(tarStream, {
            path: '/app'
        });

        // 3. Exec Command
        console.log(`[DockerSandbox] Executing: ${testCmd}`);
        const exec = await container.exec({
            Cmd: ['/bin/sh', '-c', testCmd],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start();

        // Capture output
        let output = '';
        await new Promise((resolve, reject) => {
            docker.modem.demuxStream(stream, {
                write: (chunk) => { output += chunk.toString(); }
            }, {
                write: (chunk) => { output += chunk.toString(); }
            });
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        // Get exit code
        const inspect = await exec.inspect();
        const success = inspect.ExitCode === 0;

        console.log(`[DockerSandbox] Finished. Success: ${success}`);

        return { success, output };

    } catch (error) {
        console.error('[DockerSandbox] Error:', error);
        return { success: false, output: `Sandbox execution failed: ${error.message}` };
    } finally {
        if (container) {
            try {
                await container.stop();
                await container.remove();
            } catch (cleanupError) {
                console.error('[DockerSandbox] Cleanup error:', cleanupError);
            }
        }
    }
}

module.exports = { runTestsInSandbox };
