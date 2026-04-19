/**
 * Environment Variable Validator
 * Validates that all required environment variables are configured
 */

function validateEnvironmentVariables() {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`\n❌ Error: Variables de entorno faltantes: ${missing.join(', ')}\n`);
    console.error(`Asegúrate de pasar estas variables al contenedor:\n`);
    console.error(`Opción 1 - Usando docker run:`);
    console.error(`  docker run -e DISCORD_TOKEN=tu_token \\`);
    console.error(`            -e DISCORD_CLIENT_ID=tu_id \\`);
    console.error(`            -e DISCORD_CLIENT_SECRET=tu_secret \\`);
    console.error(`            -e PORT=3000 \\`);
    console.error(`            my-bot:latest\n`);
    console.error(`Opción 2 - Usando docker-compose.yml:`);
    console.error(`  environment:`);
    console.error(`    DISCORD_TOKEN: tu_token`);
    console.error(`    DISCORD_CLIENT_ID: tu_id`);
    console.error(`    DISCORD_CLIENT_SECRET: tu_secret`);
    console.error(`    PORT: 3000\n`);
    console.error(`Opción 3 - Usando archivo .env:`);
    console.error(`  Crea un archivo .env en la raíz del proyecto con:`);
    console.error(`    DISCORD_TOKEN=tu_token`);
    console.error(`    DISCORD_CLIENT_ID=tu_id`);
    console.error(`    DISCORD_CLIENT_SECRET=tu_secret`);
    console.error(`    PORT=3000\n`);
    process.exit(1);
  }
}

module.exports = { validateEnvironmentVariables };
