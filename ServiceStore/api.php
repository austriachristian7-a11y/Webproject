<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/config.php';

try {
    $pdo = db();
    $action = $_GET['action'] ?? '';
    $data = request_data();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($action === 'session' && $method === 'GET')
        json_response(['user' => current_user()]);
    if ($action === 'login' && $method === 'POST') {
        $email = strtolower(clean_text($data['email'] ?? '', 190));
        $stmt = $pdo->prepare('SELECT id,name,email,password_hash,role FROM users WHERE email=?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify((string) ($data['password'] ?? ''), $user['password_hash']))
            json_response(['error' => 'Email or password is incorrect.'], 401);
        session_regenerate_id(true);
        unset($user['password_hash']);
        $_SESSION['user'] = $user;
        json_response(['user' => $user]);
    }
    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        json_response(['ok' => true]);
    }
    if ($action === 'register' && $method === 'POST') {
        $name = clean_text($data['name'] ?? '');
        $email = strtolower(clean_text($data['email'] ?? '', 190));
        $password = (string) ($data['password'] ?? '');
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8)
            json_response(['error' => 'Enter a name, valid email, and password with at least 8 characters.'], 422);
        $stmt = $pdo->prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'user')");
        try {
            $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000')
                json_response(['error' => 'That email is already registered.'], 409);
            throw $e;
        }
        $user = ['id' => (int) $pdo->lastInsertId(), 'name' => $name, 'email' => $email, 'role' => 'user'];
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        json_response(['user' => $user], 201);
    }

    $user = require_user();
    if ($action === 'categories' && $method === 'GET') {
        $sql = 'SELECT c.name,c.image_path,COUNT(p.id) AS product_count FROM shop_categories c LEFT JOIN products p ON p.category=c.name AND p.active=1 GROUP BY c.name,c.image_path HAVING COUNT(p.id)>0 ORDER BY c.name';
        json_response(['categories' => $pdo->query($sql)->fetchAll()]);
    }
    if ($action === 'categories' && $method === 'POST') {
        require_admin();
        $category = clean_text($data['category'] ?? '', 80);
        if ($category === '')
            json_response(['error' => 'Choose a category.'], 422);
        $stmt = $pdo->prepare('SELECT image_path FROM shop_categories WHERE name=?');
        $stmt->execute([$category]);
        $existing = $stmt->fetch();
        if (!$existing)
            json_response(['error' => 'That category is not available.'], 404);
        if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE)
            json_response(['error' => 'Choose a category picture to upload.'], 422);
        $file = $_FILES['image'];
        if ($file['error'] !== UPLOAD_ERR_OK)
            json_response(['error' => 'The category picture could not be uploaded.'], 422);
        if ($file['size'] > 5 * 1024 * 1024)
            json_response(['error' => 'Choose an image smaller than 5 MB.'], 422);
        $imageInfo = @getimagesize($file['tmp_name']);
        $mime = $imageInfo['mime'] ?? '';
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!$imageInfo || !isset($extensions[$mime]))
            json_response(['error' => 'Use a JPG, PNG, or WebP category picture.'], 422);
        $uploadDir = __DIR__ . '/assets/uploads/categories';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true))
            json_response(['error' => 'The category picture folder is unavailable.'], 500);
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $filename))
            json_response(['error' => 'The category picture could not be saved.'], 500);
        $imagePath = 'assets/uploads/categories/' . $filename;
        $stmt = $pdo->prepare('UPDATE shop_categories SET image_path=? WHERE name=?');
        $stmt->execute([$imagePath, $category]);
        $oldPath = (string) ($existing['image_path'] ?? '');
        if (str_starts_with($oldPath, 'assets/uploads/categories/') && is_file(__DIR__ . '/' . $oldPath))
            unlink(__DIR__ . '/' . $oldPath);
        json_response(['ok' => true, 'image_path' => $imagePath]);
    }
    if ($action === 'categories' && $method === 'PATCH') {
        require_admin();
        $category = clean_text($data['category'] ?? '', 80);
        $newName = clean_text($data['new_name'] ?? '', 80);
        if ($category === '' || $newName === '')
            json_response(['error' => 'Enter a category name.'], 422);
        $stmt = $pdo->prepare('SELECT name FROM shop_categories WHERE name=?');
        $stmt->execute([$category]);
        if (!$stmt->fetch())
            json_response(['error' => 'That category is not available.'], 404);
        if ($newName !== $category) {
            $stmt = $pdo->prepare('SELECT name FROM shop_categories WHERE name=?');
            $stmt->execute([$newName]);
            if ($stmt->fetch())
                json_response(['error' => 'A category with that name already exists.'], 409);
        }
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE products SET category=? WHERE category=?');
            $stmt->execute([$newName, $category]);
            if ($newName !== $category) {
                $stmt = $pdo->prepare('UPDATE shop_categories SET name=? WHERE name=?');
                $stmt->execute([$newName, $category]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            throw $e;
        }
        json_response(['ok' => true, 'name' => $newName]);
    }
    if ($action === 'store-banner' && $method === 'GET') {
        $settings = $pdo->query('SELECT banner_path FROM store_settings WHERE id=1')->fetch();
        json_response(['image_path' => $settings['banner_path'] ?? null]);
    }
    if ($action === 'store-banner' && $method === 'POST') {
        require_admin();
        if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE)
            json_response(['error' => 'Choose a banner picture to upload.'], 422);
        $file = $_FILES['image'];
        if ($file['error'] !== UPLOAD_ERR_OK)
            json_response(['error' => 'The banner picture could not be uploaded.'], 422);
        if ($file['size'] > 5 * 1024 * 1024)
            json_response(['error' => 'Choose an image smaller than 5 MB.'], 422);
        $imageInfo = @getimagesize($file['tmp_name']);
        $mime = $imageInfo['mime'] ?? '';
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!$imageInfo || !isset($extensions[$mime]))
            json_response(['error' => 'Use a JPG, PNG, or WebP banner picture.'], 422);
        $uploadDir = __DIR__ . '/assets/uploads/banners';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true))
            json_response(['error' => 'The banner picture folder is unavailable.'], 500);
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $filename))
            json_response(['error' => 'The banner picture could not be saved.'], 500);
        $imagePath = 'assets/uploads/banners/' . $filename;
        $stmt = $pdo->prepare('SELECT banner_path FROM store_settings WHERE id=1');
        $stmt->execute();
        $oldPath = (string) ($stmt->fetchColumn() ?: '');
        $stmt = $pdo->prepare('UPDATE store_settings SET banner_path=? WHERE id=1');
        $stmt->execute([$imagePath]);
        if (str_starts_with($oldPath, 'assets/uploads/banners/') && is_file(__DIR__ . '/' . $oldPath))
            unlink(__DIR__ . '/' . $oldPath);
        json_response(['ok' => true, 'image_path' => $imagePath]);
    }
    if ($action === 'products' && $method === 'GET') {
        $products = $pdo->query('SELECT id,sku,name,category,description,icon,image_path,price,stock FROM products WHERE active=1 ORDER BY id')->fetchAll();
        json_response(['products' => $products]);
    }
    if ($action === 'receipt' && $method === 'GET') {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT o.id,o.user_id,u.name AS customer,u.email AS account_email,o.total,o.status,o.created_at,o.billing_name,o.billing_email,o.billing_address,o.payment_method,o.payment_status FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?');
        $stmt->execute([$id]);
        $receipt = $stmt->fetch();
        if (!$receipt || ($user['role'] !== 'admin' && (int) $receipt['user_id'] !== (int) $user['id'])) json_response(['error' => 'Receipt not found.'], 404);
        $stmt = $pdo->prepare('SELECT product_name,quantity,unit_price FROM order_items WHERE order_id=? ORDER BY id');
        $stmt->execute([$id]);
        $receipt['items'] = $stmt->fetchAll();
        $receipt['receipt_number'] = 'CC-' . str_pad((string) $receipt['id'], 8, '0', STR_PAD_LEFT);
        $receipt['billing_name'] = $receipt['billing_name'] ?: $receipt['customer'];
        $receipt['billing_email'] = $receipt['billing_email'] ?: $receipt['account_email'];
        json_response(['receipt' => $receipt]);
    }
    if ($action === 'orders' && $method === 'GET') {
        $sql = "SELECT o.id,o.user_id,u.name AS customer,o.total,o.status,o.created_at,o.billing_name,o.billing_email,o.payment_method,o.payment_status, GROUP_CONCAT(CONCAT(oi.product_name,' × ',oi.quantity) ORDER BY oi.id SEPARATOR ', ') AS items FROM orders o JOIN users u ON u.id=o.user_id JOIN order_items oi ON oi.order_id=o.id";
        $params = [];
        if ($user['role'] !== 'admin') {
            $sql .= ' WHERE o.user_id=?';
            $params[] = $user['id'];
        }
        $sql .= ' GROUP BY o.id,o.user_id,u.name,o.total,o.status,o.created_at,o.billing_name,o.billing_email,o.payment_method,o.payment_status ORDER BY o.created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response(['orders' => $stmt->fetchAll()]);
    }
    if ($action === 'orders' && $method === 'POST') {
        $billingName = clean_text($data['billing_name'] ?? '', 120);
        $billingEmail = strtolower(clean_text($data['billing_email'] ?? '', 190));
        $billingAddress = clean_text($data['billing_address'] ?? '', 255);
        $paymentMethod = (string) ($data['payment_method'] ?? '');
        if ($billingName === '' || !filter_var($billingEmail, FILTER_VALIDATE_EMAIL) || $billingAddress === '' || $paymentMethod !== 'Debit Card')
            json_response(['error' => 'Complete your billing name, valid email, billing address, and debit card payment option.'], 422);
        $requestedItems = $data['items'] ?? [['product_id' => $data['product_id'] ?? 0, 'quantity' => $data['quantity'] ?? 0]];
        if (!is_array($requestedItems) || count($requestedItems) < 1 || count($requestedItems) > 30)
            json_response(['error' => 'Add between 1 and 30 products to your order.'], 422);
        $quantities = [];
        foreach ($requestedItems as $item) {
            $productId = (int) ($item['product_id'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);
            if ($productId < 1 || $quantity < 1 || $quantity > 99)
                json_response(['error' => 'Each product quantity must be between 1 and 99.'], 422);
            $quantities[$productId] = ($quantities[$productId] ?? 0) + $quantity;
            if ($quantities[$productId] > 99)
                json_response(['error' => 'Each product quantity must be 99 or less.'], 422);
        }
        $pdo->beginTransaction();
        try {
            $products = [];
            $total = 0.0;
            $find = $pdo->prepare('SELECT id,name,price,stock FROM products WHERE id=? AND active=1 FOR UPDATE');
            foreach ($quantities as $productId => $quantity) {
                $find->execute([$productId]);
                $product = $find->fetch();
                if (!$product || $product['stock'] < $quantity) {
                    $pdo->rollBack();
                    json_response(['error' => 'A product is unavailable or there is not enough stock. Review your cart and try again.'], 409);
                }
                $products[] = [$product, $quantity];
                $total += (float) $product['price'] * $quantity;
            }
            $stmt = $pdo->prepare("INSERT INTO orders(user_id,total,status,billing_name,billing_email,billing_address,payment_method,payment_status) VALUES(?,?,'Processing',?,?,?,?,'Pending')");
            $stmt->execute([$user['id'], $total, $billingName, $billingEmail, $billingAddress, $paymentMethod]);
            $orderId = (int) $pdo->lastInsertId();
            $insert = $pdo->prepare('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES(?,?,?,?,?)');
            $update = $pdo->prepare('UPDATE products SET stock=stock-? WHERE id=?');
            foreach ($products as [$product, $quantity]) {
                $insert->execute([$orderId, $product['id'], $product['name'], $quantity, $product['price']]);
                $update->execute([$quantity, $product['id']]);
            }
            $pdo->commit();
            json_response(['ok' => true, 'order_id' => $orderId], 201);
        } catch (Throwable $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            throw $e;
        }
    }
    if ($action === 'orders' && $method === 'PATCH') {
        require_admin();
        $id = (int) ($data['id'] ?? 0);
        if (isset($data['payment_status'])) {
            $paymentStatus = (string) $data['payment_status'];
            if (!in_array($paymentStatus, ['Pending', 'Paid', 'Failed'], true)) json_response(['error' => 'Invalid payment status.'], 422);
            if ($paymentStatus === 'Failed') {
                $stmt = $pdo->prepare("UPDATE orders SET payment_status=?, status='Cancelled' WHERE id=?");
            } else {
                $stmt = $pdo->prepare('UPDATE orders SET payment_status=? WHERE id=?');
            }
            $stmt->execute([$paymentStatus, $id]);
            json_response(['ok' => true]);
        }
        $status = (string) ($data['status'] ?? '');
        if (!in_array($status, ['Processing', 'Shipped', 'Delivered', 'Cancelled'], true))
            json_response(['error' => 'Invalid order status.'], 422);
        $stmt = $pdo->prepare('SELECT payment_status FROM orders WHERE id=?');
        $stmt->execute([$id]);
        if ($stmt->fetchColumn() === 'Failed' && $status !== 'Cancelled')
            json_response(['error' => 'Orders with failed payment must remain cancelled.'], 422);
        $stmt = $pdo->prepare('UPDATE orders SET status=? WHERE id=?');
        $stmt->execute([$status, $id]);
        json_response(['ok' => true]);
    }
    if ($action === 'appointments' && $method === 'GET') {
        $sql = 'SELECT a.id,a.user_id,u.name AS customer,a.service,a.service_mode,a.visit_date,a.visit_time,a.address,a.status FROM appointments a JOIN users u ON u.id=a.user_id';
        $params = [];
        if ($user['role'] !== 'admin') {
            $sql .= ' WHERE a.user_id=?';
            $params[] = $user['id'];
        }
        $sql .= ' ORDER BY a.visit_date,a.visit_time';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response(['appointments' => $stmt->fetchAll()]);
    }
    if ($action === 'appointments' && $method === 'POST') {
        $service = clean_text($data['service'] ?? '', 80);
        $serviceMode = (string) ($data['service_mode'] ?? '');
        $date = (string) ($data['visit_date'] ?? '');
        $time = (string) ($data['visit_time'] ?? '');
        $address = clean_text($data['address'] ?? '');
        if (!in_array($service, ['Standard cleaning', 'Deep cleaning', 'Troubleshooting'], true) || !in_array($serviceMode, ['Walk-in', 'Home Service'], true) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || ($serviceMode === 'Home Service' && $address === ''))
            json_response(['error' => 'Complete all required appointment fields.'], 422);
        if ($date < date('Y-m-d'))
            json_response(['error' => 'Choose a future date.'], 422);
        $stmt = $pdo->prepare("INSERT INTO appointments(user_id,service,service_mode,visit_date,visit_time,address,status) VALUES(?,?,?,?,?,?, 'Pending')");
        $stmt->execute([$user['id'], $service, $serviceMode, $date, $time, $address]);
        json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);
    }
    if ($action === 'appointments' && $method === 'PATCH') {
        require_admin();
        $id = (int) ($data['id'] ?? 0);
        $status = (string) ($data['status'] ?? '');
        if (!in_array($status, ['Pending', 'Confirmed', 'Cancelled', 'Completed'], true))
            json_response(['error' => 'Invalid appointment status.'], 422);
        $stmt = $pdo->prepare('UPDATE appointments SET status=? WHERE id=?');
        $stmt->execute([$status, $id]);
        json_response(['ok' => true]);
    }
    if ($action === 'inventory' && $method === 'GET') {
        require_admin();
        json_response(['products' => $pdo->query('SELECT id,sku,name,category,description,icon,image_path,price,stock FROM products WHERE active=1 ORDER BY id')->fetchAll()]);
    }
    if ($action === 'inventory' && $method === 'POST') {
        require_admin();
        $sku = clean_text($data['sku'] ?? '', 40);
        $name = clean_text($data['name'] ?? '');
        $category = clean_text($data['category'] ?? '', 80);
        $description = clean_text($data['description'] ?? '', 1000);
        $icon = clean_text($data['icon'] ?? '📦', 20);
        $price = (float) ($data['price'] ?? 0);
        $stock = (int) ($data['stock'] ?? 0);
        if ($sku === '' || $name === '' || $category === '' || $price < 0 || $stock < 0)
            json_response(['error' => 'Complete the product fields with valid price and stock.'], 422);
        $imagePath = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
            $file = $_FILES['image'];
            if ($file['error'] !== UPLOAD_ERR_OK)
                json_response(['error' => 'The product image could not be uploaded.'], 422);
            if ($file['size'] > 5 * 1024 * 1024)
                json_response(['error' => 'Choose an image smaller than 5 MB.'], 422);
            $imageInfo = @getimagesize($file['tmp_name']);
            $mime = $imageInfo['mime'] ?? '';
            $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (!$imageInfo || !isset($extensions[$mime]))
                json_response(['error' => 'Use a JPG, PNG, or WebP product image.'], 422);
            $uploadDir = __DIR__ . '/assets/uploads';
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true))
                json_response(['error' => 'The product image folder is unavailable.'], 500);
            $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $filename))
                json_response(['error' => 'The product image could not be saved.'], 500);
            $imagePath = 'assets/uploads/' . $filename;
        }
        $stmt = $pdo->prepare('INSERT INTO products(sku,name,category,description,icon,image_path,price,stock) VALUES(?,?,?,?,?,?,?,?)');
        try {
            $stmt->execute([$sku, $name, $category, $description, $icon, $imagePath, $price, $stock]);
            $categoryStmt = $pdo->prepare('INSERT IGNORE INTO shop_categories (name) VALUES (?)');
            $categoryStmt->execute([$category]);
        } catch (PDOException $e) {
            if ($imagePath && is_file(__DIR__ . '/' . $imagePath))
                unlink(__DIR__ . '/' . $imagePath);
            if ($e->getCode() === '23000')
                json_response(['error' => 'That SKU is already in use.'], 409);
            throw $e;
        }
        json_response(['ok' => true], 201);
    }
    if ($action === 'inventory' && $method === 'PATCH') {
        require_admin();
        $id = (int) ($data['id'] ?? 0);
        $stock = (int) ($data['stock'] ?? -1);
        if ($stock < 0)
            json_response(['error' => 'Stock must be zero or more.'], 422);
        $stmt = $pdo->prepare('UPDATE products SET stock=? WHERE id=?');
        $stmt->execute([$stock, $id]);
        json_response(['ok' => true]);
    }
    if ($action === 'customers' && $method === 'GET') {
        require_admin();
        json_response(['customers' => $pdo->query('SELECT u.id,u.name,u.email,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS order_count,(SELECT COUNT(*) FROM appointments a WHERE a.user_id=u.id) AS appointment_count,(SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id=u.id) AS lifetime_value FROM users u WHERE u.role="user" ORDER BY u.name')->fetchAll()]);
    }
    json_response(['error' => 'Endpoint not found.'], 404);
} catch (Throwable $error) {
    error_log($error->__toString());
    json_response(['error' => 'The server could not complete the request. Check the PHP error log.'], 500);
}
