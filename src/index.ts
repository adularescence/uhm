import readline from "readline";

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

const userRepl = async () => {
    let command: string = "";
    const help: string = `
"user" mode: browse books or view orders

Commands:
    - help [query type]
        No additional arguments: shows this again.
        Argument is a query type: shows special uses of that query type.

    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [bookname, authorname, genre, publisher, price]

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

        if (command === "help") {
            console.log(help);
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
