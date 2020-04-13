import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

// Types
declare interface Book {
    author_name: string;
    book_name: string;
    count: number;
    genre: string;
    isbn: string;
    pages: number;
    price: number;
    publisher: string;
    royalty: number;
}
declare interface Publisher {
    banking_account: number;
    email: string;
    phone_number: string;
    publisher_address: string;
    publisher_name: string;
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

// Globals
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
const validators = {
    book: {
        author_name: "^.+$",
        book_name: "^.+$",
        count: "^\\d+$",
        genre: "^.+$",
        isbn: "^\\d{3}-\\d{10}$",
        pages: "^\\d+$",
        price: "^\\d+\\.\\d{2}$",
        publisher: "^.+$",
        royalty: "^\\d\.\\d{2}$",
    },
    info: {
        address: "^\\d+ [A-Z][a-z]+ [A-Z][a-z]+$",
        cardNumber: "^\\d{16}$",
        city: "^[A-Za-z\\-]+$",
        cvv: "^\\d{3}$",
        expiryDate: "^\\d{2}/\\d{2}$",
        firstName: "^[A-Za-z]+$",
        lastName: "^[A-Za-z]+$",
        phone: "^\\d{3}-\\d{3}-\\d{4}$",
        postalCode: "^[A-Z]\\d[A-Z] \\d[A-Z]\\d$",
    },
    publisher: {
        banking_account: "^\\d+$",
        email: "^.+@.+\\..+$",
        phone_number: "^\\d{3}-\\d{3}-\\d{4}$",
        publisher_address: "^\\d+ [A-Z][a-z]+ [A-Z][a-z]+$",
        publisher_name: "^.+$"
    },
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

let currentUser: string = "";
let guestMode: boolean = true;
let ownerMode: boolean = false;
let userCart: Book[] = [];

// Useful Functions
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
    const dbRes: Postgres.QueryResult = await pgClient.query(queryText);
    const books: Book[] = dbRes.rows;
    if (books.length === 0) {
        console.log("No books with specified search options found.");
    } else {
        const newCart: Book[] = await browseBooks(books, false);
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
    const cart: Book[] = (inCart || ownerMode) ? books : [];
    let bookIndex: number = 0;
    let bookInfo: string = books.length !== 0 ? bookInfoTemplate(books, bookIndex) : "No books in your cart.";
    let browsingCommand: string = "";
    while (browsingCommand !== "exit") {
        console.clear();
        const prompt: string = `Viewing the ${ownerMode ? "books in the bookstore" : (inCart ? "books in your cart" : "found books")}.
        "next" or "prev" for next/previous book.\
${ownerMode ? `\n\t"add" to add a new book to the bookstore.` : ((guestMode || inCart) ? "" : `\n\t"add" to add current book to cart.`)}\
${ownerMode ? `\n\t"drop" to remove current book from the bookstore.` : (inCart ? `\n\t"drop" to remove current book from cart.` : "")}
        "exit" to exit.\n${bookInfo}\n`;

        browsingCommand = (await askQuestion(prompt)).trim().toLowerCase();
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
        } else if (browsingCommand === "add" && !(guestMode || inCart)) {
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
            bookInfo += `\nAdded "${addToCart.book_name}" to cart.`;
        } else if (browsingCommand === "drop") {
            if (inCart && cart.length !== 0) {
                const dropFromCart = cart.splice(bookIndex, 1)[0];
                if (bookIndex === cart.length) {
                    bookIndex--;
                }
                if (cart.length !== 0) {
                    bookInfo = bookInfoTemplate(cart, bookIndex);
                } else {
                    bookInfo = `No more books in your cart.`;
                }
                bookInfo += `\nDropped "${dropFromCart.book_name}" from your cart.`;
            } else if (ownerMode) {
                const confirm: boolean = (await askQuestion("Really remove this book from the bookstore (yes, no)?\n")).trim().toLowerCase() === "yes";
                if (confirm) {
                    const bookToDelete: Book = cart.splice(bookIndex, 1)[0];
                    if (bookIndex === cart.length) {
                        bookIndex--;
                    }
                    if (cart.length !== 0) {
                        bookInfo = bookInfoTemplate(cart, bookIndex);
                    } else {
                        bookInfo = `No more books from your search.`;
                    }
                    const dbRes: Postgres.QueryResult = await pgClient.query(`DELETE FROM book WHERE isbn = '${bookToDelete.isbn}'`);
                    bookInfo += `\nDeleted "${bookToDelete.book_name}" from the bookstore.`;
                }
            }
        }
    }
    return cart;
};
const checkout: () => Promise<void> = async () => {
    let shippingInfo: ContactInfo = {
        address: "",
        city: "",
        firstName: "",
        lastName: "",
        phone: "",
        postalCode: ""
    };
    let billingInfo: BillingInfo = {
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

    console.log(`Beginning the checkout process. Follow the prompts, and type "exit" to exit anytime.`);
    let gotInfo: any;
    let sameInfo: string = (await askQuestion(`Is your shipping info the same as your contact info (yes, no)?\n`)).trim().toLowerCase();
    if (sameInfo === "yes") {
        // TODO copy user's contact info over
    } else if (sameInfo === "exit") {
        return;
    } else {
        // else assume "no"
        gotInfo = await getInfo(shippingInfo, Object.keys(shippingInfo), true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            shippingInfo = gotInfo;
        }
    }

    sameInfo = (await askQuestion(`Is your billing info the same as your contact/shipping info (contact/shipping/neither)?\n`)).trim().toLowerCase();
    if (sameInfo === "contact") {
        // TODO copy user's contact info over
    } else if (sameInfo === "shipping") {
        Object.keys(shippingInfo).forEach((key: string) => {
            billingInfo[`${key}`] = shippingInfo[`${key}`];
        });
        gotInfo = await getInfo(billingInfo, ["cardNumber", "cvv", "expiryDate"], true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            billingInfo = gotInfo;
        }
    } else {
        // else assume "neither"
        gotInfo = await getInfo(billingInfo, Object.keys(billingInfo), true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            billingInfo = gotInfo;
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
const getInfo: (info: any, targets: string[], cancellable: boolean, validator: string) => any = async (info: any, targets: string[], cancellable: boolean, validator: string) => {
    let nevermind: boolean = false;
    let correctInfo: boolean = false;
    while (!correctInfo) {
        await asyncForEach(targets, async (target: string) => {
            if (nevermind) {
                return;
            }
            const response: string = await checkoutChecker(`What is the ${target}?\n`, validators[`${validator}`][`${target}`]);
            if (response === "exit" && cancellable) {
                nevermind = true;
            } else {
                info[`${target}`] = response;
            }
        });

        targets.forEach((target) => {
            const field = `Your ${target} is:`;
            console.log(`${field}${field.length < 16 ? "\t\t\t" : "\t\t"}${info[`${target}`]}`);
        });
        correctInfo = (await askQuestion("Are these fields correct (yes, no)?\n")).trim().toLowerCase() === "yes";
    }
    return info;
};
const publisherInfoTemplate: (publishers: Publisher[], publisherIndex: number) => string = (publishers: Publisher[], publisherIndex: number) => {
    const publisher: Publisher = publishers[publisherIndex];
    return `Publisher ${publisherIndex + 1} of ${publishers.length}

    Name:\t\t${publisher.publisher_name}
    Address:\t\t${publisher.publisher_address}
    Email:\t\t${publisher.email}
    Phone:\t\t${publisher.phone_number}
    Banking Account:\t${publisher.banking_account}`;
};

// REPLs for the program
const loggedInRepl: () => Promise<void> = async () => {
    let command: string = "";
    // TODO good help strings for differnt modes
    const help: string = `${userHelp}${ownerMode ? ownerHelp : ""}`;
    console.log(help);
    while (command.toLowerCase() !== "exit") {
        const rawInput = await askQuestion(`${currentUser}${ownerMode ? "[OWNER]" : ""}> `);
        const input: string[] = rawInput.trim().toLowerCase().split(" ");
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
            let queryText: string = `SELECT * FROM orders${ownerMode ? "" : `WHERE username = ${currentUser}`}`;
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
        } else if (command === "cart" !ownerMode) {
            userCart = await browseBooks(userCart, true);
        } else if (command === "checkout") {
            await checkout();
        } else if (command === "money" && ownerMode) {
            // TODO display money
        } else if (command === "add" && ownerMode) {
            const newBook: Book = {
                author_name: "",
                book_name: "",
                count: -1,
                genre: "",
                isbn: "",
                pages: -1,
                price: 0,
                publisher: "",
                royalty: 0,
            };
            console.clear();
            console.log(`Beginning the addition of a new book process. Follow the prompts, and type "exit" to exit anytime.\n`);
            let gotInfo: any = await getInfo(newBook, Object.keys(newBook), true, "book");
            if (gotInfo !== "exit") {
                // TODO check if have enough cash on hand to order $count copies of new
                const values: any = Object.keys(gotInfo).map((key: string) => {
                    if (key === "count" || key === "pages") {
                        return parseInt(gotInfo[`${key}`], 10);
                    } else if (key === "price" || key === "royalty") {
                        return parseFloat(gotInfo[`${key}`]);
                    } else {
                        return gotInfo[`${key}`];
                    }
                });
                let publisherExists: boolean = (await pgClient.query(`SELECT EXISTS (SELECT * FROM publisher WHERE publisher_name = '${gotInfo.publisher}')`)).rows[0].exists;
                if (!publisherExists) {
                    const newPublisher: Publisher = {
                        banking_account: -1,
                        email: "",
                        phone_number: "",
                        publisher_address: "",
                        publisher_name: gotInfo.publisher,
                    };
                    console.log("Seems like this book has a new publisher. You should add information for this publisher for the purpose of paying royalties, buying new copies of books, etc.");
                    gotInfo = await getInfo(newPublisher, ["banking_account", "email", "phone_number", "publisher_address"], false, "publisher");
                    if (gotInfo !== "exit") {
                        gotInfo.banking_account = parseInt(gotInfo.banking_account, 10);
                        gotInfo.publisher_name = newPublisher.publisher_name;
                        await pgClient.query(`INSERT INTO publisher VALUES ($1, $2, $3, $4, $5)`, Object.values(gotInfo));
                        publisherExists = true;
                        console.log(`Added "${newPublisher.publisher_name}" to the list of publishers.`);
                    }
                }
                if (publisherExists) {
                    await pgClient.query(`INSERT INTO book VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, values);
                    console.log(`Added "${newBook.book_name}" to the bookstore.`);
                }
            }
        } else if (command === "publisher" && ownerMode) {
            let queryText: string = `SELECT * FROM publisher`;
            if (argv.length === 0) {
                const publishers: any = (await pgClient.query(queryText)).rows;
                if (publishers.length !== 0) {
                    let publisherBrowseCommand: string = "";
                    let publisherIndex: number = 0;
                    let publisherInfo: string = publisherInfoTemplate(publishers, publisherIndex);
                    while (publisherBrowseCommand !== "exit") {
                        console.clear();
                        const publisherPrompt: string = `Viewing all publishers.\n"next" or "prev" for next/previous publisher.\n"exit" to exit.\n${publisherInfo}\n`;
                        publisherBrowseCommand = (await askQuestion(publisherPrompt)).trim().toLowerCase();
                        if (publisherBrowseCommand === "next") {
                            if (publisherIndex < publishers.length - 1) {
                                publisherIndex++;
                                publisherInfo = publisherInfoTemplate(publishers, publisherIndex);
                            } else if (publisherInfo[publisherInfo.length - 1] !== "!") {
                                publisherInfo += `\nNo next publisher!`;
                            }
                        } else if (publisherBrowseCommand === "prev") {
                            if (publisherIndex > 0) {
                                publisherIndex--;
                                publisherInfo = publisherInfoTemplate(publishers, publisherIndex);
                            } else if (publisherInfo[publisherInfo.length - 1] !== "!") {
                                publisherInfo += `\nNo previous publisher!`;
                            }
                        }
                    }
                } else {
                    console.log("No publishers found");
                }
            } else {
                if (argv[0].charAt(0) !== `"` || argv[argv.length - 1].charAt(argv[argv.length - 1].length - 1) !== `"`) {
                    console.log("Please enclose the publisher's name in double quotes.");
                } else {
                    const publisherName: string = rawInput.substring(rawInput.indexOf('"') + 1, rawInput.lastIndexOf('"'));
                    queryText = `${queryText} WHERE publisher_name = '${publisherName}'`;
                    const dbRes: Postgres.QueryResult = await pgClient.query(queryText);
                    if (dbRes.rows.length !== 0) {
                        console.log(publisherInfoTemplate(dbRes.rows, 0));
                    } else {
                        console.log(`No publisher with the name "${publisherName}" found.`);
                    }
                }
            }
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
                currentUser = loggedIn.username;
                await loggedInRepl();
                guestMode = true;
                ownerMode = false;
            } else {
                console.error("Sorry, you're not in the database (which means you should make a new user), or the password you entered is not the correct one.");
            }
        } else if (command === "register") {
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
                console.log("We will also need your contact info.");
                let contactInfo: ContactInfo = {
                    address: "",
                    city: "",
                    firstName: "",
                    lastName: "",
                    phone: "",
                    postalCode: ""
                };
                contactInfo = await getInfo(contactInfo, Object.keys(contactInfo), false, "info");

                // await pgClient.query("INSERT INTO users (username, not_salty_password, admin_account) VALUES ($1, $2, $3)", [newUsername, password, false]);
                // TODO insert this contact info into DB
                console.log("A new user has been added to the database.\n");
            } else {
                console.log("Cancelled registration.");
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
