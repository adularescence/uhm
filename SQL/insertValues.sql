
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