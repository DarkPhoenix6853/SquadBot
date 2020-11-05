const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('Pong!');
  }
});

client.login('NTU0NTgzMTc1MzYwMTUxNTUz.XIYd1A.myCI5vTumYzA8Y8wni5Te7NWTBI');