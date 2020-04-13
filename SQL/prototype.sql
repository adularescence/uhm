/* remove tables */
DROP TABLE accounting;
DROP TABLE orders;
DROP TABLE publisher;
DROP TABLE users;
DROP TABLE book;

CREATE TABLE book(
    author_name TEXT NOT NULL,
    book_name TEXT NOT NULL,
    count INT NOT NULL,
    genre TEXT NOT NULL,
    isbn TEXT PRIMARY KEY,
    pages INT NOT NULL,
    price MONEY NOT NULL,
    publisher TEXT NOT NULL,
    royalty NUMERIC (3, 2) NOT NULL
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
    phone_number TEXT NOT NULL,
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
    'Square Enix',
    'NieR: Automata World Guide Volume 1',
    1,
    'Video Game',
    '978-1506710310',
    192,
    43.43,
    'Dark Horse Books',
    0.10
);
INSERT INTO book VALUES (
    'James Stewart',
    'Calculus: Early Transcendentals',
    1,
    'Textbook',
    '978-1285741550',
    1368,
    189.57,
    'Brooks Cole',
    0.10
);
INSERT INTO book VALUES (
    'Yoko Taro',
    'NieR:Automata: Long Story Short',
    1,
    'Video Game',
    '978-1974701629',
    256,
    19.69,
    'Viz Media',
    0.10
);
INSERT INTO book VALUES (
    'Yoko Taro',
    'NieR:Automata: Short Story Long',
    1,
    'Video Game',

    256,
    19.69,
    'Viz Media',
    0.10
);

/* bogus users */
INSERT INTO users (username, not_salty_password, admin_account) VALUES (
    'kvn',
    'asdfjkl;',
    'false'
);
INSERT INTO users (username, not_salty_password, admin_account) VALUES (
    'kevin',
    'asdfjkl;',
    'true'
);

/* bogus publishers */
INSERT INTO publisher (publisher_name, publisher_address, email, phone_number, banking_account) VALUES (
    'Dark Horse Books',
    '669 Cassells Street',
    'support@darkhorsebooks.ca',
    '416-123-4567',
    1
);
INSERT INTO publisher (publisher_name, publisher_address, email, phone_number, banking_account) VALUES (
    'Brooks Cole',
    '123 Placeholder Street',
    'placeholder@gmail.com',
    '123-456-7890',
    2
);
INSERT INTO publisher (publisher_name, publisher_address, email, phone_number, banking_account) VALUES (
    'Viz Media',
    '456 Placeholder Street',
    'placeholder@outlook.com',
    '098-765-4321',
    3
);