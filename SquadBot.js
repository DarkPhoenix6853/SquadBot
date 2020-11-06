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

const squadDB = new Enmap({ name: 'squadDB' });
const voiceDB = new Enmap({ name: 'voiceDB' });

let recurringStatus = new cron.CronJob('00 00 00,12 * * *', setStatus);
recurringStatus.start();

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  await squadDB.defer;
  console.log(`\nLoaded ${squadDB.size} squads from database`);
  client.squadDB = squadDB;

  await voiceDB.defer;
  console.log(`\nLoaded ${voiceDB.size} voice channels from database\n`);
  client.voiceDB = voiceDB;

  console.log(`${identityConfig.name} online!`)
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

  if (command === 'host' || command === 'h') {
    host(client, message, args);
  }

  if (command === 'dumpdb' && perms.dev) {
    dumpdb(message, client);
  }

  if (command === 'purgedb' && perms.dev) {
    purgedb(message, client);
  }

  if (command === 'addvoice' && perms.trusted) {
    addVoice(client, message);
  }

  if (command === 'help' || command === 'guide') {
    help(message, perms);
  }
}

//display the help message
function help(message, perms) {
  let voiceAdd = "";

  //if the user has access to it, also tell them about the addvoice command
  if (perms.trusted) {
    voiceAdd = `**To create a new voice channel** without making a squad, use __++addvoice__`
  }

  const helpText = `
Help for SquadBot: 
**To create a squad**, use __++host__ followed by the message you want to display. 
e.g. __++host lith survival__
If you want to start the squad with 2 or 3 people (instead of just yourself), put the number of users before the host message
e.g. you + 1 friend = __++host 2 k-drive racing__

**To join a squad** just click the ✅ on someone else's host message

**To close one of your squads** click the ❎ on your own host message

**To start playing with less than 4 people**, click the ⏩ on your own squad message

${voiceAdd}`;

  message.channel.send(helpText);
}

//user creates a new voice channel
async function addVoice(client, message) {
  const guild = message.guild;  

  let newChannel = await createVoiceChannel(client, guild);

  message.reply(`Created a new voice channel: ${newChannel.name}`);
}

//create a new voice channel
async function createVoiceChannel(client, guild) {
  //get the config (to figure out what category to put the channels in)
  let baseConfig = await client.config.get('baseConfig');

  const channelOptions = {
    type: 'voice',
    userLimit: 4,
    parent: baseConfig.voiceCategory
  }

  //get a unique name
  let nameID = await getUniqueName(client);

  //make the channel
  let newChannel = await guild.channels.create(`Squad Channel ${nameID}`, channelOptions);

  //update the DB
  await client.voiceDB.set(newChannel.id, {nameID: nameID, createdTime: Date.now(), occupied: true});

  //just in case we need it
  return newChannel;
}

//finds a voice channel name that doesn't exist yet
async function getUniqueName(client) {

  //get all voice channels we're tracking
  const voiceKeys = client.voiceDB.indexes;
  let voiceIDArray = [];
  //for all channels
  for (let key of voiceKeys) {
    //grab the channel info
    let channel = await client.voiceDB.get(key)
    //save the name IDs
    voiceIDArray.push(channel.nameID.toString());
  }
  //find an ID that's not in use at the moment
  for (let i = 1; i < 1000; i++) {
    //if not currently used, use that one
    if (!voiceIDArray.includes(i.toString())) return i.toString();
  }

  //if we somehow haven't found a match in 1000 unique IDs
  return "Error - how on Earth do you have this many squads at once?"
}

//wipe all databases
function purgedb(message, client) {
  client.squadDB.deleteAll();
  client.voiceDB.deleteAll();
  
  message.channel.send("Database purged");
  console.log(`Database purged by ${message.author.username}`);
}

//save databases to file for analysis
function dumpdb(message, client) {
  const fs = require('fs');
  const date = new Date();

  const timeStamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

  const squadKeys = client.squadDB.indexes;
  let squadArray = [];
  for (let key of squadKeys) {
    let squadObject = {
      messageID: key,
      squad: client.squadDB.get(key)
    }
    squadArray.push(squadObject);
  }
  fs.writeFile(`./dumps/${timeStamp}_SquadDump.json`, JSON.stringify(squadArray,null,4), (err) => console.error);

  const voiceKeys = client.voiceDB.indexes;
  let voiceArray = [];
  for (let key of voiceKeys) {
    let voiceObject = {
      channelID: key,
      voice: client.voiceDB.get(key)
    }
    voiceArray.push(voiceObject);
  }
  fs.writeFile(`./dumps/${timeStamp}_voiceDump.json`, JSON.stringify(voiceArray,null,4), (err) => console.error);


  console.log("Database saved to file");

  message.channel.send("Dumped DB to file");
}

//creates a new embed
async function createEmbed(message, client, title, content) {
  //get the bot's displayed colour
  const botMember = await message.guild.member(client.user);
  const myColour = botMember.displayColor;

  //construct the embed
  let embed = new Discord.MessageEmbed()
  .setTitle(title)
  .setColor(myColour)
  .setDescription(content);

  return embed;
}

//create a host message
async function host(client, message, args) {

  //get the number of people initially in the squad
  let initialCount = parseInt(args[0], 10);
  if (isNaN(initialCount) || initialCount > 3) {
    initialCount = 1;
  } else {
    args.shift();
  }

  //get the member of the author
  let authorMember = await message.guild.member(message.author);

  //set the title
  let title = `Open Squad - ${authorMember.displayName}`;

  //format initial players
  let addon = "";

  if (initialCount > 1) {
    addon = `Starting at ${initialCount} players\n`
  }

  let text = args.join(" ");
  let content = `${addon}${text}`

  let embed = await createEmbed(message, client, title, content);

  //send message
  let sentMessage = await message.channel.send(embed);

  //save relevant info to the DB
  client.squadDB.set(message.id, {
    channel: message.channel.id,
    host: message.author.id,
    initialCount: initialCount,
    content: text,
    createdTime: Date.now()
  })

  //add reactions
  await sentMessage.react("✅");
  await sentMessage.react("❎");
  await sentMessage.react("⏩");
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