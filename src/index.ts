import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

const pgClient = new Postgres.Client(auth.pg);
pgClient.connect();

const scanner = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

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

const userRepl = async () => {
    let command: string = "";
    const searchQueryTypes = {
        authorName: false,
        bookName: true,
        genre: false,
        pages: false,
        price: false,
        publisher: false,
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
                    queryTextHelper.push(`${queryType.replace("Name", "_name")} = '${searchOptions[`${queryType}`]}'`);
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
            await userRepl();
        } else if (command === "owner") {
            // placeholder
        } else if (command === "newuser") {
            // placeholder
        }
    }
    console.log("Exiting");
    process.exit(0);
};

mainRepl();
