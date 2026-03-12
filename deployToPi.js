const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

async function deploy() {
    try {
        console.log('Connecting to Raspberry Pi (192.168.1.92:22)...');
        await ssh.connect({
            host: '192.168.1.92',
            port: 22,
            username: 'elvisds',
            password: 'S3cUrItY@1420K'
        });
        
        console.log('Connected! Creating destination directory...');
        const remoteDir = '/home/elvisds/BOT_HackLabH';
        await ssh.execCommand(`mkdir -p ${remoteDir}`);
        
        console.log('Uploading bot files (excluding heavy/temp directories)...');
        
        const failed = [];
        const successful = [];
        
        await ssh.putDirectory('C:/BOT_HackLabH', remoteDir, {
          recursive: true,
          concurrency: 5, // Lower concurrency for Pi SD card written limits
          tick: function(localPath, remotePath, error) {
            if (error) {
              failed.push(localPath);
            } else {
              successful.push(localPath);
            }
          },
          validate: function(itemPath) {
            const baseName = path.basename(itemPath);
            // Skip node_modules (will npm install on pi)
            if (baseName === 'node_modules') return false;
            // Skip git repo
            if (baseName === '.git') return false;
            // Skip gemini agent folders
            if (baseName === '.gemini' || baseName === '.agents' || baseName === 'temp-skills') return false;
            // Skip Mac DS_Store if exists
            if (baseName === '.DS_Store') return false;
            
            return true;
          }
        });
        
        console.log(`UPLOAD COMPLETE: ${successful.length} files transferred successfully. Failed: ${failed.length}.`);
        if (failed.length > 0) {
            console.log('Failed files:', failed.slice(0, 10)); // print some
        }
        
        const password = 'S3cUrItY@1420K';

        console.log('Installing dependencies on Raspberry Pi...');
        console.log(await ssh.execCommand('npm install', { cwd: remoteDir, stream: 'stdout' }));
        
        console.log('Ensuring Playwright cache directory and permissions...');
        await ssh.execCommand(`echo "${password}" | sudo -S mkdir -p /home/elvisds/.cache/ms-playwright`);
        await ssh.execCommand(`echo "${password}" | sudo -S chown -R elvisds:elvisds /home/elvisds/.cache`);

        console.log('Installing Playwright Chromium...');
        // Try to install the browser
        let playwrightResult = await ssh.execCommand('npx playwright install chromium', { cwd: remoteDir });
        console.log(playwrightResult.stdout);
        
        console.log('Installing system dependencies with sudo...');
        // Use sudo -S to provide password from stdin
        const sudoPlaywrightCommand = `echo "${password}" | sudo -S npx playwright install-deps chromium`;
        const sudoResult = await ssh.execCommand(sudoPlaywrightCommand, { cwd: remoteDir });
        console.log(sudoResult.stdout);
        if (sudoResult.stderr) console.log('Sudo status/output:', sudoResult.stderr);

        console.log('Ensuring process supervisor (pm2) is installed...');
        await ssh.execCommand(`echo "${password}" | sudo -S npm install -g pm2`, { cwd: remoteDir });

        console.log('Restarting Bot on port 9444...');
        // Try to restart if exists, start if not
        const restartResult = await ssh.execCommand('PORT=9444 pm2 restart HackLabBot || PORT=9444 pm2 start index.js --name "HackLabBot"', { cwd: remoteDir });
        console.log(restartResult.stdout);
        if (restartResult.stderr) console.log(restartResult.stderr);
        
        console.log('Saving PM2 to startup...');
        await ssh.execCommand('pm2 save', { cwd: remoteDir });

        console.log('DEPOLOYMENT FINISHED SUCCESSFULLY!');
        ssh.dispose();
    } catch (err) {
        console.error('DEPLOYMENT FAILED:', err);
        ssh.dispose();
    }
}

deploy();
