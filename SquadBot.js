const Discord = require('discord.js');
const client = new Discord.Client();
const Enmap = require("enmap");
const cron = require("cron");

const identityConfig = require("./config/ignore/identity.json");
const baseConfig = require("./config/baseConfig.json");
const permsConfig = require("./config/perms.json");

client.config = new Enmap();
client.config.set('identity', identityConfig);
client.config.set('baseConfig', baseConfig);
client.config.set('permsConfig', permsConfig);

let recurringStatus = new cron.CronJob('00 00 00,12 * * *', setStatus);
recurringStatus.start();

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

  //split the message into command + arguments
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  //get permissions of the current user
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

  //finally, execute the command
  executeCommand(client, message, command, args, perms);
});

function executeCommand(client, message, command, args, perms) {
  //check if the bot is awake
  if (command === 'ping') {
    message.reply('Pong!');
  }

  if (perms.admin && command === 'prefix') {
    setPrefix(client, args, message);
  } 

  if (perms.admin && command === 'kill') {
    shutdown(message);
  }

  if (command === 'credit') {
    credit(client, message)
  }

  if (command === 'donations') {
    donations(message);
  }
}

//Displays a donation message for how to support the creator
function donations(message) {
  let name = "DarkPhoenix6853";
  if (message.guild.members.cache.has('198269661320577024')) name = "<@198269661320577024>";
  const text = `This bot was created by ${name}. You can support my work at these links:
[BuyMeACoffee](https://www.buymeacoffee.com/DarkPhoenix6853)
[Liberapay](https://liberapay.com/DarkPhoenix6853/)`;

  let embed = new Discord.MessageEmbed()
  .setTitle("Donation information")
  .setColor("#9211ff")
  .setDescription(text);

  message.channel.send(embed);
}

//Shows a message about who made the bot
async function credit (client, message) {
  let baseConfig = await client.config.get('baseConfig');
  let name = "DarkPhoenix6853";
  if (message.guild.members.cache.has('198269661320577024')) name = "<@198269661320577024>";
  const text = `This bot was created by ${name}.\nFeel free to DM me with bot ideas, or if you'd like to support my work please check out __${baseConfig.prefix}Donations__`;

  let embed = new Discord.MessageEmbed()
  .setTitle("Created by DarkPhoenix6853")
  .setColor("#9211ff")
  .setDescription(text);

  message.channel.send(embed);
}

//shuts down the bot. If using PM2 or other process manager the bot should restart. 
function shutdown(message) {
  message.channel.send("Shutting down");
  console.log(`Killed by: ${message.author.tag}`);
  setTimeout((function() {
      return process.exit(0);
  }), 1000);
}

//sets a new command prefix
async function setPrefix(client, args, message) {
  //make sure we're actually changing to something
  if (args.length < 1) return;

  //get the new prefix
  const newPrefix = args[0];

  const fs = require('fs');

  //get the current config
  let baseConfig = await client.config.get('baseConfig');

  //edit it
  baseConfig.prefix = newPrefix;

  //save it
  await client.config.set('baseConfig', baseConfig)

  //also save it in the config file
  fs.writeFile("./config/baseConfig.json", JSON.stringify(baseConfig,null,4), (err) => console.error);

  message.reply(`Setting prefix to ${newPrefix}`)

  //update the Presence
  setStatus();
}

client.login(identityConfig.token)
.then(() => {
  setStatus()
})

//update the bot's Presence
async function setStatus() {
  let baseConfig = await client.config.get('baseConfig');

  let customStatus = {
    status: 'online',
    afk: false,
    activity: {
        type: 2,
        name: `${baseConfig.prefix}help`
    }
  }

  client.user.setPresence(customStatus)
  .catch(console.error);
}