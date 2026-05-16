const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

async function deploy() {
    try {
        const piPassword = process.env.PI_PASSWORD;
        const sshKeys = [
            'C:/Users/thega/.ssh/id_notebook_pi',
            'C:/Users/thega/.ssh/id_rsa',
            'C:/Users/thega/.ssh/id_apexstation',
            'C:/Users/thega/.ssh/id_rsa_pleytv'
        ];
        
        let connected = false;
        for (const keyPath of sshKeys) {
            if (fs.existsSync(keyPath)) {
                try {
                    console.log(`Trying SSH key: ${keyPath}...`);
                    await ssh.connect({
                        host: '192.168.1.92',
                        port: 22,
                        username: 'elvisds',
                        privateKey: fs.readFileSync(keyPath, 'utf8')
                    });
                    connected = true;
                    console.log(`✅ Connected using ${keyPath}`);
                    break;
                } catch (e) {
                    console.log(`❌ Failed with ${keyPath}`);
                }
            }
        }

        if (!connected && piPassword) {
            console.log('Trying with PI_PASSWORD...');
            await ssh.connect({
                host: '192.168.1.92',
                port: 22,
                username: 'elvisds',
                password: piPassword
            });
            connected = true;
        }

        if (!connected) {
            throw new Error('All authentication methods failed.');
        }
        
        console.log('Connected! Creating destination directory...');
        const remoteDir = '/home/elvisds/BOT_HackLabH';
        await ssh.execCommand(`mkdir -p ${remoteDir}`);
        
        console.log('Uploading bot files (excluding heavy/temp directories)...');
        
        const failed = [];
        const successful = [];
        
        await ssh.putDirectory('./', remoteDir, {
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
            // Skip .env file to avoid overwriting production secrets (but allow templates like .env.release)
            if (baseName === '.env') return false;
            
            return true;
          }
        });
        
        console.log(`UPLOAD COMPLETE: ${successful.length} files transferred successfully. Failed: ${failed.length}.`);
        if (failed.length > 0) {
            console.log('Failed files:', failed.slice(0, 10)); // print some
        }
        
        const password = piPassword;

        console.log('Deploying via Docker Compose on Raspberry Pi...');
        
        // Only copy the release template to .env if .env doesn't exist on the Pi
        await ssh.execCommand('[ ! -f .env ] && cp .env.release .env || echo "Production .env already exists, skipping copy."', { cwd: remoteDir });

        console.log('Stopping existing containers...');
        await ssh.execCommand('docker-compose -f docker-compose.release.yml down', { cwd: remoteDir });

        console.log('Building and starting containers in detached mode...');
        const composeResult = await ssh.execCommand('docker-compose -f docker-compose.release.yml up -d --build', { 
            cwd: remoteDir,
            stream: 'stdout' 
        });
        
        console.log(composeResult.stdout);
        if (composeResult.stderr) {
            console.log('Compose Error/Status:', composeResult.stderr);
        }

        console.log('Cleaning up unused Docker images...');
        await ssh.execCommand('docker image prune -f', { cwd: remoteDir });

        console.log('DEPOLOYMENT FINISHED SUCCESSFULLY VIA DOCKER!');
        ssh.dispose();
    } catch (err) {
        console.error('DEPLOYMENT FAILED:', err);
        ssh.dispose();
    }
}

deploy();
