const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

// ═══════════════════════════════════════════════════
// HackLabH Bot — Docker Deployment to Raspberry Pi
// ═══════════════════════════════════════════════════

const PI_HOST = process.env.PI_HOST || '192.168.1.92';
const PI_PORT = parseInt(process.env.PI_SSH_PORT || '22', 10);
const PI_USER = process.env.PI_USER || 'elvisds';
const REMOTE_DIR = '/home/elvisds/BOT_HackLabH';

async function deploy() {
    const startTime = Date.now();

    try {
        // ─── Conexión SSH ───
        console.log(`\n🔌 Conectando a Raspberry Pi (${PI_HOST}:${PI_PORT})...`);
        await ssh.connect({
            host: PI_HOST,
            port: PI_PORT,
            username: PI_USER,
            // Usa SSH key si existe, si no pide password
            privateKeyPath: process.env.PI_KEY_PATH || undefined,
            password: process.env.PI_PASSWORD || undefined,
            tryKeyboard: true,
        });
        console.log('✅ Conectado.\n');

        // ─── Verificar Docker ───
        console.log('🐳 Verificando Docker...');
        const dockerCheck = await ssh.execCommand('docker --version');
        if (dockerCheck.code !== 0) {
            console.log('❌ Docker no está instalado. Instalando...');
            await runRemote('curl -fsSL https://get.docker.com -o /tmp/get-docker.sh');
            await runRemote('sudo sh /tmp/get-docker.sh');
            await runRemote(`sudo usermod -aG docker ${PI_USER}`);
            await runRemote('sudo systemctl enable docker && sudo systemctl start docker');
            console.log('✅ Docker instalado y habilitado.\n');
        } else {
            console.log(`   ${dockerCheck.stdout.trim()}`);
        }

        // Verificar Docker Compose
        const composeCheck = await ssh.execCommand('docker compose version');
        if (composeCheck.code !== 0) {
            console.log('📦 Instalando Docker Compose plugin...');
            await runRemote('sudo apt-get update && sudo apt-get install -y docker-compose-plugin');
        } else {
            console.log(`   ${composeCheck.stdout.trim()}`);
        }

        // ─── Crear directorio remoto ───
        console.log(`\n📁 Preparando directorio ${REMOTE_DIR}...`);
        await ssh.execCommand(`mkdir -p ${REMOTE_DIR}`);

        // ─── Detener PM2 si está corriendo el bot ───
        console.log('🔄 Deteniendo PM2 si existe...');
        await ssh.execCommand('pm2 stop HackLabBot 2>/dev/null; pm2 delete HackLabBot 2>/dev/null; true');

        // ─── Sincronizar archivos ───
        console.log('\n📤 Subiendo archivos del proyecto...');
        const failed = [];
        const successful = [];

        await ssh.putDirectory(path.resolve(__dirname, '..'), REMOTE_DIR, {
            recursive: true,
            concurrency: 3,
            tick: function(localPath, remotePath, error) {
                if (error) {
                    failed.push(path.basename(localPath));
                } else {
                    successful.push(path.basename(localPath));
                }
            },
            validate: function(itemPath) {
                const baseName = path.basename(itemPath);
                const skip = [
                    'node_modules', '.git', '.gemini', '.agents', '.kiro',
                    '.continue', '.vscode', '.github', 'temp-skills',
                    'pixel-agents', 'bot_data_backup.sqlite',
                    'continue.continue-0.0.412-win32-x64.vsix'
                ];
                if (skip.includes(baseName)) return false;
                if (baseName === '.DS_Store') return false;
                return true;
            }
        });

        console.log(`   ✅ ${successful.length} archivos transferidos.`);
        if (failed.length > 0) {
            console.log(`   ⚠️ ${failed.length} fallos: ${failed.slice(0, 5).join(', ')}`);
        }

        // ─── Convertir line endings (Windows → Unix) ───
        console.log('\n🔧 Corrigiendo line endings...');
        await runRemote(`cd ${REMOTE_DIR} && sed -i 's/\\r$//' entrypoint.pi.sh Caddyfile`);

        // ─── Docker Compose Build & Up ───
        console.log('\n🐳 Construyendo y levantando contenedores...');
        console.log('   (Esto puede tardar varios minutos en la primera vez)\n');

        const buildResult = await ssh.execCommand(
            `cd ${REMOTE_DIR} && docker compose -f docker-compose.pi.yml up -d --build --remove-orphans`,
            { stream: 'both' }
        );
        console.log(buildResult.stdout);
        if (buildResult.stderr) {
            // Docker Compose imprime progreso en stderr
            const lines = buildResult.stderr.split('\n').filter(l => !l.includes('pull') || l.includes('error'));
            if (lines.length) console.log(lines.join('\n'));
        }

        // ─── Verificar estado ───
        console.log('\n📊 Estado de los contenedores:');
        const psResult = await ssh.execCommand(`cd ${REMOTE_DIR} && docker compose -f docker-compose.pi.yml ps`);
        console.log(psResult.stdout);

        // ─── Mostrar últimos logs del bot ───
        console.log('\n📋 Últimos logs del bot:');
        const logsResult = await ssh.execCommand(
            `cd ${REMOTE_DIR} && docker compose -f docker-compose.pi.yml logs --tail=15 hacklabh-bot`
        );
        console.log(logsResult.stdout || logsResult.stderr);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n🎉 DESPLIEGUE COMPLETADO EN ${elapsed}s`);
        console.log(`\n   Bot:       http://${PI_HOST}:9445`);
        console.log(`   Lavalink:  http://${PI_HOST}:2333`);
        console.log(`   Web HTTPS: https://panel.hacklabh.xyz (si DNS apunta a la Pi)\n`);

    } catch (err) {
        console.error('\n❌ DEPLOYMENT FAILED:', err.message);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

async function runRemote(cmd) {
    const result = await ssh.execCommand(cmd, { cwd: REMOTE_DIR });
    if (result.stdout) console.log(`   ${result.stdout}`);
    if (result.code !== 0 && result.stderr) {
        console.log(`   ⚠️ ${result.stderr}`);
    }
    return result;
}

deploy();
