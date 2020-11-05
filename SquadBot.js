const Discord = require('discord.js');
const client = new Discord.Client();
const Enmap = require("enmap");

const identity = require("./config/ignore/identity.json");

client.config = new Enmap();
client.config.set('identity', identity);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('Pong!');
  }
});

client.login(identity.token);