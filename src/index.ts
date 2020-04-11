import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

// Globals
const pgClient = new Postgres.Client(auth.pg);
pgClient.connect();

const userHelp = `
"user" mode: browse books or view orders

Commands:
    - help [query type]
        No additional arguments: shows this again.
        Argument is a query type: shows special uses of that query type.

    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [bookname]

    - turn <query type> [on|off]
        'on' means that you will be prompted for that query type in a book search.
        'off' means that you will not be prompted for that query type in a book search (i.e. auto-ignore).
        Available query types: [authorname, bookname, genre, pages, price, publisher].

    - order [number]
        Specifying a number will show that order only.
        No number will list all orders.

    - exit
        Exits from "user" mode.
`;
const ownerHelp = `

Owner Commands:
    - add
        Add a new book to your bookstore.
        Prompts you for all the required fields.
        Also prompts you to add a new publisher, if needed.

    - delete <ISBN>
        Remove a book from your bookstore.

    - publisher [name]
        View info for given publisher, or all of them if name is omitted.

    - money
        Show how much cash you have.
`;

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
const loggedInRepl = async (username: string, ownerMode: boolean) => {
    let command: string = "";
    const searchQueryTypes = {
        authorname: false,
        bookname: true,
        genre: false,
        pages: false,
        price: false,
        publisher: false,
    };
    const help: string = `${userHelp}${ownerMode ? ownerHelp : ""}`;
    console.log(help);
    while (command.toLowerCase() !== "exit") {
        const input = (await askQuestion("> ")).trim().split(" ").map((elem) => elem.toLowerCase() );
        command = input[0];
        const argv = input.splice(1);

        if (command === "help") {
            console.log(help);
        } else if (command === "search") {
            const searchOptions = {};

            await asyncForEach(Object.keys(searchQueryTypes), async (queryType: string) => {
                if (searchQueryTypes[`${queryType}`]) {
                    searchOptions[`${queryType}`] = (await askQuestion(`${queryType}?\n`)).trim();
                }
            });

            let queryText = `SELECT * FROM book`;
            if (Object.keys(searchOptions).length !== 0) {
                const queryTextHelper = [];
                Object.keys(searchOptions).forEach((queryType) => {
                    queryTextHelper.push(`${queryType.replace("name", "_name")} = '${searchOptions[`${queryType}`]}'`);
                });
                queryText = `${queryText} WHERE ${queryTextHelper.join(" AND ")}`;
            }

            console.log(queryText);
            const dbRes = await pgClient.query(queryText);
            console.log(dbRes.rows);
        } else if (command === "turn") {
            // ensure that there are 2 arguments, the 0th argument is a valid query type, and the 1st argument is either "on" or "off"
            if (argv.length === 2 && Object.keys(searchQueryTypes).includes(argv[0]) && (argv[1] === "on" || argv[1] === "off")) {
                // enable/disable that query type
                const newState = argv[1] === "on";
                console.log(`Search ${newState ? "includes" : "excludes"} ${argv[0]} now.`);
                searchQueryTypes[`${argv[0]}`] = newState;
            } else {
                console.log(`Need to specify a query type from ["${Object.keys(searchQueryTypes).join('", "')}"], and whether to turn it on or off.`);
            }
        } else if (command === "order") {
            let queryText = `SELECT * FROM orders WHERE username = ${username}`;
            let dbRes;
            if (argv.length === 1) {
                queryText = `${queryText} AND id = $1`;
                console.log(queryText);
                dbRes = await pgClient.query(queryText, [argv[0]]);
            } else {
                console.log(queryText);
                dbRes = await pgClient.query(queryText);
            }
            console.log(dbRes.rows);
        }
    }
};
const mainRepl = async () => {
    let command: string = "";
    const prompt = "Why are you here?\nI am a [user, newuser]:\n> ";
    while (command.toLowerCase() !== "exit") {
        command = (await askQuestion(prompt)).trim();

        if (command === "user") {
            const username = (await askQuestion("What is your username?\n> ")).trim();
            // just gonna leave their password right out in the open
            // their passwords are also stored in plaintext
            const password = (await askQuestion("What is the password?\n> ")).trim();
            const dbRes = await pgClient.query(`SELECT * FROM users WHERE username = '${username}' AND not_salty_password = '${password}'`);
            if (dbRes.rows.length === 1) {
                const loggedIn = dbRes.rows[0];
                await loggedInRepl(loggedIn.username, loggedIn.admin_account);
            } else {
                console.error("Sorry, you're not in the database (which means you should make a new user), or the password you entered is not the correct one.");
            }
        } else if (command === "newuser") {
            const existingUsers = (await pgClient.query("SELECT username FROM users")).rows;
            let newUsername = "";
            let usernameExists = true;
            while (usernameExists) {
                newUsername = (await askQuestion("What would you like your new username to be?\n> ")).trim();
                usernameExists = false;
                existingUsers.forEach((existingUser) => {
                    if (existingUser.username === newUsername) {
                        usernameExists = true;
                        console.log("That username is already taken.");
                    }
                });
            }
            const password = (await askQuestion("What would you like your new password to be?\n> ")).trim();
            const accept = (await askQuestion(`Your username shall be '${newUsername} and your password shall be ${password}, is this okay (Y/n)?\n> `)).trim();
            if (accept.toLowerCase() === "y" || accept.toLowerCase() === "yes" || accept === "") {
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
