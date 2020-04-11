import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

// Globals
const pgClient = new Postgres.Client(auth.pg);
pgClient.connect();

let currentUser: number = -1;
let adminUser: boolean = false;

const scanner = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

// Helper Functions
const askQuestion = (query: string) => {
    return new Promise<string>((resolve) => {
        scanner.question(query, resolve);
    });
};
const asyncForEach = async (array: any[], callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};

// REPLs for the program
const userRepl = async () => {
    let command: string = "";
    const searchQueryTypes = {
        "Author Name": false,
        "Book Name": true,
        "Genre": false,
        "Pages": false,
        "Price": false,
        "Publisher": false,
    };
    const help: string = `
"user" mode: browse books or view orders

Commands:
    - help [query type]
        No additional arguments: shows this again.
        Argument is a query type: shows special uses of that query type.

    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [bookname]

    - <query type> [on|off]
        'on' means that you will be prompted for that query type in a book search.
        'off' means that you will not be prompted for that query type in a book search (i.e. auto-ignore).
        Available query types: [bookname, authorname, genre, publisher, pages, price, isbn].

    - order [number]
        Specifying a number will show that order only.
        No number will list all orders.

    - exit
        Exits from "user" mode.
    `;
    console.log(help);
    while (command.toLowerCase() !== "exit") {
        command = await askQuestion("> ");

        if (command.toLowerCase() === "help") {
            console.log(help);
        } else if (command.toLowerCase() === "search") {
            const searchOptions = {};

            await asyncForEach(Object.keys(searchQueryTypes), async (queryType: string) => {
                if (searchQueryTypes[`${queryType}`]) {
                    searchOptions[`${queryType}`] = await askQuestion(`${queryType}?\n`);
                }
            });

            let queryText = `SELECT * FROM book`;
            if (Object.keys(searchOptions).length !== 0) {
                const queryTextHelper = [];
                Object.keys(searchOptions).forEach((queryType) => {
                    queryTextHelper.push(`${queryType.toLowerCase().replace(" name", "_name")} = '${searchOptions[`${queryType}`]}'`);
                });
                queryText = `${queryText} WHERE ${queryTextHelper.join(" AND ")}`;
            }

            console.log(queryText);
            const dbRes = await pgClient.query(queryText);
            console.log(dbRes.rows);
        }
    }
};
const mainRepl = async () => {
    let command: string = "";
    const prompt = "Why are you here?\nI am a [user, owner, newuser]:\n> ";
    while (command.toLowerCase() !== "exit") {
        command = await askQuestion(prompt);

        if (command === "user") {
            const username = await askQuestion("What is your username?\n> ");
            // just gonna leave their password right out in the open
            // their passwords are also stored in plaintext
            const password = await askQuestion("What is the password?\n> ");
            const dbRes = await pgClient.query(`SELECT * FROM users WHERE username = '${username}' AND not_salty_password = '${password}'`);
            if (dbRes.rows.length === 1) {
                const loggedIn = dbRes.rows[0];
                currentUser = loggedIn.username;
                adminUser = false;
                await userRepl();
            } else {
                console.error("Sorry, you're not in the database (which means you should make a new user), or the password you entered is not the correct one.");
            }
        } else if (command === "owner") {
            adminUser = true;
        } else if (command === "newuser") {
            const existingUsers = (await pgClient.query("SELECT username FROM users")).rows;
            let newUsername = "";
            let usernameExists = true;
            while (usernameExists) {
                newUsername = await askQuestion("What would you like your new username to be?\n> ");
                usernameExists = false;
                existingUsers.forEach((existingUser) => {
                    if (existingUser.username === newUsername) {
                        usernameExists = true;
                        console.log("That username is already taken.");
                    }
                });
            }
            const password = await askQuestion("What would you like your new password to be?\n> ");
            const accept = await askQuestion(`Your username shall be '${newUsername} and your password shall be ${password}, is this okay (Y/n)?\n> `);
            if (accept.toLowerCase() === "y" || accept.toLowerCase() === "yes" || accept.trim() === "") {
                await pgClient.query("INSERT INTO users (username, not_salty_password, admin_account) VALUES ($1, $2, $3)", [newUsername, password, false]);
                console.log("A new user has been added to the database.\n");
            }
        }
    }
    console.log("Exiting");
    process.exit(0);
};

// public static void main(String[] args) {
mainRepl();
