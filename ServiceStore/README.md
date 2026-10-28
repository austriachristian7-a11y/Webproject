# Northstar Store & Service (XAMPP)

Bootstrap frontend with a PHP JSON API and MySQL database. It supports customer registration and sign-in, product ordering, inventory tracking, order status updates, customer records, and cleaning or troubleshooting appointments.

## Start with XAMPP on Windows

1. Install XAMPP with PHP 8.1 or later and open its Control Panel. Start **Apache** and **MySQL**.
2. Copy the complete `ServiceStore` folder to your XAMPP web root, usually `C:\xampp\htdocs\ServiceStore`.
3. If your MySQL root account has a password or a different host, update `DB_HOST`, `DB_USER`, and `DB_PASS` in `config.php`.
4. Open `http://localhost/ServiceStore/setup.php` once. It creates the database and tables and loads starter products and demo accounts.
5. Remove or rename `setup.php` after setup.
6. Open `http://localhost/ServiceStore/` and sign in.

If you prefer phpMyAdmin, import `database.sql` to create the schema and starter products. The setup page is still needed to create the demo accounts.

## Demo accounts

- Admin: `admin@northstar.local` / `admin123`
- Customer: `user@northstar.local` / `user123`

The Admin account can manage inventory, see all orders and appointments, update statuses, and view customers. Customer accounts can browse the store, place orders, view their own order history, and request appointments. New customer accounts can be created from the sign-in screen.

## Files

- `index.html` — Bootstrap frontend
- `assets/css/style.css` and `assets/js/app.js` — app styles and browser behavior
- `api.php` — PHP API, session login, role checks, and business actions
- `config.php` — local MySQL connection settings and common API helpers
- `database.sql` — importable MySQL schema and starter products
- `setup.php` — one-time local database and demo account initializer

Bootstrap and its icons/fonts are loaded from public CDNs, so the browser needs internet access for those assets. The PHP and MySQL app itself runs locally in XAMPP.

## Local demo security

This project is intended for local development. Change the default passwords before using real data. Do not publish it to the internet as-is; production deployment needs HTTPS, secure database credentials, CSRF protections, backups, and additional operational hardening.
