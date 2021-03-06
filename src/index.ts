import Postgres from "pg";
import readline from "readline";
import auth = require("./auth.json");

/* Types for DB tuples */
declare interface ContactInfo {
    id: number;
    street: string;
    city: string;
    zip: string;
    phone: string;
    first_name: string;
    last_name: string;
}
declare interface BillingInfo extends ContactInfo {
    card_number: string;
    cvv: string;
    expiry: string;
}
declare interface BookstoreUser {
    user_name: string;
    pass: string;
    superuser: boolean;
    contact_info_id: number;
    billing_info_id: number;
}
declare interface Purchase {
    purchase_number: number;
    purchase_status: string;
    total: number;
    destination_id: number;
    billing_id: number;
}
declare interface Publisher {
    publisher_name: string;
    street: string;
    city: string;
    zip: string;
    email: string;
    phone: string;
}
declare interface Book {
    isbn: string;
    book_name: string;
    author: string;
    genre: string;
    publisher: string;
    price: string;
    pages: number;
    stock: number;
    royalty: number;
}

/* Globals */
const pgClient: Postgres.Client = new Postgres.Client(auth.pg);
pgClient.connect();

const searchQueryTypes = {
    author: false,
    book_name: false,
    genre: true,
    pages: false,
    price: false,
    publisher: false,
};
// regexes to prevent users from entering bad input
const validators = {
    book: {
        isbn: "^\\d{3}-\\d{10}$",
        book_name: "^.+$",
        author: "^.+$",
        genre: "^.+$",
        publisher: "^.+$",
        price: "^\\d+\\.\\d{2}$",
        pages: "^\\d+$",
        stock: "^\\d+$",
        royalty: "^\\d\.\\d{2}$",
    },
    info: {
        street: "^.+$",
        city: "^.+$",
        zip: "^[A-Z]\\d[A-Z] \\d[A-Z]\\d$",
        phone: "^\\d{3}-\\d{3}-\\d{4}$",
        first_name: "^.+$",
        last_name: "^.+$",
        card_number: "^\\d{16}$",
        cvv: "^\\d{3}$",
        expiry: "^\\d{2}/\\d{2}$",
    },
    publisher: {
        publisher_name: "^.+$",
        street: "^.+$",
        city: "^.+$",
        zip: "^[A-Z]\\d[A-Z] \\d[A-Z]\\d$",
        email: "^.+@.+$",
        phone: "^\\d{3}-\\d{3}-\\d{4}$",
    },
};

const guestHelp: string = `
Commands:
    - help
        Show this again.

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
Commands:
    - help
        Show this again.

    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [bookname]

    - turn <query type> [on|off]
        'on' means that you will be prompted for that query type in a book search.
        'off' means that you will not be prompted for that query type in a book search (i.e. auto-ignore).
        Available query types: [authorname, bookname, genre, pages, price, publisher].

    - cart
        Look at books in your cart and modify quantities.

    - checkout
        Checks out your cart.

    - purchase [number]
        Specifying a number will show that purchase only.
        No number will list all of your orders.

    - exit
        Logs out.
`;
const ownerHelp: string = `
Commands:
    - help
        Show this again.

    - search
        Begin a book search, in which a sequence of query types prompts will be shown.
        Entering nothing for a query type will mean it is ignored in the search.
        Default 'on' query types are [genre]

    - turn <query type> [on|off]
        'on' means that you will be prompted for that query type in a book search.
        'off' means that you will not be prompted for that query type in a book search (i.e. auto-ignore).
        Available query types: [authorname, bookname, genre, pages, price, publisher].

    - purchase [number]
        Specifying a number will show that purchase only.
        No number will list all of your orders.

    - add
        Add a new book to your bookstore.
        Prompts you for all the required fields.
        Also prompts you to add a new publisher, if needed.

    - publisher [name]
        View info for given publisher, or all of them if name is omitted.

    - sales <per|vs> <author|genre|expenses>
        Shows sales per author, sales per genre, sales per expenses.

    - exit
        Logs out.
`;

const scanner: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let currentUser: string = "";
let guestMode: boolean = true;
let ownerMode: boolean = false;
let inCart: boolean = false;
let userCart: Book[] = [];

/* Useful Functions */
// returns user input based on given prompt
const askQuestion: (prompt: string) => Promise<string> = (prompt: string) => {
    return new Promise<string>((resolve) => {
        scanner.question(prompt, resolve);
    });
};
// Array.prototype.forEach, but asynchronous
const asyncForEach: (array: any[], callback: any) => Promise<void> = async (array: any[], callback: any) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};
// Prompts the user about field inputs for the enabled fields
// default enabled fields is just genre
const search: () => Promise<void> = async () => {
    const searchOptions = {};

    // get field input for all the enabled fields
    await asyncForEach(Object.keys(searchQueryTypes), async (queryType: string) => {
        if (searchQueryTypes[`${queryType}`]) {
            searchOptions[`${queryType}`] = (await askQuestion(`${queryType}?\n`)).trim();
        }
    });

    // construct query text
    let queryText = `SELECT * FROM book`;
    if (Object.keys(searchOptions).length !== 0) {
        const queryTextHelper = [];
        Object.keys(searchOptions).forEach((queryType) => {
            queryTextHelper.push(`${queryType} = '${searchOptions[`${queryType}`]}'`);
        });
        queryText = `${queryText} WHERE ${queryTextHelper.join(" AND ")}`;
    }

    const dbRes: Postgres.QueryResult = await pgClient.query(queryText);
    let books: Book[] = dbRes.rows;
    if (books.length === 0) {
        console.log("No books with specified search options found.");
    } else {
        // when books are removed from the shelves, we set their stock to -1, and we encode a stock of -1 to be "off the shelves"
        // the tuple must remain because we still need to see the price of off the shelf books when looking at orders
        books = books.map((book) => {
            if (book.stock !== -1) {
                return book;
            }
        });
        await browseBooks(books);
    }
};
// enables/disable book search fields
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
// displays book information nicely, from a "SELECT * FROM book"-like query
const bookInfoTemplate: (books: Book[], bookIndex: number) => string = (books: Book[], bookIndex: number) => {
    const book: Book = books[bookIndex];
    const baseBookInfo = `
Book ${bookIndex + 1} of ${books.length}

    Name:\t\t${book.book_name}
    Author:\t\t${book.author}
    Genre:\t\t${book.genre}
    Publisher:\t\t${book.publisher}
    Price:\t\t${book.price}
    Pages:\t\t${book.pages}
    Stock:\t\t${book.stock} Copies ${inCart ? "In Cart" : "Remaining"}`;

    const ownerBookInfo = `

    Royalty:\t\t${book.royalty * 100}%`;

    return `${baseBookInfo}${ownerMode ? ownerBookInfo : ""}`;
};
// displays purchase information nicely, from a "SELECT * FROM purchase"-like query
const purchaseInfoTemplate: (purchases: Purchase[], purchase: number) => string = (purchases: Purchase[], purchaseIndex: number) => {
    const purchase: Purchase = purchases[purchaseIndex];
    const basePurchaseInfo = `
    Purchase ${purchaseIndex + 1} of ${purchases.length}

    Purchase Number:\t\t${purchase.purchase_number}
    Purchase Status:\t\t${purchase.purchase_status}
    Total:\t\t\t${purchase.total}
    Destination ID:\t\t${purchase.destination_id}
    Billing ID:\t\t\t${purchase.billing_id}`;

    return `${basePurchaseInfo}`;
};
// browses given array of books with "next"+Enter and "prev"+Enter
// lets regular users add books to their cart
// lets owners remove books from the shelves
// this function is used to browse book search results and the contents of a user's cart
const browseBooks: (books: Book[]) => Promise<void> = async (books: Book[]) => {
    const cart: Book[] = (inCart || ownerMode) ? books : userCart;
    let bookIndex: number = 0;
    let bookInfo: string = books.length !== 0 ? bookInfoTemplate(books, bookIndex) : "No books in your cart.";
    let browsingCommand: string = "";
    let argv: string[] = [];
    while (browsingCommand !== "exit") {
        console.clear();

        const prompt: string = `Viewing the ${ownerMode ? "books in the bookstore" : (inCart ? "books in your cart" : "found books")}.
        "next" or "prev" for next/previous book.\
${(guestMode || inCart) ? "" : `\n\t"add <count>" to add <count> copies of current book to cart.`}\
${ownerMode ? `\n\t"drop" to remove current book from the "shelves".` : (inCart ? `\n\t"drop <count>" to remove <count> copies of current book from cart.` : "")}
        "exit" to exit.${!ownerMode ? `\n\tTotal price of added books in cart: $${getTotalPrice(cart)}` : ""}\n${bookInfo}\n`;

        argv = (await askQuestion(prompt)).trim().toLowerCase().split(" ");
        browsingCommand = argv[0];
        argv = argv.splice(1);

        if (browsingCommand === "next" && (inCart ? cart.length !== 0 : books.length !== 0)) {
            // if "next", goes to next book in cart/search result, if there is a next book
            if (bookIndex < (inCart ? cart.length - 1 : books.length - 1)) {
                bookIndex++;
                bookInfo = bookInfoTemplate(inCart ? cart : books, bookIndex);
            } else if (bookInfo[bookInfo.length - 1] !== "!") {
                bookInfo += "\nNo next book!";
            }
        } else if (browsingCommand === "prev" && (inCart ? cart.length !== 0 : books.length !== 0)) {
            // if "prev", goes to previous book in cart/search result, if there is a previous book
            if (bookIndex > 0) {
                bookIndex--;
                bookInfo = bookInfoTemplate(inCart ? cart : books, bookIndex);
            } else if (bookInfo[bookInfo.length - 1] !== "!") {
                bookInfo += "\nNo previous book!";
            }
        } else if (browsingCommand === "add" && !(guestMode || inCart || ownerMode)) {
            // only for browsing search result
            // if "add", add one copy of the current book
            // if "add <number>", add that many
            let addCount: number = 1;
            if (argv.length !== 0) {
                addCount = parseInt(argv[0], 10);
            }
            if (!isNaN(addCount) && addCount > 0) {
                const referenceBook: Book = books[bookIndex];
                if (addCount <= referenceBook.stock) {
                    const bookToAdd: Book = {
                        isbn: referenceBook.isbn,
                        book_name: referenceBook.book_name,
                        author: referenceBook.author,
                        genre: referenceBook.genre,
                        publisher: referenceBook.publisher,
                        price: referenceBook.price,
                        pages: referenceBook.pages,
                        stock: addCount,
                        royalty: referenceBook.royalty
                    };
                    referenceBook.stock -= addCount;
                    cart.push(bookToAdd);
                    bookInfo = bookInfoTemplate(books, bookIndex);
                    bookInfo += `\nAdded ${addCount} ${addCount === 1 ? "copy" : "copies"} of "${bookToAdd.book_name}" to cart.`;
                } else {
                    bookInfo = bookInfoTemplate(books, bookIndex);
                    bookInfo += `\nThere isn't enough stock of this book to add ${addCount} ${addCount === 1 ? "copy" : "copies"} to your cart.`;
                }
            } else {
                bookInfo = bookInfoTemplate(books, bookIndex);
                bookInfo += `\n"add ${argv[0]}" is invalid.`;
            }
        } else if (browsingCommand === "drop") {
            if (inCart && cart.length !== 0) {
                let dropCount: number = 1;
                if (argv.length !== 0) {
                    dropCount = parseInt(argv[0], 10);
                }
                const referenceBook: Book = cart[bookIndex];
                if (!isNaN(dropCount) && dropCount > 0 && dropCount <= referenceBook.stock) {
                    referenceBook.stock -= dropCount;
                    bookInfo = bookInfoTemplate(cart, bookIndex);
                    if (referenceBook.stock === 0) {
                        cart.splice(bookIndex, 1);
                        if (bookIndex === cart.length) {
                            bookIndex--;
                        }
                        if (cart.length !== 0) {
                            bookInfo = bookInfo = bookInfoTemplate(cart, bookIndex);
                        } else {
                            bookInfo = `No more books in your cart.`;
                        }
                    }
                    bookInfo += `\nDropped ${dropCount} ${dropCount === 1 ? "copy" : "copies"} of "${referenceBook.book_name}" from your cart.`;
                } else {
                    bookInfo = bookInfoTemplate(books, bookIndex);
                    bookInfo += `\n"drop ${argv[0]}" is invalid.`;
                }
            } else if (ownerMode) {
                const confirm: boolean = (await askQuestion(`Really remove this book from the "shelves" (yes, no)?\n`)).trim().toLowerCase() === "yes";
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
                    await pgClient.query(`UPDATE book SET stock = -1 WHERE isbn = '${bookToDelete.isbn}'`);
                    bookInfo += `\nRemoved "${bookToDelete.book_name}" from the "shelves".`;
                }
            }
        }
    }
    userCart = cart;
};
// browses an array of purchases with "next" and "prev"
const browsePurchases: (purchases: Purchase[]) => Promise<void> = async (purchases: Purchase[]) => {
    let purchaseIndex = 0;
    let purchaseInfo: string = purchases.length === 0 ? "No purchases have been made." : purchaseInfoTemplate(purchases, purchaseIndex);
    let browsingCommand: string = "";
    let argv: string[] = [];
    while (browsingCommand !== "exit") {
        console.clear();

        const prompt: string = `Viewing ${guestMode ? `purchase history for ${currentUser}` : "the purchase history"}.
        "next" or "prev" for next/previous purchase.\n${purchaseInfo}\n`;

        argv = (await askQuestion(prompt)).trim().toLowerCase().split(" ");
        browsingCommand = argv[0];
        argv = argv.splice(1);

        if (browsingCommand === "next" && (purchases.length !== 0)) {
            if (purchaseIndex < (purchases.length - 1)) {
                purchaseIndex++;
                purchaseInfo = purchaseInfoTemplate(purchases, purchaseIndex);
            } else if (purchaseInfo[purchaseInfo.length - 1] !== "!") {
                purchaseInfo += "\nNo next purchase!";
            }
        } else if (browsingCommand === "prev" && (purchases.length !== 0)) {
            if (purchaseIndex > 0) {
                purchaseIndex--;
                purchaseInfo = purchaseInfoTemplate(purchases, purchaseIndex);
            } else if (purchaseInfo[purchaseInfo.length - 1] !== "!") {
                purchaseInfo += "\nNo previous purchase!";
            }
        }
    }
};
// checks out a user's cart
// demands a destination, which can be the user's registration address or not
// demands a billing address, which can be the destination's or user's registration addresses
// removes stock from the bookstore for bought books and inserts other needed tuples
const checkout: () => Promise<void> = async () => {
    // don't checkout if cart is empty
    if (userCart.length === 0) {
        console.log("Your cart is empty.");
        return;
    }

    // hashmap of isbn to book (of books in cart, to be sold)
    const soldBooks = {};
    userCart.forEach((book: Book) => {
        soldBooks[`${book.isbn}`] = book;
    });

    // first, validate that bookstore has enough stock for what's in userCart
    let queryText: string = `SELECT * FROM book WHERE isbn = '${Object.keys(soldBooks).join(`' OR isbn = '`)}'`;
    const targetBooks: Book[] = (await pgClient.query(queryText)).rows;
    targetBooks.forEach((targetBook: Book) => {
        const bookInCart: Book = soldBooks[`${targetBook.isbn}`];
        if (bookInCart.stock > targetBook.stock) {
            console.log(`Unfortunately, here are only ${targetBook.stock} ${targetBook.stock === 1 ? "copy" : "copies"}\
of ${bookInCart.book_name}, and you wish to buy ${bookInCart.stock} ${bookInCart.stock === 1 ? "copy" : "copies"} of it.
Please edit your cart accordingly.`);
            return;
        }
    });

    let destinationInfo: ContactInfo = {
        id: 0,
        street: "",
        city: "",
        zip: "",
        first_name: "",
        last_name: "",
        phone: ""
    };
    let billingInfo: BillingInfo = {
        id: 0,
        street: "",
        city: "",
        zip: "",
        first_name: "",
        last_name: "",
        phone: "",
        card_number: "",
        cvv: "",
        expiry: ""
    };
    console.log(`Beginning the checkout process. Follow the prompts, and type "exit" to exit any time.`);
    let gotInfo: any;

    // get destination address
    let sameInfo: string = (await askQuestion(`Is the destination the same as your default contact info (yes, no)?\n`)).trim().toLowerCase();
    if (sameInfo === "yes") {
        // if "same as registration contact info", grab that
        destinationInfo = (await pgClient.query(`SELECT * FROM contact_info WHERE id = (SELECT contact_info_id FROM bookstore_user WHERE user_name = '${currentUser}')`)).rows[0];
    } else if (sameInfo === "exit") {
        return;
    } else {
        // else assume "no", which means user enters a new contact info, which needs to be inserted
        gotInfo = await getInfo(destinationInfo, objectDifference(destinationInfo, ["id"], "keys"), true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            // we need the id of this new contact info, to be used later when inserting a new purchase
            queryText = `INSERT INTO contact_info (street, city, zip, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
            destinationInfo = (await pgClient.query(queryText, objectDifference(gotInfo, ["id"], "values"))).rows[0];
        }
    }

    // get billing address
    sameInfo = (await askQuestion(`Is your billing info the same as your default billing/contact info, or the same address as the destination (billing/contact/destination/none)?\n`)).trim().toLowerCase();
    if (sameInfo === "billing") {
        // if "same as registration billing info", grab that
        billingInfo = (await pgClient.query(`SELECT * FROM billing_info WHERE id = (SELECT billing_info_id FROM bookstore_user WHERE user_name = '${currentUser}')`)).rows[0];
    } else if (sameInfo === "contact") {
        // if "same as registration contact info", grab that
        // then fill out card information
        const defaultContactInfo: ContactInfo = (await pgClient.query(`SELECT * FROM contact_info WHERE id = (SELECT contact_info_id FROM bookstore_user WHERE user_name = '${currentUser}')`)).rows[0];
        Object.keys(defaultContactInfo).forEach((key: string) => {
            billingInfo[`${key}`] = defaultContactInfo[`${key}`];
        });
        gotInfo = await getInfo(billingInfo, ["card_number", "cvv", "expiry"], true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            // then insert a new tuple into billing info, and keep the new id to be used later when inserting a new purchase
            queryText = `INSERT INTO billing_info (street, city, zip, first_name, last_name, phone, card_number, cvv, expiry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
            billingInfo = (await pgClient.query(queryText, objectDifference(gotInfo, ["id"], "values"))).rows[0];
        }
    } else if (sameInfo === "destination") {
        // if "same as destination address", copy what was just entered earlier, and fill out card information
        Object.keys(destinationInfo).forEach((key: string) => {
            billingInfo[`${key}`] = destinationInfo[`${key}`];
        });
        gotInfo = await getInfo(billingInfo, ["card_number", "cvv", "expiry"], true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            // then insert a new tuple into billing info, and keep the new id to be used later when inserting a new purchase
            queryText = `INSERT INTO contact_info (street, city, zip, first_name, last_name, phone, card_number, cvv, expiry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
            billingInfo = (await pgClient.query(queryText, objectDifference(gotInfo, ["id"], "values"))).rows[0];
        }
    } else {
        // else assume "neither"
        // fill out entire billing info
        gotInfo = await getInfo(billingInfo, objectDifference(billingInfo, ["id"], "keys"), true, "info");
        if (gotInfo === "exit") {
            return;
        } else {
            // then insert a new tuple into billing info, and keep the new id to be used later when inserting a new purchase
            queryText = `INSERT INTO contact_info (street, city, zip, first_name, last_name, phone, card_number, cvv, expiry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
            billingInfo = (await pgClient.query(queryText, objectDifference(gotInfo, ["id"], "values"))).rows[0];
        }
    }

    // create a new purchase tuple
    queryText = `INSERT INTO purchase (purchase_status, total, destination_id, billing_id) VALUES ($1, $2, $3, $4) RETURNING *`;
    const newPurchase: Purchase = (await pgClient.query(queryText, ["At our warehouse.", getTotalPrice(userCart), destinationInfo.id, billingInfo.id])).rows[0];

    // create a new user_purchase tuple
    queryText = `INSERT INTO user_purchase VALUES ('${currentUser}', ${newPurchase.purchase_number}) RETURNING *`;
    await pgClient.query(queryText);

    // update stock of sold books
    asyncForEach(targetBooks, async (targetBook: Book) => {
        const bookInCart: Book = soldBooks[`${targetBook.isbn}`];
        // no need to check if enough stock, because did that ~100 lines ago
        queryText = `UPDATE book SET stock = ${targetBook.stock - bookInCart.stock} WHERE isbn = '${targetBook.isbn}'`;
        await pgClient.query(queryText);
    });

    // create new purchase_book tuples
    asyncForEach(Object.values(soldBooks), async (soldBook: Book) => {
        const quantity: number = soldBook.stock;
        const price: number = parseFloat(soldBook.price.substring(1));
        const royaltiesPaid: number = Math.round(quantity * price * soldBook.royalty * 100) / 100;
        const revenue: number = (Math.round(quantity * price * 100) / 100) - royaltiesPaid;
        queryText = `INSERT INTO purchase_book VALUES (${newPurchase.purchase_number}, '${soldBook.isbn}', ${royaltiesPaid}, ${revenue}, ${quantity})`;
        await pgClient.query(queryText);
    });

    // empty userCart
    userCart = [];
    console.log(`Your purchase number is ${newPurchase.purchase_number}.`);
};
// demands an input that agrees with the given regex pattern, then returns when passes
const inputChecker: (prompt: string, pattern: string) => Promise<string> = async (prompt: string, pattern: string) => {
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
// assign values for all the keys in the "target" array, of the given object "info"
// cancellable (dis)allows exiting
// validator, for which set of regexes to use (keys to global object "validator")
const getInfo: (info: any, targets: string[], cancellable: boolean, validator: string) => any = async (info: any, targets: string[], cancellable: boolean, validator: string) => {
    let nevermind: boolean = false;
    let correctInfo: boolean = false;
    while (!correctInfo) {
        await asyncForEach(targets, async (target: string) => {
            if (nevermind) {
                return;
            }
            const response: string = await inputChecker(`What is the ${target}?\n`, validators[`${validator}`][`${target}`]);
            if (response === "exit" && cancellable) {
                nevermind = true;
            } else {
                info[`${target}`] = response;
            }
        });

        if (nevermind) {
            return "exit";
        } else {
            targets.forEach((target) => {
                const field = `Your ${target} is:`;
                console.log(`${field}${field.length < 16 ? "\t\t\t" : "\t\t"}${info[`${target}`]}`);
            });
            correctInfo = (await askQuestion("Are these fields correct (yes, no)?\n")).trim().toLowerCase() === "yes";
        }
    }
    return info;
};
// displays publisher information nicely, from a "SELECT * FROM publisher"-like query
const publisherInfoTemplate: (publishers: Publisher[], publisherIndex: number) => string = (publishers: Publisher[], publisherIndex: number) => {
    const publisher: Publisher = publishers[publisherIndex];
    return `Publisher ${publisherIndex + 1} of ${publishers.length}

    Name:\t\t${publisher.publisher_name}
    Address:\t\t${publisher.street}, ${publisher.city} ${publisher.zip}
    Email:\t\t${publisher.email}
    Phone:\t\t${publisher.phone}`;
};
// like Object.keys(obj) or Object.values(obj), but doesn't include any keys in the "diff" array
// target specifies if it's Object.keys() or Object.values()
const objectDifference: (obj: object, diff: any[], target: string) => any[] = (obj: object, diff: any[], target: string) => {
    const newArr: any[] = [];
    if (target === "keys") {
        Object.keys(obj).forEach((key) => {
            if (!diff.includes(key)) {
                newArr.push(key);
            }
        });
    } else if (target === "values") {
        Object.keys(obj).forEach((key) => {
            if (!diff.includes(key)) {
                newArr.push(obj[`${key}`]);
            }
        });
    }
    return newArr;
};
// Sum of every book's price * stock in given book array
const getTotalPrice: (books: Book[]) => number = (books: Book[]) => {
    let total: number = 0.0;
    books.forEach((book: Book) => {
        total += (Math.round(parseFloat(book.price.substring(1)) * 100) / 100) * book.stock;
    });
    return total;
};
// lets owners add new books
// need to enter all the information for books
// if a publisher doesn't already exist in the db, also prompts to add publisher info
const addBook: () => Promise<void> = async () => {
    const newBook: Book = {
        isbn: "",
        book_name: "",
        author: "",
        genre: "",
        publisher: "",
        price: "$0.00",
        pages: 0,
        royalty: 0,
        stock: 0
    };
    console.clear();
    console.log(`Beginning the addition of a new book process. Follow the prompts, and type "exit" to exit anytime.\n`);
    let gotInfo: any = await getInfo(newBook, Object.keys(newBook), true, "book");
    if (gotInfo !== "exit") {
        // transform the inputted values into acceptable forms for postgres (i.e. string -> number)
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
            // enter new publisher's information
            const newPublisher: Publisher = {
                publisher_name: gotInfo.publisher,
                street: "",
                city: "",
                zip: "",
                email: "",
                phone: ""
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
};
// browses through publishers with "next" and "prev"
// for owners only
// can specify one publisher, or all by default
const browsePublisher: (rawInput: string, argv: string[]) => Promise<void> = async (rawInput: string, argv: string[]) => {
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
};
// registration
// prompts user for username and plaintext (and visible, hehe) password
// then prompts for default contact info and default billing info
// this app has 0 security, don't actually put anything of significance in!!!!!
const register: () => Promise<void> = async () => {
    const existingUsers: BookstoreUser[] = (await pgClient.query("SELECT user_name FROM bookstore_user")).rows;
    let usernameExists: boolean = true;
    const newUser: BookstoreUser = {
        user_name: "",
        pass: "",
        superuser: false,
        contact_info_id: 0,
        billing_info_id: 0,
    };
    while (usernameExists) {
        newUser.user_name = (await askQuestion("What would you like your new username to be?\n> ")).trim();
        usernameExists = false;
        existingUsers.forEach((existingUser) => {
            if (existingUser.user_name === newUser.user_name) {
                usernameExists = true;
                console.log("That username is already taken.");
            }
        });
    }
    newUser.pass = (await askQuestion("What would you like your new password to be?\n> ")).trim();
    const accept: string = (await askQuestion(`Your username shall be '${newUser.user_name} and your password shall be ${newUser.pass}, is this okay (Y/n)?\n> `)).trim();
    if (accept.toLowerCase() === "y" || accept.toLowerCase() === "yes" || accept === "") {
        console.log("We will also need your contact info.");
        let contactInfo: ContactInfo = {
            id: 0,
            street: "",
            city: "",
            zip: "",
            first_name: "",
            last_name: "",
            phone: ""
        };
        contactInfo = await getInfo(contactInfo, objectDifference(contactInfo, ["id"], "keys"), false, "info");

        console.log("Finally, we will need your billing info.");
        let billingInfo: BillingInfo = {
            id: 0,
            street: "",
            city: "",
            zip: "",
            first_name: "",
            last_name: "",
            phone: "",
            card_number: "",
            cvv: "",
            expiry: ""
        };
        const sameAsContact: boolean = (await askQuestion("Is your billing adderess the same as your contact info (yes, no)?")).trim().toLowerCase() === "yes";
        if (sameAsContact) {
            Object.keys(contactInfo).forEach((key) => {
                billingInfo[`${key}`] = contactInfo[`${key}`];
            });
            billingInfo = await getInfo(billingInfo, ["card_number", "cvv", "expiry"], false, "info");
        } else {
            billingInfo = await getInfo(billingInfo, objectDifference(billingInfo, ["id"], "keys"), false, "info");
        }
        let queryText: string = "INSERT INTO contact_info (street, city, zip, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *";
        let values = objectDifference(contactInfo, ["id"], "values");
        const insertedContactInfo: ContactInfo = (await pgClient.query(queryText, values)).rows[0];
        newUser.contact_info_id = insertedContactInfo.id;

        queryText = "INSERT INTO billing_info (street, city, zip, first_name, last_name, phone, card_number, cvv, expiry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *";
        values = objectDifference(billingInfo, ["id"], "values");
        const insertedBillingInfo: BillingInfo = (await pgClient.query(queryText, values)).rows[0];
        newUser.billing_info_id = insertedBillingInfo.id;

        queryText = "INSERT INTO bookstore_user (user_name, pass, superuser, contact_info_id, billing_info_id) VALUES ($1, $2, $3, $4, $5)";
        await pgClient.query(queryText, Object.values(newUser));
        console.log("A new user has been added to the database.\n");
    } else {
        console.log("Cancelled registration.");
    }
};
const login: () => Promise<void> = async () => {
    const username: string = (await askQuestion("What is your username?\n> ")).trim();
    // just gonna leave their password right out in the open
    // their passwords are also stored in plaintext
    const password: string = (await askQuestion("What is the password?\n> ")).trim();
    const dbRes: Postgres.QueryResult = await pgClient.query(`SELECT * FROM bookstore_user WHERE user_name = '${username}' AND pass = '${password}'`);
    if (dbRes.rows.length === 1) {
        const loggedIn: BookstoreUser = dbRes.rows[0];
        guestMode = false;
        ownerMode = loggedIn.superuser;
        userCart = [];
        currentUser = loggedIn.user_name;
        await loggedInRepl();
        guestMode = true;
        ownerMode = false;
    } else {
        console.error("Sorry, you're not in the database (which means you should make a new user), or the password you entered is not the correct one.");
    }
};

/* REPLs for the program */

// user/owner repl
// search books, look at past purchases
// add to cart if regular user
// checkout cart if regular user
// add books if owner
// delete books from search as owner
// search publishers as owner
// look at metrics if owner
const loggedInRepl: () => Promise<void> = async () => {
    let command: string = "";
    // TODO good help strings for differnt modes
    const help: string = ownerMode ? ownerHelp : userHelp;
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
        } else if (command === "purchase") {
            let queryText: string = `SELECT * FROM purchase`;
            let purchaseNumbers: number[];
            if (argv.length === 0 && !ownerMode) {
                queryText = `SELECT purchase_number FROM user_purchase WHERE user_name = '${currentUser}'`;
                purchaseNumbers = (await pgClient.query(queryText)).rows.map((purchaseNumber) => {
                    return purchaseNumber.purchase_number;
                });
                queryText = `SELECT * FROM purchase WHERE purchase_number = ${purchaseNumbers.join(` OR purchase_number = `)}`;
                await browsePurchases((await pgClient.query(queryText)).rows);
            } else {
                purchaseNumbers = [parseInt(argv[0], 10)];
                if (isNaN(purchaseNumbers[0])) {
                    console.log(`${argv[0]} is not a valid purchase number.`);
                } else {
                    queryText = `${queryText} WHERE purchase_number = $1`;
                    await browsePurchases((await pgClient.query(queryText, purchaseNumbers)).rows);
                }
            }
        } else if (command === "cart" && !ownerMode) {
            inCart = true;
            await browseBooks(userCart);
            inCart = false;
        } else if (command === "checkout") {
            await checkout();
        } else if (command === "add" && ownerMode) {
            await addBook();
        } else if (command === "publisher" && ownerMode) {
            await browsePublisher(rawInput, argv);
            // TODO automatically "email" publishers when stock of a certain book falls beneath 10
        } else if (command === "sales" && ownerMode) {
            // TODO show metrics (sales vs expenses, sales per genre, sales per author)
            let browseMetricsCommand: string = "";
            while (browseMetricsCommand !== "exit") {
                let queryString: string = "";
                if (argv.length === 2) {
                    console.clear();
                    if (argv[0] === "vs" && argv[1] === "expenses") {
                        const salesQueryText: string = `SELECT SUM(total) AS sales FROM purchase`;
                        const sales: number = parseFloat((await pgClient.query(salesQueryText)).rows[0].sales.substring(1).replace(/,/g, ""));

                        const royaltiesQueryString: string = `SELECT SUM(royalties_paid) AS royalties FROM purchase_book`;
                        const royalties: number = parseFloat((await pgClient.query(royaltiesQueryString)).rows[0].royalties.substring(1).replace(/,/g, ""));
                        const bookExpenses: number = sales / 2;
                        const archiveExpensesQueryString: string = `SELECT (stock * price / 2) AS supplier_price FROM book WHERE stock != -1`;
                        const archiveExpenses: number = parseFloat((await pgClient.query(archiveExpensesQueryString)).rows[0].supplier_price.substring(1).replace(/,/g, ""));
                        const expenses: number = Math.round((royalties + bookExpenses + archiveExpenses) * 100) / 100;
                        console.log(`Sales: $${sales}\nExpenses: $${expenses}\n`);
                        const metricsPrompt: string = `Type "exit" at any time to exit.\n`;
                        browseMetricsCommand = (await askQuestion(metricsPrompt)).trim().toLowerCase();
                    } else if (argv[0] === "per") {
                        if (argv[1] === "genre") {
                            queryString = `SELECT DISTINCT genre FROM book`;
                            const genres: string[] = (await pgClient.query(queryString)).rows.map((genre) => genre.genre );
                            let prettyPrint: string = "Sales per Genre:\n";
                            await asyncForEach(genres, async (genre: string) => {
                                queryString = `SELECT SUM(price * quantity) AS sales, SUM(quantity) AS quantity FROM purchase_book NATURAL JOIN book WHERE genre = '${genre}'`;
                                const dbRes: any = (await pgClient.query(queryString)).rows[0];
                                const quantity: number = dbRes.quantity;
                                const sales: string = dbRes.sales;
                                prettyPrint += `${genre}: ${quantity === null ? "0" : quantity} books sold, totalling ${sales === null ? "$0" : sales}\n`;
                            });
                            console.log(prettyPrint);
                            const metricsPrompt: string = `Type "exit" at any time to exit.\n`;
                            browseMetricsCommand = (await askQuestion(metricsPrompt)).trim().toLowerCase();
                        } else if (argv[1] === "author") {
                            queryString = `SELECT DISTINCT author FROM book`;
                            const authors: string[] = (await pgClient.query(queryString)).rows.map((author: any) => author.author );
                            let prettyPrint: string = "Sales per Author:\n";
                            await asyncForEach(authors, async (author: string) => {
                                queryString = `SELECT SUM(price * quantity) AS sales, SUM(quantity) AS quantity FROM purchase_book NATURAL JOIN book WHERE author = '${author}'`;
                                const dbRes: any = (await pgClient.query(queryString)).rows[0];
                                const quantity: number = dbRes.quantity;
                                const sales: string = dbRes.sales;
                                prettyPrint += `${author}: ${quantity === null ? "0" : quantity} books sold, totalling ${sales === null ? "$0" : sales}\n`;
                            });
                            console.log(prettyPrint);
                            const metricsPrompt: string = `Type "exit" at any time to exit.\n`;
                            browseMetricsCommand = (await askQuestion(metricsPrompt)).trim().toLowerCase();
                        }
                    }
                }
            }
            console.clear();
        }
    }
};
// guest repl
// login and register
// search without adding to cart
const mainRepl: () => void = async () => {
    let command: string = "";
    const prompt: string = `Welcome to this "online" bookstore. You may [search, login, register] or request [help]:\n> `;
    while (command.toLowerCase() !== "exit") {
        const input: string[] = (await askQuestion(command === "turn" ? "> " : prompt)).trim().toLowerCase().split(" ");
        command = input[0];
        const argv: string[] = input.splice(1);

        if (command === "login") {
            await login();
        } else if (command === "register") {
            await register();
        } else if (command === "search") {
            await search();
        } else if (command === "turn") {
            await turn(argv);
        } else if (command === "help") {
            console.log(guestHelp);
        }
    }
    console.log("Exiting");
    process.exit(0);
};

// public static void main(String[] args) {
mainRepl();
