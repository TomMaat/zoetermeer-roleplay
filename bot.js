const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Controleer of environment variables bestaan
if (!TOKEN || !CLIENT_ID) {
    console.error('❌ DISCORD_TOKEN of CLIENT_ID is niet ingesteld in .env of Render environment variables!');
    process.exit(1);
}

// Slash command registreren
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

// Commands registreren bij Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Bot is online als ${client.user.tag}`);
    console.log(`✅ Bot ID: ${client.user.id}`);
    console.log(`✅ Aantal servers: ${client.guilds.cache.size}`);

    try {
        console.log('🔄 Slash commands worden geregistreerd...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Slash commands succesvol geregistreerd!');
    } catch (error) {
        console.error('❌ Fout bij registreren commands:', error);
    }
});

// Slash command afhandelen
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

    // Zoek de "Staff Team" rol (pas aan naar jouw rolnaam)
    const staffTeamRole = interaction.guild.roles.cache.find(r => r.name === 'Staff Team');
    if (!staffTeamRole) {
        return interaction.editReply('❌ De rol **"Staff Team"** is niet gevonden. Maak deze eerst aan in de server instellingen.');
    }

    try {
        // Rol toevoegen aan gebruiker
        await member.roles.add(role);
        console.log(`✅ Rol ${role.name} toegevoegd aan ${user.tag}`);

        // Staff team rol toevoegen (als die nog niet heeft)
        if (!member.roles.cache.has(staffTeamRole.id)) {
            await member.roles.add(staffTeamRole);
            console.log(`✅ Staff Team rol toegevoegd aan ${user.tag}`);
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

// Error handling voor betere debugging
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});

// Login
client.login(TOKEN);
