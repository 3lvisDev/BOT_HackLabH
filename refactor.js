const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// Replace the imports and MusicManager class
const regex1 = /const \{\s*joinVoiceChannel[\s\S]*?const musicManager = new MusicManager\(client\);/m;
if (!regex1.test(content)) {
    console.log("Could not find regex1");
} else {
    content = content.replace(regex1, "const MusicManager = require('./music/MusicManager');\nconst musicManager = new MusicManager(client);");
}

// Replace the messageCreate block
const regex2 = /\/\/ --- Comandos de Música ---[\s\S]*?if \(message\.content\.startsWith\('!stop'\)\) \{\s*await musicManager\.stop\(\);\s*message\.reply\([^)]*\);\s*\}/m;
if (!regex2.test(content)) {
    console.log("Could not find regex2");
} else {
    content = content.replace(regex2, "// --- Comandos de Música ---\n  const { handleMusicCommand } = require('./commands/music');\n  if (await handleMusicCommand(message, musicManager)) return;");
}

fs.writeFileSync('index.js', content, 'utf8');
console.log('Refactoring complete.');
