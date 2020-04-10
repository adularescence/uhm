CREATE TABLE book(
    isbn TEXT PRIMARY KEY,
    book_name TEXT NOT NULL,
    author_name TEXT NOT NULL,
    genre TEXT NOT NULL,
    publisher TEXT NOT NULL,
    pages INT NOT NULL,
    price NUMERIC(5, 2) NOT NULL,
    royalty NUMERIC (3, 2) NOT NULL,
    count INT NOT NULL
);

CREATE TABLE user(
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL
);

CREATE TABLE publisher(
    publisher_name TEXT PRIMARY KEY,
    publisher_address TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number INT NOT NULL,
    banking_account INT NOT NULL
);

CREATE TABLE order(
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user,
    current_location TEXT NOT NULL,
    creation_timestamp TIMESTAMP NOT NULL,
    fulfillment_timestamp TIMESTAMP
);

CREATE TABLE accounting(
    cash MONEY PRIMARY KEY
;)