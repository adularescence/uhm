/* remove tables */
DROP TABLE purchase_book;
DROP TABLE book;
DROP TABLE publisher;
DROP TABLE user_purchase;
DROP TABLE bookstore_user;
DROP TABLE purchase;
DROP TABLE contact_info;
DROP TABLE billing_info;


/* table creation */
CREATE TABLE contact_info(
    id SERIAL PRIMARY KEY,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT NOT NULL,
    phone TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
);

CREATE TABLE billing_info(
    id SERIAL PRIMARY KEY,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT NOT NULL,
    phone TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    cvv TEXT NOT NULL,
    expiry TEXT NOT NULL
);

CREATE TABLE bookstore_user(
    user_name TEXT PRIMARY KEY,
    pass TEXT NOT NULL,
    superuser BOOLEAN NOT NULL,
    contact_info_id INT REFERENCES contact_info,
    billing_info_id INT REFERENCES billing_info
);

CREATE TABLE purchase(
    purchase_number SERIAL PRIMARY KEY,
    purchase_status TEXT NOT NULL,
    total MONEY NOT NULL,
    destination_id INT REFERENCES contact_info,
    billing_id INT REFERENCES billing_info
);

CREATE TABLE user_purchase(
    user_name TEXT REFERENCES bookstore_user,
    purchase_number INT REFERENCES purchase
);

CREATE TABLE publisher(
    publisher_name TEXT PRIMARY KEY,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL
);

CREATE TABLE book(
    isbn TEXT PRIMARY KEY,
    book_name TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT NOT NULL,
    publisher TEXT REFERENCES publisher,
    price MONEY NOT NULL,
    pages INT NOT NULL,
    stock INT NOT NULL,
    royalty NUMERIC (3, 2) NOT NULL
);

CREATE TABLE purchase_book(
    purchase_number INT REFERENCES purchase,
    isbn TEXT REFERENCES book,
    royalties_paid MONEY NOT NULL,
    revenue MONEY NOT NULL,
    quantity INT NOT NULL
);

