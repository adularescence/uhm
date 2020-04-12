import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

// Globals
declare interface Book {
    author_name: string;
    book_name: string;
    count: number;
    genre: string;
    isbn: string;
    pages: number;
    publisher: string;
    price: number;
    royalty: number;
}
declare interface ContactInfo {
    address: string;
    city: string;
    firstName: string;
    lastName: string;
    phone: string;
    postalCode: string;
}
declare interface BillingInfo extends ContactInfo {
    cardNumber: string;
    cvv: string;
    expiryDate: string;
}
const pgClient: Postgres.Client = new Postgres.Client(auth.pg);
pgClient.connect();

const searchQueryTypes = {
    authorname: false,
    bookname: false,
    genre: true,
    pages: false,
    price: false,
    publisher: false,
};
const contactInfoPatterns: ContactInfo = {
    address: "^\\d+ [A-Z][a-z]+ [A-Z][a-z]+$",
    city: "^[A-Za-z\\-]+$",
    firstName: "^[A-Za-z]+$",
    lastName: "^[A-Za-z]+$",
    phone: "^\\d{3}-\\d{3}-\\d{4}$",
    postalCode: "^[A-Z]\\d[A-Z] \\d[A-Z]\\d$",
};
const billingInfoPatterns: BillingInfo = {
    address: "^\\d+ [A-Z][a-z]+ [A-Z][a-z]+$",
    cardNumber: "^\\d{16}$",
    city: "^[A-Za-z\\-]+$",
    cvv: "^\\d{3}$",
    expiryDate: "^\\d{2}/\\d{2}$",
    firstName: "^[A-Za-z]+$",
    lastName: "^[A-Za-z]+$",
    phone: "^\\d{3}-\\d{3}-\\d{4}$",
    postalCode: "^[A-Z]\\d[A-Z] \\d[A-Z]\\d$",
};

const searchHelp: string = `
    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [bookname]

    - turn <query type> [on|off]
        'on' means that you will be prompted for that query type in a book search.
        'off' means that you will not be prompted for that query type in a book search (i.e. auto-ignore).
        Available query types: [authorname, bookname, genre, pages, price, publisher].
`;
const userHelp: string = `
"user" mode: browse books or view orders

Commands:
    - help [query type]
        No additional arguments: shows this again.
        Argument is a query type: shows special uses of that query type.
${searchHelp}
    - order [number]
        Specifying a number will show that order only.
        No number will list all orders.

    - exit
        Exits from "user" mode.
`;
const ownerHelp: string = `

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

const scanner: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let guestMode: boolean = true;
let ownerMode: boolean = false;
let userCart: Book[] = [];

// Helper Functions
const askQuestion: (query: string) => Promise<string> = (query: string) => {
    return new Promise<string>((resolve) => {
        scanner.question(query, resolve);
    });
};
const asyncForEach: (array: any[], callback: any) => Promise<void> = async (array: any[], callback: any) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};
const search: () => Promise<void> = async () => {
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

    console.log(queryText); // debug
    const dbRes = await pgClient.query(queryText);
    const books = dbRes.rows;
    if (books.length === 0) {
        console.log("No books with specified search options found.");
    } else {
        const newCart = await browseBooks(books, false);
        if (!guestMode) {
            userCart = newCart;
        }
    }
};
const turn: (argv: string[]) => Promise<void> = async (argv: string[]) => {
    // ensure that there are 2 arguments, the 0th argument is a valid query type, and the 1st argument is either "on" or "off"
    if (argv.length === 2 && Object.keys(searchQueryTypes).includes(argv[0]) && (argv[1] === "on" || argv[1] === "off")) {
        // enable/disable that query type
        const newState = argv[1] === "on";
        console.log(`Search ${newState ? "includes" : "excludes"} ${argv[0]} now.`);
        searchQueryTypes[`${argv[0]}`] = newState;
    } else {
        console.log(`Need to specify a query type from ["${Object.keys(searchQueryTypes).join('", "')}"], and whether to turn it on or off.`);
    }
};
const bookInfoTemplate: (books: Book[], bookIndex: number) => string = (books: Book[], bookIndex: number) => {
    const book: Book = books[bookIndex];
    const baseBookInfo = `
Book ${bookIndex + 1} of ${books.length}

    Name:\t\t${book.book_name}
    Author:\t\t${book.author_name}
    Genre:\t\t${book.genre}
    Publisher:\t\t${book.publisher}
    Pages:\t\t${book.pages}
    Price:\t\t${book.price}`;

    const ownerBookInfo = `

    Royalty:\t\t${book.royalty * 100}%
    Stock:\t\t${book.count} Copies Remaining`;

    return `${baseBookInfo}${ownerMode ? ownerBookInfo : ""}`;
};
const browseBooks: (books: Book[], cart: boolean) => Promise<Book[]> = async (books: Book[], inCart: boolean) => {
    // TODO drop when (ownerMode === true) means "drop from bookstore"
    const cart: Book[] = inCart ? books : [];
    let bookIndex: number = 0;
    let bookInfo: string = books.length !== 0 ? bookInfoTemplate(books, bookIndex) : "No books in your cart.";
    let browsingCommand: string = "";
    while (browsingCommand !== "exit") {
        console.clear();

        browsingCommand = (await askQuestion(`Viewing the ${inCart ? "books in your cart." : "found books"}.
"next" or "prev" for next/previous book.${(guestMode || ownerMode || inCart) ? "" : `\n"add" to add current book to cart.`}${inCart ? `\n"drop" to remove current book from cart.` : ""}
"exit" to exit.\n${bookInfo}\n`)).trim().toLowerCase();
        if (browsingCommand === "next" && (inCart ? cart.length !== 0 : books.length !== 0)) {
            if (bookIndex < (inCart ? cart.length - 1 : books.length - 1)) {
                bookIndex++;
                bookInfo = bookInfoTemplate(inCart ? cart : books, bookIndex);
            } else if (bookInfo[bookInfo.length - 1] !== "!") {
                bookInfo += "\nNo next book!";
            }
        } else if (browsingCommand === "prev" && (inCart ? cart.length !== 0 : books.length !== 0)) {
            if (bookIndex > 0) {
                bookIndex--;
                bookInfo = bookInfoTemplate(inCart ? cart : books, bookIndex);
            } else if (bookInfo[bookInfo.length - 1] !== "!") {
                bookInfo += "\nNo previous book!";
            }
        } else if (browsingCommand === "add" && !(guestMode || ownerMode || inCart)) {
            const addToCart = books.splice(bookIndex, 1)[0];
            if (bookIndex === books.length) {
                bookIndex--;
            }
            cart.push(addToCart);
            if (books.length !== 0) {
                bookInfo = bookInfoTemplate(books, bookIndex);
            } else {
                bookInfo = `No more books.`;
            }
            bookInfo += `\nAdded ${addToCart.book_name} to cart.`;
        } else if (browsingCommand === "drop" && inCart && cart.length !== 0) {
            const dropFromCart = cart.splice(bookIndex, 1)[0];
            if (bookIndex === cart.length) {
                bookIndex--;
            }
            if (cart.length !== 0) {
                bookInfo = bookInfoTemplate(cart, bookIndex);
            } else {
                bookInfo = `No more books in your cart.`;
            }
            bookInfo += `\nDropped ${dropFromCart.book_name} from your cart.`;
        }
    }
    return cart;
};
const checkout: () => Promise<void> = async () => {
    const contactInfo: ContactInfo = {
        address: "",
        city: "",
        firstName: "",
        lastName: "",
        phone: "",
        postalCode: ""
    };
    const billingInfo: BillingInfo = {
        address: "",
        cardNumber: "",
        city: "",
        cvv: "",
        expiryDate: "",
        firstName: "",
        lastName: "",
        phone: "",
        postalCode: ""
    };
    let nevermind: boolean = false;

    console.log(`Beginning the checkout process. Follow the prompts, and type "exit" to exit at anytime.`);
    await asyncForEach(Object.keys(contactInfo), async (target: string) => {
        if (nevermind) {
            return;
        }
        const response: string = await checkoutChecker(`What is your ${target}?\n`, contactInfoPatterns[`${target}`]);
        if (response === "exit") {
            nevermind = true;
        } else {
            contactInfo[`${target}`] = response;
        }
    });
    if (nevermind) {
        return;
    }

    const sameAsContact: string = (await askQuestion(`Is your billing info the same as your contact info (yes, no)?`)).trim().toLowerCase();
    if (sameAsContact === "no") {
        await asyncForEach(Object.keys(billingInfo), async (target: string) => {
            if (nevermind) {
                return;
            }
            const response: string = await checkoutChecker(`What is your ${target}?\n`, billingInfoPatterns[`${target}`]);
            if (response === "exit") {
                nevermind = true;
            } else {
                billingInfo[`${target}`] = response;
            }
        });
        if (nevermind) {
            return;
        }
    } else if (sameAsContact === "exit") {
        return;
    } else {
        Object.keys(contactInfo).forEach((key: string) => {
            billingInfo[`${key}`] = contactInfo[`${key}`];
        });
        await asyncForEach(["cardNumber", "cvv", "expiryDate"], async (target: string) => {
            if (nevermind) {
                return;
            }
            const response = await checkoutChecker(`What is your ${target}?\n`, billingInfoPatterns[`${target}`]);
            if (response === "exit") {
                nevermind = true;
            } else {
                billingInfo[`${target}`] = response;
            }
        });
        if (nevermind) {
            return;
        }
    }

    // TODO INSERT INTO orders
    // TODO deduct copies from bookstore
    // TODO increase bookstore's cash
    // TODO randomly advance orders (e.g. warehouse -> in china -> at border -> arrived)
    const placeholder: string = "100";
    userCart = [];
    console.log(`Your order number is ${placeholder}`);
};
const checkoutChecker: (prompt: string, pattern: string) => Promise<string> = async (prompt: string, pattern: string) => {
    let input: string = "";
    while (true) {
        input = (await askQuestion(prompt)).trim();
        if (input === "exit") {
            return "exit";
        } else if (input.search(pattern) === 0) {
            return input;
        } else {
            console.log(`Bad format: ${input} vs ${pattern}`);
        }
    }
};

// REPLs for the program
const loggedInRepl: (username: string) => Promise<void> = async (username: string) => {
    let command: string = "";
    // TODO good help strings for differnt modes
    const help: string = `${userHelp}${ownerMode ? ownerHelp : ""}`;
    console.log(help);
    while (command.toLowerCase() !== "exit") {
        const input: string[] = (await askQuestion(`${username}${ownerMode ? "[OWNER]" : ""}> `)).trim().toLowerCase().split(" ");
        command = input[0];
        const argv: string[] = input.splice(1);

        if (command === "help") {
            console.log(help);
        } else if (command === "search") {
            await search();
        } else if (command === "turn") {
            await turn(argv);
        } else if (command === "order") {
            // TODO look at previous orders' statuses
            let queryText: string = `SELECT * FROM orders${ownerMode ? "" : `WHERE username = ${username}`}`;
            let dbRes: Postgres.QueryResult;
            if (argv.length === 1) {
                queryText = `${queryText} ${ownerMode ? "WHERE" : "AND"} id = $1`;
                console.log(queryText);
                dbRes = await pgClient.query(queryText, [argv[0]]);
            } else {
                console.log(queryText);
                dbRes = await pgClient.query(queryText);
            }
            console.log(dbRes.rows);
        } else if (command === "cart") {
            userCart = await browseBooks(userCart, true);
        } else if (command === "checkout") {
            await checkout();
        } else if (command === "money" && ownerMode) {
            // TODO display money
        } else if (command === "add" && ownerMode) {
            // TODO add new book to bookstore
        } else if (command === "publishers" && ownerMode) {
            // TODO view publishers
            // TODO automatically "email" publishers when stock of a certain book falls beneath 10
        } else if (command === "metrics" && ownerMode) {
            // TODO show metrics (sales vs expenses, sales per genre, sales per author)
        }
    }
};
const mainRepl: () => void = async () => {
    let command: string = "";
    const prompt: string = `Welcome to this "online" bookstore. You may [search, login, register] or request [help]:\n> `;
    while (command.toLowerCase() !== "exit") {
        const input: string[] = (await askQuestion(command === "turn" ? "> " : prompt)).trim().toLowerCase().split(" ");
        command = input[0];
        const argv: string[] = input.splice(1);

        if (command === "login") {
            const username = (await askQuestion("What is your username?\n> ")).trim();
            // just gonna leave their password right out in the open
            // their passwords are also stored in plaintext
            const password = (await askQuestion("What is the password?\n> ")).trim();
            const dbRes = await pgClient.query(`SELECT * FROM users WHERE username = '${username}' AND not_salty_password = '${password}'`);
            if (dbRes.rows.length === 1) {
                const loggedIn = dbRes.rows[0];
                guestMode = false;
                ownerMode = loggedIn.admin_account;
                userCart = [];
                await loggedInRepl(loggedIn.username);
                guestMode = true;
                ownerMode = false;
            } else {
                console.error("Sorry, you're not in the database (which means you should make a new user), or the password you entered is not the correct one.");
            }
        } else if (command === "register") {
            // TODO add contact info on registration
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
        } else if (command === "search") {
            await search();
        } else if (command === "turn") {
            await turn(argv);
        } else if (command === "help") {
            console.log(`Search Commands For Guests:\n${searchHelp}`);
        }
    }
    console.log("Exiting");
    process.exit(0);
};

// public static void main(String[] args) {
mainRepl();
