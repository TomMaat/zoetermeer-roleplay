const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const express = require('express');
require('dotenv').config();

// ============================================
// DISCORD BOT SETUP
// ============================================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const STAFF_TEAM_ROLE_ID = process.env.STAFF_TEAM_ROLE_ID;

// HARDCODED CLIENT_ID (gebruik de juiste bot ID)
const CLIENT_ID = '1546575102945001592'; // ← Dit is jouw bot ID

console.log(`📋 Gebruikte CLIENT_ID: ${CLIENT_ID}`);

// Controleer of token bestaat
if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN is niet ingesteld in environment variables!');
    process.exit(1);
}

// ============================================
// SLASH COMMAND DEFINITIE
// ============================================
const commands = [
    new SlashCommandBuilder()
        .setName('aangenomen')
        .setDescription('Neem een gebruiker aan en geef een rol')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('De gebruiker die wordt aangenomen')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('rol')
                .setDescription('De rol die de gebruiker krijgt')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('door')
                .setDescription('Wie heeft de gebruiker aangenomen?')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('extra')
                .setDescription('Extra informatie (optioneel)')
                .setRequired(false))
];

// ============================================
// COMMANDS REGISTREREN (direct uitvoeren)
// ============================================
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    try {
        console.log('🔄 Slash commands worden geregistreerd...');
        console.log(`🔄 Gebruik Application ID: ${CLIENT_ID}`);
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Slash commands succesvol geregistreerd!');
        console.log('📋 Commands: /aangenomen');
        return true;
    } catch (error) {
        console.error('❌ Fout bij registreren commands:');
        console.error(`❌ Status: ${error.status}`);
        console.error(`❌ Code: ${error.code}`);
        console.error(`❌ Message: ${error.message}`);
        
        if (error.code === 10002) {
            console.error('❌ Oplossing: De CLIENT_ID is incorrect!');
            console.error(`❌ Gebruik deze ID: ${client.user ? client.user.id : 'onbekend'}`);
        }
        return false;
    }
}

// ============================================
// BOT STARTUP
// ============================================
client.once('ready', async () => {
    console.log(`✅ Bot is online als ${client.user.tag}`);
    console.log(`✅ Bot ID: ${client.user.id}`);
    console.log(`✅ Aantal servers: ${client.guilds.cache.size}`);
    
    if (STAFF_TEAM_ROLE_ID) {
        console.log(`✅ Staff Team Role ID geladen: ${STAFF_TEAM_ROLE_ID}`);
    } else {
        console.warn('⚠️ Geen Staff Team Role ID ingesteld in environment variables');
    }

    // Registreer commands
    await registerCommands();
});

// ============================================
// SLASH COMMAND AFHANDELING
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'aangenomen') return;

    await interaction.deferReply({ ephemeral: false });

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('rol');
    const doorUser = interaction.options.getUser('door');
    const extra = interaction.options.getString('extra') || 'Geen extra informatie';

    // Haal member op van de gebruiker
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const doorMember = await interaction.guild.members.fetch(doorUser.id).catch(() => null);

    if (!member) {
        return interaction.editReply('❌ Deze gebruiker is niet gevonden in de server.');
    }

    if (!doorMember) {
        return interaction.editReply('❌ De gebruiker die aangenomen heeft, is niet gevonden.');
    }

    // Controleer of de bot permissies heeft
    const botMember = await interaction.guild.members.fetch(client.user.id);
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply('❌ Ik heb geen **Manage Roles** permissie! Geef mij deze permissie in de server instellingen.');
    }

    // Controleer of de rol lager is dan de hoogste rol van de bot
    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply(`❌ Ik kan de rol **${role.name}** niet toevoegen omdat deze hoger of gelijk is aan mijn hoogste rol. Zet mijn rol hoger in de server.`);
    }

    // Staff Team rol via environment variable
    let staffTeamRole = null;
    if (STAFF_TEAM_ROLE_ID) {
        staffTeamRole = interaction.guild.roles.cache.get(STAFF_TEAM_ROLE_ID);
        if (!staffTeamRole) {
            return interaction.editReply(`❌ De Staff Team rol met ID \`${STAFF_TEAM_ROLE_ID}\` is niet gevonden. Controleer of het ID klopt.`);
        }
    } else {
        // Fallback: zoek op naam als geen ID is ingesteld
        staffTeamRole = interaction.guild.roles.cache.find(r => r.name === 'Staff Team');
        if (!staffTeamRole) {
            console.warn('⚠️ Staff Team rol niet gevonden op naam, en geen ID ingesteld in environment.');
        }
    }

    try {
        // Rol toevoegen aan gebruiker
        await member.roles.add(role);
        console.log(`✅ Rol ${role.name} toegevoegd aan ${user.tag}`);

        // Staff team rol toevoegen (als die bestaat en gebruiker heeft hem nog niet)
        let staffRoleAdded = false;
        if (staffTeamRole && !member.roles.cache.has(staffTeamRole.id)) {
            await member.roles.add(staffTeamRole);
            staffRoleAdded = true;
            console.log(`✅ Staff Team rol toegevoegd aan ${user.tag}`);
        } else if (staffTeamRole && member.roles.cache.has(staffTeamRole.id)) {
            console.log(`ℹ️ ${user.tag} heeft de Staff Team rol al.`);
        }

        // Embed maken voor mooie weergave
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Aangenomen!')
            .setDescription(`**${user.username}** is succesvol aangenomen!`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Gebruiker', value: `${user}`, inline: true },
                { name: '🎯 Toegekende rol', value: `${role}`, inline: true },
                { name: '👔 Aangenomen door', value: `${doorUser}`, inline: true },
                { name: '📝 Extra informatie', value: extra, inline: false }
            )
            .setTimestamp()
            .setFooter({ 
                text: `Aangenomen door ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        // Als staff team rol is toegevoegd, voeg toe aan embed
        if (staffRoleAdded && staffTeamRole) {
            embed.addFields(
                { name: '🎖️ Extra rol', value: `**${staffTeamRole.name}** toegevoegd`, inline: false }
            );
        }

        // Stuur embed naar het kanaal waar command gebruikt is
        await interaction.editReply({ embeds: [embed] });

        // Optioneel: Stuur ook naar een specifiek log kanaal
        const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'aangenomen-logs');
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
            console.log(`📨 Log verstuurd naar #${logChannel.name}`);
        }

    } catch (error) {
        console.error('❌ Fout bij toevoegen rollen:', error);
        await interaction.editReply('❌ Er is een fout opgetreden. Controleer of de rollen correct zijn ingesteld en of ik voldoende permissies heb.');
    }
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});

// ============================================
// HEALTH CHECK SERVER (voor Render)
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'offline',
        guilds: client.guilds ? client.guilds.cache.size : 0,
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`✅ Health check server draait op poort ${PORT}`);
});

// ============================================
// BOT LOGIN
// ============================================
client.login(TOKEN);
