//packages
const Discord = require('discord.js');
const client = new Discord.Client({ fetchAllMembers: true, partials: ['MESSAGE', 'REACTION', 'USER']});
const Enmap = require("enmap");
const cron = require("cron");

//get configs
const identityConfig = require("./config/ignore/identity.json");
const baseConfig = require("./config/baseConfig.json");
const permsConfig = require("./config/perms.json");

//save configs
client.config = new Enmap();
client.config.set('identity', identityConfig);
client.config.set('baseConfig', baseConfig);
client.config.set('permsConfig', permsConfig);

//set up DBs
const squadDB = new Enmap({ name: 'squadDB' });
const voiceDB = new Enmap({ name: 'voiceDB' });

//set up the status message to refresh every 12 hours
let recurringStatus = new cron.CronJob('00 00 00,12 * * *', setStatus);
recurringStatus.start();

//sweep for inactive voice channels
let voiceSweeping = new cron.CronJob('00,30 * * * * *', sweepVoice);
voiceSweeping.start();

//sweep for old squads
let squadSweeping = new cron.CronJob('15,45 * * * * *', sweepSquads);
squadSweeping.start();

client.on('ready', async () => {
  //show login info
  console.log(`Logged in as ${client.user.tag}!`);

  //set up the databases
  await squadDB.defer;
  console.log(`\nLoaded ${squadDB.size} squads from database`);
  client.squadDB = squadDB;

  await voiceDB.defer;
  console.log(`\nLoaded ${voiceDB.size} voice channels from database\n`);
  client.voiceDB = voiceDB;

  //confirm launch
  console.log(`${identityConfig.name} online!`)
});

client.on('messageReactionAdd', async (reaction, user) => {
  // When we receive a reaction we check if the reaction is partial or not
	if (reaction.partial) {
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message: ', error);
			return;
		}
  }

  //ignore bots
  if (user.bot) return;

  //ignore messages that aren't ours
  let hostMessages = client.squadDB.indexes;
  if (!hostMessages.includes(reaction.message.id)) return;

  let squad = client.squadDB.get(reaction.message.id);

  if (reaction.emoji.name == '✅') onJoin(reaction, user, squad, reaction.message.id);
  if (reaction.emoji.name == '❎') onClose(reaction, user, squad, reaction.message.id);
  if (reaction.emoji.name == '⏩') onGo(reaction, user, squad, reaction.message.id);
})

client.on('messageReactionRemove', async (reaction, user) => {
  // When we receive a reaction we check if the reaction is partial or not
	if (reaction.partial) {
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message: ', error);
			return;
		}
  }

  //ignore bots
  if (user.bot) return;

  //ignore messages that aren't ours
  let hostMessages = client.squadDB.indexes;
  if (!hostMessages.includes(reaction.message.id)) return;

  let squad = client.squadDB.get(reaction.message.id);

  if (reaction.emoji.name == '✅') onJoinRemove(reaction, user, squad, reaction.message.id);
})

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
    admin: true,
    trusted: true
  };

  let member = await message.guild.member(message.author);
  let roles = await member.roles.cache;
  if (message.author.id == '198269661320577024') {
    perms.dev = true; 
    perms.admin = true; 
    perms.trusted = true;
  } else if (roles.has(client.config.get('permsConfig').admin)) {
    perms.admin = true; 
    perms.trusted = true;
  } else if (roles.has(client.config.get('permsConfig').trusted)) {
    perms.trusted = true;
  }
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
  let adminAdd = "";

  //if the user has access to it, also tell them about the addvoice command
  if (perms.trusted) {
    voiceAdd = `-----Trusted Commands-----\n**To create a new voice channel** without making a squad, use __${baseConfig.prefix}addvoice__`
  }

  if (perms.admin) {
    adminAdd = `-----Admin commands-----
**To change the bot's prefix** use __${baseConfig.prefix}prefix__ followed by the new prefix. This should be reflected in the bot's status.`
  }

  const helpText = `
Help for SquadBot: 
**To create a squad**, use __${baseConfig.prefix}host__ followed by the message you want to display. Capacity is optional. 
e.g. __${baseConfig.prefix}host lith survival__ or __${baseConfig.prefix}host lith survival 1/4__
If you want to start the squad with 2 or 3 people (instead of just yourself), put the number of users at the end of the message
e.g. you + 1 friend = __${baseConfig.prefix}host k-drive racing 2/4__

**To join a squad** just click the ✅ on someone else's host message

**To close one of your squads** click the ❎ on your own host message

**To start playing with less than 4 people**, click the ⏩ on your own squad message

${voiceAdd}

${adminAdd}`;

  message.channel.send(helpText);
}

//user creates a new voice channel
async function addVoice(client, message) {
  const guild = message.guild;  

  let member = await guild.members.fetch(message.author);
  let username = "";

  if (member) username = member.displayName;

  let newChannel = await createVoiceChannel(client, guild, `${username}'s squad channel`);

  message.reply(`Created a new voice channel: ${newChannel.name}`);
}

//create a new voice channel
async function createVoiceChannel(client, guild, name) {
  //get the config (to figure out what category to put the channels in)
  let baseConfig = await client.config.get('baseConfig');

  const channelOptions = {
    type: 'voice',
    userLimit: 4,
    parent: baseConfig.voiceCategory
  }

  let channelName = "";
  if (!name || name == "") {
    channelName = await getUniqueName(client);
  } else {
    channelName = name;
  }

  //make the channel
  let newChannel = await guild.channels.create(channelName, channelOptions);

  //update the DB
  await client.voiceDB.set(newChannel.id, {nameID: channelName, createdTime: Date.now(), occupied: true});

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

  let possibleSquadCount = args[args.length-1];

  let initialCount = 1;

  if (possibleSquadCount == '1/4') {
    initialCount = 1;
  } else if (possibleSquadCount == '2/4') {
    initialCount = 2;
  } else if (possibleSquadCount == '3/4') {
    initialCount = 3;
  } else {
    args.push('1/4');
    initialCount = 1;
  }

  //get the member of the author
  let authorMember = await message.guild.member(message.author);

  //set the title
  let title = `Open Squad - ${authorMember.displayName}`;

  let content = args.join(" ");

  let embed = await createEmbed(message, client, title, content);

  //send message
  let sentMessage = await message.channel.send(embed);

  //save relevant info to the DB
  client.squadDB.set(sentMessage.id, {
    channel: sentMessage.channel.id,
    host: message.author.id,
    initialCount: initialCount,
    content: content.substring(0,content.length-4),
    createdTime: Date.now(),
    title: title
  })

  message.delete();

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
  const text = `This bot was created by ${name}.
Feel free to DM me with bot ideas, or if you'd like to support my work please check out __${baseConfig.prefix}Donations__`;

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

function sweepVoice() {
  if (!client.voiceDB) return;

  let voiceChannels = client.voiceDB.indexes;

  if (!voiceChannels) return;

  for (let channelID of voiceChannels) {
    let channelInfo = client.voiceDB.get(channelID)
    
    if (!channelInfo) {
      console.log(`Channel info not found for ${channelID}`);
      return;
    }

    let channelAge = (Date.now() - channelInfo.createdTime)/1000;

    if (channelAge < 60) return;

    client.channels.fetch(channelID)
    .then((channel) => {
      if (!channel) {
        console.log(`Can't find channel ${channelID}`);
        //purge from the system
        client.voiceDB.delete(channelID);
        return;
      }

      if (channel.members.size > 0) {
        //people in the channel
        //set as occupied
        channelInfo.occupied = true;
        client.voiceDB.set(channelID, channelInfo);

      } else if (channelInfo.occupied) {
        //nobody in the channel, but still set as occupied
        //set as unoccupied
        channelInfo.occupied = false;
        client.voiceDB.set(channelID, channelInfo);

      } else {
        //nobody in channel, listed as unoccupied
        //delete it
        channel.delete()
        .then(() => {
          client.voiceDB.delete(channel.id);
        })
        .catch((err) => console.log(err))
      }
    })
    .catch(() => { })
  }
}

async function sweepSquads() {
  if (!client.squadDB) return;

  let squads = client.squadDB.indexes;

  if (!squads) return;

  for (let messageID of squads) {
    let squadInfo = client.squadDB.get(messageID);

    if (!squadInfo) return;

    //minutes
    let squadAge = (Date.now() - squadInfo.createdTime)/1000/60;

    if (squadAge < 60) return;

    let channel = await client.channels.fetch(squadInfo.channel);

    let message = await channel.messages.fetch(messageID);

    message.delete();

    client.squadDB.delete(messageID);

  }
}

function onClose(reaction, user, squad, squadID) {
  //check if this is the host
  if (user.id !== squad.host) {
    reaction.users.remove(user);
    return;
  }
  
  client.squadDB.delete(squadID);
  reaction.message.delete();
}

async function onJoin(reaction, user, squad, squadID) {
  //check if this is the host
  if (user.id === squad.host) {
    reaction.users.remove(user);
    return;
  }
  const initialCount = squad.initialCount;

  if (reaction.count - 1 + initialCount >= 4) fillCheck(reaction, squad);

  let currentContent = reaction.message.embeds[0].description;
  let currentCount = currentContent.substring(currentContent.length-3,currentContent.length-2);
  let currentCountInt = parseInt(currentCount, 10);
  let newCount = currentCountInt + 1;

  let newContent = currentContent.substring(0, currentContent.length-3).concat(newCount.toString(),
      currentContent.substring(currentContent.length-2, currentContent.length))
  
  let embed = await createEmbed(reaction.message, client, squad.title, newContent);

  await reaction.message.edit(embed);
}

async function onJoinRemove(reaction, user, squad, squadID) {
  if (user.id === squad.host) return;

  let currentContent = reaction.message.embeds[0].description;
  let currentCount = currentContent.substring(currentContent.length-3,currentContent.length-2);
  let currentCountInt = parseInt(currentCount, 10);
  let newCount = currentCountInt - 1;

  let newContent = currentContent.substring(0, currentContent.length-3).concat(newCount.toString(),
      currentContent.substring(currentContent.length-2, currentContent.length))
  
  let embed = await createEmbed(reaction.message, client, squad.title, newContent);

  await reaction.message.edit(embed);
}

async function onGo(reaction, user, squad, squadID) {

  //check if this is the host
  if (user.id !== squad.host) {
    reaction.users.remove(user);
    return;
  }

  //find the join reaction object
  let reactions = reaction.message.reactions.cache;

  let joinReaction;

  for (let reaction of reactions) {
    if (reaction[1].partial) {
      // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
      try {
        await reaction[1].fetch();
      } catch (error) {
        console.error('Something went wrong when fetching the message: ', error);
        return;
      }
    }

    if (reaction[0] == '✅') joinReaction = reaction;
  }
  
  fillCheck(joinReaction[1], squad);
}

function fillCheck(reaction, squad) {
  //get reacted users
  let users = reaction.users.cache;
  let usersClean = [];
  //add the host first
  usersClean.push(squad.host);

  for (let user of users) {
    //filter out bots and the host (if they somehow reacted)
    if (user[1].bot) continue;
    if (user[1].id == squad.host) continue;
    usersClean.push(user[1].id);
  }

  fill(usersClean, reaction.message, squad);
}

async function fill (users, message, squad) {

  let mentions = "";
  for (let user of users) {
    mentions += `<@${user}>`;
  }

  let voiceChannel = await createVoiceChannel(client, message.guild, squad.content);

  let embed = await createEmbed(message, client, "Squad filled", `Squad: ${squad.content}\n\nNew voice channel created: ${voiceChannel.name}`);

  message.channel.send(mentions, embed);

  client.squadDB.delete(message.id);

  message.delete();
}