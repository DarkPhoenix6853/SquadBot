const Discord = require('discord.js');
const client = new Discord.Client();
const Enmap = require("enmap");

const identityConfig = require("./config/ignore/identity.json");
const baseConfig = require("./config/baseConfig.json");
const permsConfig = require("./config/perms.json");

client.config = new Enmap();
client.config.set('identity', identityConfig);
client.config.set('baseConfig', baseConfig);
client.config.set('permsConfig', permsConfig);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async message => {

  //ignore bots
  if (message.author.bot) return;

  //get our prefix from config
  let prefix = await client.config.get('baseConfig').prefix;

  //a way to check current prefix
  if (await message.mentions.users.has(client.user.id) && message.content.toLowerCase().includes("prefix")) {
    message.reply(`My current prefix is ${prefix}`)
  }

  //commands only below here
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  let perms = {
    dev: false,
    admin: false,
    trusted: false
  };

  let member = await message.guild.member(message.author);
  let roles = await member.roles.cache;
  
  if (message.author.id == '198269661320577024') perms.dev = true; perms.admin = true; perms.trusted = true;
  if (roles.has(client.config.get('permsConfig').admin)) perms.admin = true; perms.trusted = true;
  if (roles.has(client.config.get('permsConfig').trusted)) perms.trusted = true;

  executeCommand(client, message, command, args, perms);
  
});

function executeCommand(client, message, command, args, perms) {
  if (command === 'ping') {
    message.reply('Pong!');
  }

  if (perms.admin && command === 'prefix') {
    setPrefix(client, args, message);
  } 

  if (perms.admin && command === 'kill') {
    shutdown(message);
  }

}

function shutdown(message) {
  message.channel.send("Shutting down");
  console.log(`Killed by: ${message.author.tag}`);
  setTimeout((function() {
      return process.exit(0);
  }), 1000);
}

async function setPrefix(client, args, message) {
  if (args.length < 1) return;
  const newPrefix = args[0];

  const fs = require('fs');

  let baseConfig = await client.config.get('baseConfig');

  baseConfig.prefix = newPrefix;

  client.config.set('baseConfig', baseConfig)

  fs.writeFile("./config/baseConfig.json", JSON.stringify(baseConfig,null,4), (err) => console.error);

  message.reply(`Setting prefix to ${newPrefix}`)
}

client.login(identityConfig.token);