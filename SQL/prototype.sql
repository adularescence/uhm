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


/* test values */
INSERT INTO contact_info (street, city, zip, phone, first_name, last_name) VALUES (
    '1125 Colonel By Drive',
    'Ottawa',
    'K1S 5B6',
    '613-123-4567',
    'Kevin',
    'Li'
);
INSERT INTO billing_info (street, city, zip, phone, first_name, last_name, card_number, cvv, expiry) VALUES (
    '1125 Colonel By Drive',
    'Ottawa',
    'K1S 5B6',
    '613-123-4567',
    'Kevin',
    'Li',
    '1234567812345678',
    '123',
    '12/34'
);
INSERT INTO bookstore_user (user_name, pass, superuser, contact_info_id, billing_info_id) VALUES (
    'kvn',
    'asdfjkl;',
    'false',
    1,
    1
);
INSERT INTO bookstore_user (user_name, pass, superuser, contact_info_id, billing_info_id) VALUES (
    'kevin',
    'asdfjkl;',
    'true',
    1,
    1
);

INSERT INTO publisher VALUES (
    'Dark Horse Books',
    '669 Cassells Street',
    'North Bay',
    'P1B 4A1',
    'support@darkhorsebooks.ca',
    '416-123-4567'
);
INSERT INTO publisher VALUES (
    'Brooks Cole',
    '123 Placeholder Street',
    'Placeholder',
    'A1B 2C3',
    'placeholder@gmail.com',
    '123-456-7890'
);
INSERT INTO publisher VALUES (
    'Viz Media',
    '456 Placeholder Street',
    'Placeholder',
    'A1B 3C4',
    'placeholder@outlook.com',
    '098-765-4321'
);
INSERT INTO book VALUES (
    '978-1506710310',
    'NieR: Automata World Guide Volume 1',
    'Square Enix',
    'Video Game',
    'Dark Horse Books',
    43.43,
    192,
    10,
    0.10
);
INSERT INTO book VALUES (
    '978-1285741550',
    'Calculus: Early Transcendentals',
    'James Stewart',
    'Textbook',
    'Brooks Cole',
    189.57,
    1368,
    10,
    0.10
);
INSERT INTO book VALUES (
    '978-1974701629',
    'NieR:Automata: Long Story Short',
    'Yoko Taro',
    'Video Game',
    'Viz Media',
    19.69,
    256,
    10,
    0.10
);
INSERT INTO book VALUES (
    '978-1974701841',
    'NieR:Automata: Short Story Long',
    'Yoko Taro',
    'Video Game',
    'Viz Media',
    19.69,
    256,
    10,
    0.10
);