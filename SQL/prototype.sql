CREATE TABLE book(
    isbn TEXT PRIMARY KEY,
    book_name TEXT NOT NULL,
    author_name TEXT NOT NULL,
    genre TEXT NOT NULL,
    publisher TEXT NOT NULL,
    pages INT NOT NULL,
    price MONEY NOT NULL,
    royalty NUMERIC (3, 2) NOT NULL,
    count INT NOT NULL
);

CREATE TABLE users(
    username TEXT PRIMARY KEY,
    not_salty_password TEXT NOT NULL,
    admin_account BOOLEAN NOT NULL
);

CREATE TABLE publisher(
    publisher_name TEXT PRIMARY KEY,
    publisher_address TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number INT NOT NULL,
    banking_account INT NOT NULL
);

CREATE TABLE orders(
    id SERIAL PRIMARY KEY,
    username TEXT REFERENCES users,
    current_location TEXT NOT NULL,
    creation_timestamp TIMESTAMP NOT NULL,
    fulfillment_timestamp TIMESTAMP
);

CREATE TABLE accounting(
    cash MONEY PRIMARY KEY
);

/* bogus books */
INSERT INTO book VALUES (
    '978-1506710310',
    'NieR: Automata World Guide Volume 1',
    'Square Enix',
    'Video Game',
    'Dark Horse Books',
    192,
    43.43,
    0.10,
    1
);

/* bogus users */
INSERT INTO users (username, not_salty_password, admin_account) VALUES (
    'kvn',
    'asdfjkl;',
    'false'
);

/* remove tables */
DROP TABLE accounting;
DROP TABLE orders;
DROP TABLE publisher;
DROP TABLE users;
DROP TABLE book;