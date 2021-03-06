# SquadBot
## Design work
* ~~Design squad DB~~
    * ~~Index by MessageID~~
    * ~~Save channel, host ID, start cap, content, created time~~
* ~~Design voice channel DB~~
    * ~~Index by ChannelID~~
    * ~~Save Created timestamp, and whether anyone was in it on the last sweep~~

## Periodic
* ~~approx 12 hours?~~
    * ~~Set presence of bot to say something about the help command~~
* ~~approx 1 hour? ask Wolf~~
    * ~~Sweep through squad DB, anything that's too old delete its message and remove entry from DB~~
* ~~approx 30 seconds ~~
    * ~~Sweep through VoiceDB~~
    * ~~If a channel is less than a minute old, ignore it~~
    * ~~Otherwise see if there are people in it~~
    * ~~If not, check if there weren't any on the previous sweep~~
    * ~~If yes, set to no~~
    * ~~If already no, delete channel and remove from DB~~

## Commands
* ~~Command to create a squad~~
    * ~~Args: (optional) starting capacity, message~~
    * ~~Default starting capacity to 1 (host)~~
    * ~~Creates an embed~~
        * ~~Get colour from own role colour~~
        * ~~content includes initial player count(if > 1) and message~~
    * ~~Adds the first reactions~~
    * ~~Index by message ID, save channel, host ID, starting capacity, message content, created time~~

* ~~Command to create a voice channel~~
    * ~~Trusted only~~
    * ~~Create channel~~
    * ~~Add to VoiceDB~~
    * ~~Reply to author with reference to channel~~

* ~~"Help" or "Guide" command~~
    * ~~host command~~
    * ~~Reaction uses~~
    * ~~If trusted, add voice channel creation command~~

* ~~Donations command~~

* ~~Credit command~~

* ~~DumpDB (For debugging)~~

* ~~PurgeDB (For debugging)~~

## Events
* ~~Reaction event~~
    * ~~Ignore bots~~
    * ~~Ignore reactions unless they're on squad messages~~
    * ~~If it's the "close" reaction, delete the message (and wipe from DB)~~
    * ~~If it's the "go" reaction, run FillCheck routine (pass in message object)~~
    * ~~If "join" react~~
        * ~~Ignore host~~
        * ~~Use message ID to get initial squad count~~
        * ~~If number of reacts (-1 for bot itself) + starting capacity >= 4~~
            * ~~Run FillCheck routine (pass in message object)~~

## Routines
* ~~FillCheck~~
    * ~~Requires message object~~
    * ~~Get reactions~~
    * ~~Iterate through them, remove the host and any bots~~
    * ~~Run Fill routine (pass in player IDs + host ID,  message object)~~

* Fill
    * ~~Get channel object (for later sending)~~
    * ~~Delete message~~
    * ~~Create a new voice channel~~
    * ~~Save it to VoiceDB~~
    * ~~Format IDs into a ping message with reference to new voice channel~~
    * ~~Send message~~
    * ~~Remove squad from DB~~

## Updates
* specify squad size by using 1/4 etc. at the end
    * none -> add 1/4 anyway
    * Edit messages with player count
    * probably need to change DB to include current count
* ~~Change name of voice channels using message content or (for addvoice) name~~

## Setup
* ~~Create the bot application (use on testing server first)~~
    * ~~Try to use actual permissions this time~~
        * ~~Read messages~~
        * ~~Read history~~
        * ~~Send messages~~
        * ~~Attach embeds~~
        * ~~Add reactions~~
        * ~~Manage messages~~
        * ~~Create channels~~
* ~~Figure out hosting~~
* Set up
    * Invite
    * ~~Bot should already have its own role - set colour~~
    * ~~Get IDs for trusted/admin roles~~
    * ~~Prefix~~
    * Channels
        * Which channels the bot can see/take commands from
        * Category for voice channels
        * Anyone who can use the voice channels needs the connect, speak and voice activity permissions in that category
