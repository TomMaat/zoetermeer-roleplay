const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

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

    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('✅ Slash commands geregistreerd!');
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

    const member = interaction.guild.members.cache.get(user.id);
    const doorMember = interaction.guild.members.cache.get(doorUser.id);

    if (!member) {
        return interaction.editReply('❌ Deze gebruiker is niet gevonden in de server.');
    }

    // Check of de bot de rol kan toevoegen
    const botMember = interaction.guild.members.cache.get(client.user.id);
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply('❌ Ik heb geen Manage Roles permissie!');
    }

    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply('❌ Ik kan deze rol niet toevoegen omdat hij hoger is dan mijn hoogste rol.');
    }

    // Extra staff team rol (aanpassen naar jouw rol)
    const staffTeamRole = interaction.guild.roles.cache.find(r => r.name === 'Staff Team');
    if (!staffTeamRole) {
        return interaction.editReply('❌ De rol "Staff Team" is niet gevonden. Maak deze eerst aan!');
    }

    try {
        // Rol toevoegen aan gebruiker
        await member.roles.add(role);
        console.log(`✅ Rol ${role.name} toegevoegd aan ${user.tag}`);

        // Staff team rol toevoegen
        if (!member.roles.cache.has(staffTeamRole.id)) {
            await member.roles.add(staffTeamRole);
            console.log(`✅ Staff Team rol toegevoegd aan ${user.tag}`);
        }

        // Embed maken voor het kanaal
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Aangenomen!')
            .setDescription(`**${user.username}** is aangenomen!`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Gebruiker', value: `${user}`, inline: true },
                { name: '🎯 Rol', value: `${role}`, inline: true },
                { name: '👔 Aangenomen door', value: `${doorUser}`, inline: true },
                { name: '📝 Extra informatie', value: extra, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Aangenomen door ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        // Stuur naar het huidige kanaal
        await interaction.editReply({ embeds: [embed] });

        // Optioneel: Log kanaal
        const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'aangenomen-logs');
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }

    } catch (error) {
        console.error('❌ Fout:', error);
        await interaction.editReply('❌ Er is een fout opgetreden. Controleer of de rollen correct zijn ingesteld.');
    }
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled rejection:', error);
});

client.login(TOKEN);
