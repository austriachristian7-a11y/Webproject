<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

try {
    $server = new PDO('mysql:host=' . DB_HOST . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

    $statements = [
        "CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('admin','user') NOT NULL DEFAULT 'user', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS products (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, sku VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL, category VARCHAR(80) NOT NULL, description TEXT NOT NULL, icon VARCHAR(20) NOT NULL DEFAULT '📦', image_path VARCHAR(255) DEFAULT NULL, price DECIMAL(10,2) NOT NULL, stock INT UNSIGNED NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS shop_categories (name VARCHAR(80) PRIMARY KEY, image_path VARCHAR(255) DEFAULT NULL) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS store_settings (id TINYINT UNSIGNED PRIMARY KEY, banner_path VARCHAR(255) DEFAULT NULL) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, total DECIMAL(10,2) NOT NULL, status ENUM('Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Processing', billing_name VARCHAR(120) NOT NULL DEFAULT '', billing_email VARCHAR(190) NOT NULL DEFAULT '', billing_address VARCHAR(255) NOT NULL DEFAULT '', payment_method VARCHAR(40) NOT NULL DEFAULT 'Not recorded', payment_status VARCHAR(20) NOT NULL DEFAULT 'Not recorded', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS order_items (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, product_name VARCHAR(160) NOT NULL, quantity INT UNSIGNED NOT NULL, unit_price DECIMAL(10,2) NOT NULL, CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE, CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS appointments (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, service VARCHAR(80) NOT NULL, service_mode ENUM('Walk-in','Home Service') NOT NULL DEFAULT 'Home Service', visit_date DATE NOT NULL, visit_time TIME NOT NULL, address VARCHAR(255) NOT NULL, status ENUM('Pending','Confirmed','Cancelled','Completed') NOT NULL DEFAULT 'Pending', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_appointments_user FOREIGN KEY (user_id) REFERENCES users(id)) ENGINE=InnoDB"
    ];
    foreach ($statements as $sql) $pdo->exec($sql);

    $orderColumns = $pdo->query('SHOW COLUMNS FROM orders')->fetchAll(PDO::FETCH_COLUMN);
    $orderMigrations = [
        'billing_name' => "ALTER TABLE orders ADD billing_name VARCHAR(120) NOT NULL DEFAULT '' AFTER status",
        'billing_email' => "ALTER TABLE orders ADD billing_email VARCHAR(190) NOT NULL DEFAULT '' AFTER billing_name",
        'billing_address' => "ALTER TABLE orders ADD billing_address VARCHAR(255) NOT NULL DEFAULT '' AFTER billing_email",
        'payment_method' => "ALTER TABLE orders ADD payment_method VARCHAR(40) NOT NULL DEFAULT 'Not recorded' AFTER billing_address",
        'payment_status' => "ALTER TABLE orders ADD payment_status VARCHAR(20) NOT NULL DEFAULT 'Not recorded' AFTER payment_method"
    ];
    foreach ($orderMigrations as $column => $sql) if (!in_array($column, $orderColumns, true)) $pdo->exec($sql);

    $appointmentColumns = $pdo->query('SHOW COLUMNS FROM appointments')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('service_mode', $appointmentColumns, true)) $pdo->exec("ALTER TABLE appointments ADD service_mode ENUM('Walk-in','Home Service') NOT NULL DEFAULT 'Home Service' AFTER service");

    $columns = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('image_path', $columns, true)) $pdo->exec('ALTER TABLE products ADD image_path VARCHAR(255) DEFAULT NULL AFTER icon');

    $users = [
        ['Northstar Admin', 'admin@northstar.local', 'admin123', 'admin'],
        ['Taylor Morgan', 'user@northstar.local', 'user123', 'user']
    ];
    $userStmt = $pdo->prepare('INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
    foreach ($users as [$name,$email,$password,$role]) $userStmt->execute([$name,$email,password_hash($password, PASSWORD_DEFAULT),$role]);

    $products = [
        ['NS-101','Everyday Surface Cleaner','Cleaning','Plant-based, streak-free cleaner for daily use.','🧴',12.99,42],
    ];
    $productStmt = $pdo->prepare('INSERT IGNORE INTO products (sku,name,category,description,icon,price,stock) VALUES (?,?,?,?,?,?,?)');
    foreach ($products as $product) $productStmt->execute($product);

    $retiredSkus = ['NS-102','NS-103','NS-104','NS-105','NS-106'];
    $retireProducts = $pdo->prepare('UPDATE products SET active=0 WHERE sku=?');
    foreach ($retiredSkus as $sku) $retireProducts->execute([$sku]);

    $pdo->exec('INSERT IGNORE INTO shop_categories (name) SELECT DISTINCT category FROM products WHERE active=1');
    $pdo->exec('INSERT IGNORE INTO store_settings (id) VALUES (1)');

    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Northstar setup</title><style>body{font:16px Arial;max-width:680px;margin:60px auto;line-height:1.6;color:#203044}code{background:#eef2f7;padding:3px 6px;border-radius:4px}</style><h1>Northstar database is ready</h1><p>Sign in with one of these initial local accounts:</p><ul><li>Admin: <code>admin@northstar.local</code> / <code>admin123</code></li><li>User: <code>user@northstar.local</code> / <code>user123</code></li></ul><p>Return to <a href="index.html">the app</a>. Change these passwords before using real customer data. Remove or rename <code>setup.php</code> after setup.</p>';
} catch (Throwable $error) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Setup failed. Check that XAMPP MySQL is running and config.php matches your MySQL credentials. Details: ' . $error->getMessage();
}
