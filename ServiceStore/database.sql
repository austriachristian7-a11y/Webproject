-- Northstar Store & Service database schema (MySQL 5.7+ / MariaDB 10.4+)
CREATE DATABASE IF NOT EXISTS northstar_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE northstar_store;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(20) NOT NULL DEFAULT '📦',
  image_path VARCHAR(255) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_categories (
  name VARCHAR(80) PRIMARY KEY,
  image_path VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS store_settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  banner_path VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO store_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Processing',
  billing_name VARCHAR(120) NOT NULL DEFAULT '',
  billing_email VARCHAR(190) NOT NULL DEFAULT '',
  billing_address VARCHAR(255) NOT NULL DEFAULT '',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'Not recorded',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Not recorded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  service VARCHAR(80) NOT NULL,
  service_mode ENUM('Walk-in','Home Service') NOT NULL DEFAULT 'Home Service',
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  address VARCHAR(255) NOT NULL,
  status ENUM('Pending','Confirmed','Cancelled','Completed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

INSERT IGNORE INTO products (sku,name,category,description,icon,price,stock) VALUES
('NS-101','Everyday Surface Cleaner','Cleaning','Plant-based, streak-free cleaner for daily use.','🧴',12.99,42);

INSERT IGNORE INTO shop_categories (name)
SELECT DISTINCT category FROM products WHERE active=1;
