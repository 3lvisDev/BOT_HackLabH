require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const { startDashboard } = require('./dashboard');
const { getGuildConfig, setGuildConfig } = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Admins ya no se cargan automáticamente desde .env aquí
// Se pedirán a través de la Web o comandos.

/**
 * Función auxiliar para aplicar separadores de forma inteligente a un miembro.
 * Detecta roles decorativos (separadores) y los añade/quita según los sub-roles del miembro.
 */
async function applySmartRoles(member) {
    if (member.user.bot) return;
    
    try {
        const guild = member.guild;
        // Obtenemos los roles ordenados
        const allRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
        
        const separatorMap = new Map();
        const activeSeparators = new Set();
        let currentSeparatorId = null;

        // 1. Mapear la estructura actual del servidor
        for (const [roleId, role] of allRoles) {
            if (role.name === '@everyone' || role.managed) continue;

            if (role.name.includes("━━") || role.name.includes("══") || role.name.includes("---")) {
                currentSeparatorId = role.id;
                activeSeparators.add(role.id);
            } else if (currentSeparatorId) {
                separatorMap.set(role.id, currentSeparatorId);
            }
        }

        // 2. Calcular qué separadores NECESITA el miembro ahora mismo
        const currentRoleIds = Array.from(member.roles.cache.keys());
        const desiredSeparators = new Set();
        
        for (const roleId of currentRoleIds) {
            if (separatorMap.has(roleId)) {
                desiredSeparators.add(separatorMap.get(roleId));
            }
        }

        // 3. Filtrar de la lista actual todos los separadores que YA NO necesita
        // y asegurar que incluya los que SÍ necesita
        let finalRoleIds = currentRoleIds.filter(id => !activeSeparators.has(id));
        for (const sepId of desiredSeparators) {
            finalRoleIds.push(sepId);
        }

        // 4. Comparar y aplicar cambios solo si es necesario
        const sortedCurrent = [...currentRoleIds].filter(id => id !== guild.id).sort().join(',');
        const sortedFinal = [...finalRoleIds].filter(id => id !== guild.id).sort().join(',');

        if (sortedCurrent !== sortedFinal) {
            console.log(`[SmartRoles] Actualizando separadores para ${member.user.tag}`);
            await member.roles.set(finalRoleIds);
        }
    } catch (err) {
        console.error(`Error en applySmartRoles para ${member.user.tag}:`, err.message);
    }
}

// Función centralizada para configurar la comunidad
async function setupCommunity(guild, logger = console.log, adminUserIds = [], modUserIds = []) {
  try {
    const botMember = await guild.members.fetch(client.user.id);
    
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
        throw new Error("El bot no tiene permisos de Administrador en este servidor.");
    }

    logger("⚙️ Iniciando configuración de la comunidad de programación...");

    logger("⚙️ Evaluando estructura actual de roles...");
    
    // Traer todos los roles ordenados por posición
    const allRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
    
    // Encontrar roles con permisos de Administrador
    const adminRoles = allRoles.filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
    
    // Buscar un rol base: 
    // 1. Intentar por nombres comunes primero
    const commonBaseNames = ['usuario', 'miembro', 'member', 'programador', 'dev', 'verificado'];
    let baseRole = allRoles.find(role => {
        if (role.name === '@everyone' || role.managed) return false;
        const nameMatch = commonBaseNames.some(n => role.name.toLowerCase().includes(n));
        return nameMatch && !role.permissions.has(PermissionsBitField.Flags.Administrator);
    });

    // 2. Si no hay por nombre, buscar el que tenga permisos básicos de ver/hablar
    if (!baseRole) {
        baseRole = allRoles.find(role => {
            if (role.name === '@everyone' || role.managed) return false;
            if (role.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
            
            const hasBasicPerms = role.permissions.has([
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
            ]);
            return hasBasicPerms;
        });
    }

    if (!baseRole) {
        logger("⚙️ No se detectó un rol base lógico. Creando rol 'Usuario Básico'...");
        baseRole = await guild.roles.create({
            name: 'Usuario Básico',
            color: '#a8b2c1',
            permissions: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ],
            reason: 'Rol base creado por setup inteligente',
        });
    } else {
        logger(`⚙️ Rol base detectado: '${baseRole.name}' (ID: ${baseRole.id})`);
    }

    // Buscar o usar un rol de Admin que ya exista
    let explicitAdminRole = allRoles.find(role => 
        role.name.toLowerCase().includes('admin') && 
        role.permissions.has(PermissionsBitField.Flags.Administrator)
    );

    if (!explicitAdminRole) {
      logger("⚙️ No se encontró un rol con nombre 'Admin'. Creando uno oficial...");
      explicitAdminRole = await guild.roles.create({
        name: 'Admin',
        color: '#E74C3C',
        permissions: [PermissionsBitField.Flags.Administrator],
        reason: 'Rol de administrador creado por setup automático',
      });
    } else {
        logger(`⚙️ Rol Administrativo detectado y usado: '${explicitAdminRole.name}'`);
    }

    // Buscar o usar un rol de Moderador que ya exista
    let explicitModRole = allRoles.find(role => 
        role.name.toLowerCase().includes('mod') && 
        !role.permissions.has(PermissionsBitField.Flags.Administrator)
    );

    if (!explicitModRole) {
      logger("⚙️ No se encontró un rol de 'Moderador'. Creando uno...");
      explicitModRole = await guild.roles.create({
        name: 'Moderador',
        color: '#F1C40F',
        permissions: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.ModerateMembers,
            PermissionsBitField.Flags.ManageNicknames
        ],
        reason: 'Rol de moderador creado por setup automático',
      });
    } else {
        logger(`⚙️ Rol de Moderación detectado y usado: '${explicitModRole.name}'`);
    }

    // Guardar en la base de datos la configuración
    await setGuildConfig(guild.id, baseRole.id);

    // 1.5 Lógica de Roles Separadores (Categorías Visuales)
    logger("⚙️ Mapeando roles separadores (Ej. '━━ 🚻 Géneros ━━')...");
    const separatorMap = new Map(); // Mapa de: subRoleId => separatorRoleId
    const activeSeparators = new Set(); // Conjunto de todos los IDs de roles separadores detectados
    
    let currentSeparatorId = null;
    
    // allRoles ya está ordenado por posición de mayor a menor (top to bottom)
    for (const [roleId, role] of allRoles) {
        // Detectar si es un separador heurísticamente (contiene ━━ o --- etc)
        // Ignoramos el everyone y los roles gestionados (bots)
        if (role.name === '@everyone' || role.managed) continue;

        if (role.name.includes("━━") || role.name.includes("══") || role.name.includes("---")) {
            currentSeparatorId = role.id;
            activeSeparators.add(role.id);
            // console.log(`Separador detectado: ${role.name}`);
        } else if (currentSeparatorId) {
            // Este es un rol normal que está por debajo del último separador encontrado
            // Lo asociamos a ese separador
            separatorMap.set(role.id, currentSeparatorId);
        }
    }

    // 2. Asignar Roles de Admin explícitos
    logger("⚙️ Aplicando permisos de administrador y moderador...");
    // Convert array of string to actual Set for fast lookup
    const designatedAdminIds = new Set(adminUserIds);
    const designatedModIds = new Set(modUserIds);
    
    for (const userId of designatedAdminIds) {
      try {
        const member = await guild.members.fetch(userId);
        if (member) {
          await member.roles.add(explicitAdminRole);
        }
      } catch (err) {}
    }

    for (const userId of designatedModIds) {
      try {
        // Un Moderador no puede ser también Admin para evitar conflictos lógicos visuales.
        if (designatedAdminIds.has(userId)) continue;
        const member = await guild.members.fetch(userId);
        if (member) {
          await member.roles.add(explicitModRole);
        }
      } catch (err) {}
    }

    // Pequeño delay helper
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // 3. Evaluar y migrar a todos los miembros
    logger("⚙️ Preparando la lista de miembros... (esto puede tardar en servidores grandes)");
    
    let allMembers;
    try {
        // Forzamos un fetch completo de miembros para asegurar que el cache no esté vacío
        allMembers = await guild.members.fetch({ force: true });
        logger(`⚙️ ¡Éxito! Se han obtenido ${allMembers.size} miembros.`);
    } catch(err) {
        logger(`⚠️ Error al obtener miembros con fetch: ${err.message}. Usando caché local...`);
        allMembers = guild.members.cache;
    }

    if (allMembers.size === 0) {
        logger("❌ Error crítico: No se encontró ningún miembro para procesar.");
        throw new Error("No se pudo obtener la lista de miembros del servidor.");
    }

    logger(`⚙️ Analizando y migrando a cada usuario...`);
    let processedCount = 0;
    let upToDateCount = 0;
    
    for (const [memberId, member] of allMembers) {
        if (member.user.bot) continue;
        processedCount++;

        const isDesignatedAdmin = designatedAdminIds.has(memberId);
        const isDesignatedMod = designatedModIds.has(memberId);
        const isServerOwner = memberId === guild.ownerId;
        const hasAdminRole = member.roles.cache.some(r => r.permissions.has(PermissionsBitField.Flags.Administrator));
        
        let rolesChanged = false;
        let originalRoleIds = Array.from(member.roles.cache.keys());

        // Array para calcular los roles finales
        // Empezamos con los roles que el usuario YA TIENE y filtramos los que no debe tener
        let targetRolesList = [];

        if (!isDesignatedAdmin && !isServerOwner && !hasAdminRole && !isDesignatedMod) {
            // USUARIO NORMAL: Aislamiento al rol base
            targetRolesList = originalRoleIds.filter(roleId => {
                const role = guild.roles.cache.get(roleId);
                if (!role) return false;
                if (roleId === guild.id) return false; // Ignorar everyone para el array final
                if (role.managed) return true; // Mantener roles de integración/bots
                if (roleId === baseRole.id) return true; // Mantener rol base obvio

                // Permitir mantener sub-roles "normales" que pertenecen a categorías
                // para que no pierdan la edad, ping, plataforma, etc.
                if (separatorMap.has(roleId)) return true;

                // Cualquier otro rol suelto que no es un sub-rol ni separador, lo quitamos por seguridad
                return false; 
            });
        } else {
           // ADMINS/MODS/OWNER: No les quitamos sus roles actuales pero les LIMPIAMOS el everyone si esta presente
           targetRolesList = originalRoleIds.filter(r => r !== guild.id);
        }

        // ASEGURAR RANGO USUARIO (Base Role) para TODOS (incluyendo Admins)
        if (!targetRolesList.includes(baseRole.id)) {
            targetRolesList.push(baseRole.id);
        }

        // ====== APLICAR LÓGICA DE SEPARADORES ======
        // 1. Limpiar todos los separadores que tiene actualmente de la lista objetivo
        targetRolesList = targetRolesList.filter(roleId => !activeSeparators.has(roleId));
        
        // 2. Por cada rol válido que le quedó al usuario, verificamos si pertenece a un separador.
        // Si es así, añadimos el separador a la lista (usando Set para no duplicar)
        const separatorsToAdd = new Set();
        for (const roleId of targetRolesList) {
            if (separatorMap.has(roleId)) {
                separatorsToAdd.add(separatorMap.get(roleId));
            }
        }

        // Agregar los separadores calculados a la lista final
        for (const sepId of separatorsToAdd) {
             targetRolesList.push(sepId);
        }

        // ====== ACTUALIZAR EN DISCORD SI HAY CAMBIOS ======
        // Obtenemos IDs limpios (sin @everyone) para comparar
        const currentClean = originalRoleIds.filter(id => id !== guild.id).sort();
        const targetClean = [...targetRolesList].sort();

        // Si la lista de roles "limpios" es diferente, o si el usuario no tiene roles y debería tener el base
        if (currentClean.join(',') !== targetClean.join(',')) {
            try {
                // Discord ignora @everyone en .set(), así que pasamos solo el targetClean
                await member.roles.set(targetClean);
                rolesChanged = true;
                console.log(`[Setup] roles.set aplicado a ${member.user.tag}: [${targetClean.join(', ')}]`);
            } catch(err) {
                console.log(`No se pudo actualizar roles de ${member.user.tag}: ${err.message}`);
            }
        }

        if (rolesChanged) {
            logger(`   ✅ Usuario actualizado: ${member.user.tag}`);
            await delay(1200); // 1.2 segundos por usuario migrado
        } else {
            upToDateCount++;
        }
    }
    
    logger(`⚙️ Resumen: ${processedCount} procesados, ${upToDateCount} ya estaban al día.`);

    // 4. Crear Canales Básicos de la Comunidad con Permisos Estrictos
    logger("⚙️ Configurando reglas de permisos globales (jerarquía de rangos)...");
    
    // Configurar permisos base (jerarquía estricta)
    const strictOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.RequestToSpeak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ], // BLOQUEO TOTAL para los que no tienen rol
      },
      {
        id: baseRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.UseEmbeddedActivities
        ],
      },
      {
        id: explicitModRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.Stream
        ],
      },
      {
        id: explicitAdminRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.Stream
        ],
      },
      {
        // El creador original siempre tiene max power, aunque Discord ya lo hace por defecto
        id: guild.ownerId,
        allow: [
            PermissionsBitField.Flags.Administrator,
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];

    logger("⚙️ Aplicando permisos estrictos a TODOS los canales existentes...");
    for (const [channelId, channel] of guild.channels.cache) {
        try {
            // Solo modificamos canales de texto, voz, y categorías normales
            const isText = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
            const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
            const isCategory = channel.type === ChannelType.GuildCategory;

            if (isText || isVoice || isCategory) {
               logger(`   - Procesando canal: ${channel.name} (${channel.type === ChannelType.GuildVoice ? 'Voz' : 'Texto/Cat'})`);
               await channel.permissionOverwrites.set(strictOverwrites);
               await delay(200); // Bajamos un poco el delay pero seguimos siendo cautos
            }
        } catch (err) {
            console.log(`No se pudo actualizar canal ${channel.name}: ${err.message}`);
        }
    }

    logger("⚙️ Creando categoría y canales nuevos base si no existen...");
    let category = guild.channels.cache.find(c => c.name === 'Comunidad Programación' && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: 'Comunidad Programación',
        type: ChannelType.GuildCategory,
        permissionOverwrites: strictOverwrites
      });
    }

    const channelNames = [
      { name: 'general', type: ChannelType.GuildText },
      { name: 'ayuda-codigo', type: ChannelType.GuildText },
      { name: 'proyectos-showcase', type: ChannelType.GuildText },
      { name: 'Sala de Voz 1', type: ChannelType.GuildVoice },
    ];

    for (const ch of channelNames) {
      const exists = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id);
      if (!exists) {
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: category.id
          // Al estar dentro de la categoría, heredarán los permisos categoryOverwrites automáticamente
        });
      }
    }

    logger("✅ ¡Configuración completada con éxito!");
    return true;

  } catch (error) {
    logger(`❌ Ocurrió un error: ${error.message}`);
    throw error;
  }
}

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  console.log('Esperando comando: !setup_community en canales o mediante el Dashboard Web.');
  
  // Iniciar el panel web cuando el bot esté listo
  startDashboard(client, setupCommunity);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!setup_community')) {
    // Solo el creador del servidor original puede ejecutarlo por comando de texto
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Solo el creador del servidor puede ejecutar este comando manualmente.");
    }

        const statusMessage = await message.reply("Iniciando...");

        // Función logger que edita el mensaje en Discord
        const discordLogger = async (msg) => {
          try {
            await statusMessage.edit(msg);
          } catch (e) {
            console.log(msg);
          }
        };

        try {
          // Pasamos al creador como el único administrador por defecto si usa el comando
          await setupCommunity(message.guild, discordLogger, [message.author.id], []);
    } catch (err) {
      // El error ya fue logueado
    }
  }
});

// Auto-rol al unirse usando DB
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    try {
        const config = await getGuildConfig(member.guild.id);
        let baseRole;

        if (config && config.base_role_id) {
            baseRole = member.guild.roles.cache.get(config.base_role_id);
        }

        // Fallback: Si no hay en DB o el rol ya no existe, buscar por nombre
        if (!baseRole) {
            const commonBaseNames = ['usuario', 'miembro', 'member', 'programador', 'dev', 'verificado'];
            baseRole = member.guild.roles.cache.find(role => 
                commonBaseNames.some(n => role.name.toLowerCase().includes(n)) &&
                !role.permissions.has(PermissionsBitField.Flags.Administrator)
            );
        }

        if (baseRole) {
            await member.roles.add(baseRole);
            console.log(`[AutoRole] Asignado '${baseRole.name}' a ${member.user.tag}`);
            
            // Aplicar separadores inmediatamente después del rol base
            setTimeout(() => applySmartRoles(member), 3000);
        } else {
            console.log(`[AutoRole] ⚠️ No se encontró un rol base para asignar a ${member.user.tag}`);
        }
    } catch(err) {
        console.error("[AutoRole] Error crítico:", err.message);
    }
});

// Listener para cambios de roles manuales o por otros bots
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Si la lista de roles ha cambiado, recalculamos separadores
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        // Log para ver cambios en consola del panel
        console.log(`[Update] Cambio de roles detectado en ${newMember.user.tag}. Recalculando separadores...`);
        // Pequeño debounce/espera para dejar que terminen otros procesos
        setTimeout(() => applySmartRoles(newMember), 4000);
    }
});

client.login(process.env.DISCORD_TOKEN);

module.exports = { client, setupCommunity };
