require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const database = require('./database.js');

// Initialize SQLite database
const dbPath = path.join(__dirname, 'debts.db');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const BOT_CHANNEL_ID = process.env.BOT_CHANNEL_ID;

// Commands handling
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.channel.id !== BOT_CHANNEL_ID) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    switch (command) {
        case '!commands':
            message.channel.send(`**Available commands:**

**!commands** - List all commands
**!set @user amount** - Set a debt amount
**!add @user amount** - Add to or subtract from an existing debt
**!showutang @user** - Show how much a specific user owes you
**!show [@user]** - List all debts owed to you or the specified user
**!remove @user** - Remove all debts owed by the specified user
**!clear** - Delete all messages in the channel
**Made by @johnnytan with discord.js**`);
            break;

        case '!set':
            if (args.length < 2) {
                message.channel.send('**Usage:** !set @user amount');
                return;
            }

            const setUser1 = message.author.id;
            const setUser2 = args[0].replace(/[<@!>]/g, '');
            const setAmount = parseAmount(args[1]);

            if (isNaN(setAmount) || setAmount < 0) {
                message.channel.send('**Please provide a valid non-negative amount.**');
                return;
            }

            database.addDebt(setUser1, setUser2, setAmount, err => {
                if (err) {
                    console.error(err.message);
                    message.channel.send('**There was an error storing the debt.**');
                    return;
                }

                message.channel.send(`**Set debt of ${setAmount.toFixed(2)} Rupiah from <@${setUser1}> to <@${setUser2}>.**`);
            });
            break;

        case '!add':
            if (args.length < 2) {
                message.channel.send('**Usage:** !add @user amount');
                return;
            }

            const addUser1 = message.author.id;
            const addUser2 = args[0].replace(/[<@!>]/g, '');
            const addAmount = parseAmount(args[1]);

            if (isNaN(addAmount)) {
                message.channel.send('**Please provide a valid amount.**');
                return;
            }

            database.getDebt(addUser1, addUser2, (err, currentDebt) => {
                if (err) {
                    console.error(err.message);
                    message.channel.send('**There was an error retrieving the current debt.**');
                    return;
                }

                const newDebt = Math.max(0, currentDebt + addAmount);

                database.updateDebt(addUser1, addUser2, newDebt - currentDebt, err => {
                    if (err) {
                        console.error(err.message);
                        message.channel.send('**There was an error updating the debt.**');
                        return;
                    }

                    if (addAmount >= 0) {
                        message.channel.send(`**Increased debt by ${addAmount.toFixed(2)} Rupiah from <@${addUser2}> to you.**`);
                    } else {
                        message.channel.send(`**Decreased debt by ${Math.abs(addAmount).toFixed(2)} Rupiah from <@${addUser2}> to you.**`);
                    }
                });
            });
            break;

            case '!showutang':
                const showUser = args.length > 0 ? args[0].replace(/[<@!>]/g, '') : message.author.id;
                const userMentionShow = args.length > 0 ? `<@${showUser}>` : 'you';
            
                database.listDebts(showUser, (err, rows) => {
                    if (err) {
                        console.error(err.message);
                        message.channel.send('**There was an error retrieving the debts.**');
                        return;
                    }
            
                    if (rows.length === 0) {
                        message.channel.send(`**No one owes ${userMentionShow} anything.**`);
                        return;
                    }
            
                    let response = `**Here are the people who owe ${userMentionShow} money:**\n`;
                    rows.forEach(row => {
                        response += `**<@${row.user2}>**: ${row.total.toFixed(2)} Rupiah\n`;
                    });
            
                    message.channel.send(response);
                });
                break;
            

        case '!show':
            const targetUser = args.length > 0 ? args[0].replace(/[<@!>]/g, '') : message.author.id;
            const userMention = args.length > 0 ? `<@${targetUser}>` : 'you';

            database.listDebts(targetUser, (err, rows) => {
                if (err) {
                    console.error(err.message);
                    message.channel.send('**There was an error retrieving the debts.**');
                    return;
                }

                if (rows.length === 0) {
                    message.channel.send(`**No one owes ${userMention} anything.**`);
                    return;
                }

                let response = `**Here are the people who owe ${userMention} money:**\n`;
                rows.forEach(row => {
                    response += `**<@${row.user2}>**: ${row.total.toFixed(2)} Rupiah\n`;
                });

                message.channel.send(response);
            });
            break;

        case '!remove':
            if (args.length < 1) {
                message.channel.send('**Usage:** !remove @user');
                return;
            }

            const removeUser1 = message.author.id;
            const removeUser2 = args[0].replace(/[<@!>]/g, '');

            database.removeDebts(removeUser1, removeUser2, err => {
                if (err) {
                    console.error(err.message);
                    message.channel.send('**There was an error removing the debts.**');
                    return;
                }

                message.channel.send(`**Removed all debts where <@${removeUser2}> owed you money.**`);
            });
            break;

        case '!clear':
            if (!message.member.permissions.has('MANAGE_MESSAGES')) {
                message.channel.send('**You do not have permission to use this command.**');
                return;
            }

            const messages = await message.channel.messages.fetch({ limit: 100 });
            await message.channel.bulkDelete(messages);

            message.channel.send('**All messages have been deleted.**');
            break;

        default:
            // message.channel.send('**Unknown command. Use !commands to list all available commands.**');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Helper function to parse amount with period or comma as decimal separator
function parseAmount(amountStr) {
    amountStr = amountStr.replace(',', '.').trim();
    return parseFloat(amountStr);
}
