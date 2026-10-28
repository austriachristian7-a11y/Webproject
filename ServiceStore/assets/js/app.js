const state = {
    user: null,
    page: 'overview',
    products: [],
    orders: [],
    appointments: [],
    customers: [],
    authMode: 'login',
    storeCategories: [],
    storeCategory: 'All',
    shopCategories: [],
    storeBanner: null,
    productSearch: '',
    cart: []
};
const $ = s => document.querySelector(s),
    money = n => new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(Number(n || 0)),
    esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [c]));
const api = async (action, options = {}) => {
    const {
        query,
        ...fetchOptions
    } = options;
    const headers = {
        ...(fetchOptions.body instanceof FormData ? {} : {
            'Content-Type': 'application/json'
        }),
        ...fetchOptions.headers
    };
    const queryString = query ? `&${new URLSearchParams(query)}` : '';
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}${queryString}`, {
        credentials: 'same-origin',
        ...fetchOptions,
        headers
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data
};

function cartStorageKey() {
    return `core-components-cart-${state.user?.id||'guest'}`
}

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(cartStorageKey()) || '[]');
        state.cart = Array.isArray(saved) ? saved.filter(i => Number(i.id) > 0 && Number(i.quantity) > 0).map(i => ({
            id: Number(i.id),
            quantity: Number(i.quantity)
        })) : []
    } catch {
        state.cart = []
    }
    updateCartNav()
}

function saveCart() {
    try {
        localStorage.setItem(cartStorageKey(), JSON.stringify(state.cart))
    } catch {}
    updateCartNav()
}

function cartItemCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0)
}

function updateCartNav() {
    const link = document.querySelector('#navLinks [data-page="cart"]');
    if (link) link.innerHTML = `🛒 Cart (${cartItemCount()})`
}

function showAlert(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `alert alert-${type} alert-dismissible fade show`;
    node.innerHTML = `${esc(message)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    $('#alertArea').prepend(node);
    setTimeout(() => node.remove(), 5000)
}

function switchAuth(mode) {
    state.authMode = mode;
    const reg = mode === 'register';
    $('#authTitle').textContent = reg ? 'Create your account' : 'Welcome back';
    $('#authHint').textContent = reg ? 'Create a customer account to place orders and book service.' : 'Sign in to continue to your account.';
    $('#nameGroup').classList.toggle('d-none', !reg);
    $('#nameGroup input').required = reg;
    $('#authSubmit').textContent = reg ? 'Create account' : 'Sign in';
    $('#authToggle').textContent = reg ? 'I already have an account' : 'Create a customer account';
    $('#authError').classList.add('d-none')
}
$('#authToggle').addEventListener('click', () => switchAuth(state.authMode === 'login' ? 'register' : 'login'));
$('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
        const result = await api(state.authMode === 'login' ? 'login' : 'register', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        state.user = result.user;
        await showApp()
    } catch (error) {
        $('#authError').textContent = error.message;
        $('#authError').classList.remove('d-none')
    }
});
$('#logoutBtn').addEventListener('click', async () => {
    await api('logout', {
        method: 'POST',
        body: '{}'
    });
    state.user = null;
    $('#appView').classList.add('d-none');
    $('#authView').classList.remove('d-none');
    switchAuth('login')
});
async function boot() {
    try {
        const s = await api('session');
        if (s.user) {
            state.user = s.user;
            await showApp()
        } else {
            $('#authView').classList.remove('d-none')
        }
    } catch {
        $('#authView').classList.remove('d-none');
        $('#authError').textContent = 'Cannot reach PHP/MySQL. Start Apache and MySQL in XAMPP, then open this app through http://localhost/ServiceStore/.';
        $('#authError').classList.remove('d-none')
    }
}
async function showApp() {
    $('#authView').classList.add('d-none');
    $('#appView').classList.remove('d-none');
    $('#currentUserLabel').textContent = `${state.user.name} · ${state.user.role}`;
    loadCart();
    const admin = state.user.role === 'admin';
    if (admin && ['store', 'cart'].includes(state.page)) state.page = 'overview';
    const links = [
        ['overview', 'Overview', '▦'],
        ...(!admin ? [['store', 'Online store', '▧'], ['cart', `Cart (${cartItemCount()})`, '🛒']] : []),
        ['orders', admin ? 'All orders' : 'My orders', '▤'],
        ['appointments', admin ? 'Appointments' : 'My appointments', '▦'], ...(admin ? [
            ['inventory', 'Inventory', '▣'],
            ['customers', 'Customers', '♙']
        ] : [])
    ];
    $('#navLinks').innerHTML = links.map(([key, label, icon]) => `<a class="nav-link px-lg-3 ${state.page===key?'active':''}" href="#${key}" data-page="${key}">${icon} ${label}</a>`).join('');
    $('#navLinks').onclick = e => {
        const link = e.target.closest('[data-page]');
        if (link) {
            e.preventDefault();
            go(link.dataset.page)
        }
    };
    await renderPage()
}
async function go(page) {
    if (state.user?.role === 'admin' && ['store', 'cart'].includes(page)) return;
    state.page = page;
    document.querySelectorAll('#navLinks .nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    await renderPage()
}

function head(title, subtitle, action = '') {
    return `<div class="d-flex align-items-start justify-content-between gap-3 mb-4"><div><div class="eyebrow mb-1">WE DO QUALITY NOT QUANTITY</div><h1 class="page-title mb-1">${title}</h1><p class="page-subtitle mb-0">${subtitle}</p></div>${action}</div>`
}

function stat(label, value, note, icon) {
    return `<div class="col-6 col-xl-3"><div class="stat-card"><div class="d-flex justify-content-between stat-label">${label}<span>${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div></div>`
}

function badge(status) {
    let cls = ['Delivered', 'Confirmed', 'Completed'].includes(status) ? 'green' : ['Pending', 'Processing', 'Shipped'].includes(status) ? 'amber' : ['Cancelled'].includes(status) ? 'red' : '';
    return `<span class="badge-status ${cls}">${esc(status)}</span>`
}

function panel(title, body, action = '') {
    return `<section class="panel mb-3"><div class="panel-head"><h2>${title}</h2>${action}</div>${body}</section>`
}

function table(headers, rows) {
    return `<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty-state">Nothing here yet.</td></tr>`}</tbody></table></div>`
}
async function renderPage() {
    try {
        const views = {
            overview: overview,
            store: storePage,
            cart: cartPage,
            orders: ordersPage,
            appointments: appointmentsPage,
            inventory: inventoryPage,
            customers: customersPage
        };
        $('#pageContent').innerHTML = await views[state.page]()
    } catch (e) {
        $('#pageContent').innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`
    }
}
async function overview() {
    const [p, o, a] = await Promise.all([api(state.user.role === 'admin' ? 'inventory' : 'products'), api('orders'), api('appointments')]);
    state.products = p.products;
    state.orders = o.orders;
    state.appointments = a.appointments;
    const admin = state.user.role === 'admin';
    if (!admin) return head(`Welcome, ${esc(state.user.name)}`, 'Shop products or book a service visit.', `<button class="btn btn-primary" onclick="go('store')">Shop products</button>`) + `<div class="row g-3 mb-4">${stat('My orders',o.orders.length,'Your purchases','▤')}${stat('My appointments',a.appointments.length,'Scheduled visits','▦')}</div>` + appointmentsMini(a.appointments) + ordersPanel(o.orders.slice(0, 5), false) + productsGrid(p.products.slice(0, 3));
    const openOrders = o.orders.filter(x => x.status === 'Processing').length,
        low = p.products.filter(x => Number(x.stock) < 10).length;
    return head('Store overview', 'Manage sales, stock, and service visits.', `<button class="btn btn-primary" onclick="openAppointment()">＋ Book appointment</button>`) + `<div class="row g-3 mb-4">${stat('Orders',o.orders.length,'All customer purchases','▤')}${stat('Open orders',openOrders,'Processing','◷')}${stat('Appointments',a.appointments.length,'Service visits on file','▦')}${stat('Low stock',low,'Products below 10 units','⚠')}</div>` + `<div class="row g-3"><div class="col-xl-7">${ordersPanel(o.orders.slice(0,6),true)}</div><div class="col-xl-5">${appointmentsMini(a.appointments.slice(0,5))}</div></div>`
}

function appointmentsMini(list) {
    return panel('Upcoming service visits', `<div class="panel-body">${list.length?list.map(a=>`<div class="service-row"><div class="service-icon">${a.service.toLowerCase().includes('clean')?'✨':'🔧'}</div><div class="service-copy"><b>${esc(a.customer||state.user.name)} · ${esc(a.service)}</b><small>${esc(a.service_mode||'Home Service')} · ${esc(a.visit_date)} · ${esc(String(a.visit_time).slice(0,5))}</small></div>${badge(a.status)}</div>`).join(''):'<div class="empty-state">No service visits scheduled.</div>'}</div>`, `<button class="btn btn-sm btn-outline-secondary" onclick="go('appointments')">View schedule</button>`)
}

function ordersPanel(list, admin) {
    return panel(admin ? 'Recent orders' : 'My recent orders', table(['Order', 'Customer', 'Items', 'Date', 'Total', 'Status', ...(admin ? ['Update'] : [])], list.map(o => `<tr><td><b>#${o.id}</b></td><td>${esc(o.customer)}</td><td>${esc(o.items)}</td><td>${new Date(o.created_at).toLocaleDateString()}</td><td>${money(o.total)}</td><td>${badge(o.status)}</td>${admin?`<td><select class="form-select form-select-sm" onchange="updateOrder(${o.id},this.value)">${['Processing','Shipped','Delivered','Cancelled'].map(x=>`<option ${x===o.status?'selected':''}>${x}</option>`).join('')}</select></td>`:''}</tr>`).join('')), `<button class="btn btn-sm btn-outline-secondary" onclick="go('orders')">View all</button>`)
}

function productArt(p) {
    return p.image_path ? `<div class="product-art"><img src="${esc(p.image_path)}" alt="${esc(p.name)}" loading="lazy"></div>` : `<div class="product-art">${esc(p.icon)}</div>`
}

function storeProductCards(products) {
    return products.length ? `<div class="row g-3">${products.map(p=>`<div class="col-6 col-lg-4 col-xxl-3"><article class="product-card product-clickable" onclick="openProductDetails(${p.id})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductDetails(${p.id})}">${productArt(p)}<div class="product-body"><div class="text-secondary small mb-1">${esc(p.category)} · ${p.stock} in stock</div><h3>${esc(p.name)}</h3><div class="d-flex justify-content-between align-items-center"><span class="product-price">${money(p.price)}</span><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();buyProduct(${p.id})" ${Number(p.stock)<1?'disabled':''}>Order</button></div></div></article></div>`).join('')}</div>` : '<div class="empty-state">No matching products. Try another search or category.</div>'
}

function filteredStoreProducts() {
    const query = state.productSearch.trim().toLocaleLowerCase();
    return state.products.filter(p => (state.storeCategory === 'All' || p.category === state.storeCategory) && (!query || [p.name, p.category, p.sku, p.description].some(value => String(value || '').toLocaleLowerCase().includes(query))))
}

function updateStoreListing() {
    const products = filteredStoreProducts();
    const title = $('#storeResultsTitle'),
        count = $('#storeResultsCount'),
        grid = $('#storeProductGrid');
    if (title) title.textContent = state.storeCategory === 'All' ? 'All products' : state.storeCategory;
    if (count) count.textContent = `${products.length} ${products.length===1?'product':'products'}`;
    if (grid) grid.innerHTML = storeProductCards(products)
}

function searchProducts(query) {
    state.productSearch = query;
    updateStoreListing()
}

function storeCategoryTiles(products) {
    const all = [{
        name: 'All',
        label: 'All products',
        items: products
    }, ...state.storeCategories.map(category => ({
        name: category.name,
        items: products.filter(p => p.category === category.name)
    }))];
    return `<div class="row g-3 mb-4">${all.map((category,index)=>(`<div class="col-6 col-md-4 col-xl-3"><button type="button" class="category-tile ${state.storeCategory===category.name?'selected':''}" onclick="filterStoreCategory(${index})"><span class="category-tile-copy"><b>${esc(category.label||category.name)}</b><small>${category.items.length} ${category.items.length===1?'item':'items'}</small></span></button></div>`)).join('')}</div>`
}

function storeBannerMarkup(path) {
    return path ? `<div class="store-banner"><img src="${esc(path)}" alt="Store banner"><div class="store-banner-copy"><span>CORE COMPONENTS</span><h2>Build Your Dream Setup</h2><p>Explore products selected for your setup.</p></div></div>` : ''
}
async function storePage() {
    const [{
        products
    }, {
        categories
    }, banner] = await Promise.all([api('products'), api('categories'), api('store-banner')]);
    state.products = products;
    state.storeCategories = categories;
    state.storeBanner = banner.image_path;
    if (state.storeCategory !== 'All' && !state.storeCategories.some(c => c.name === state.storeCategory)) state.storeCategory = 'All';
    const matching = filteredStoreProducts();
    return head('Online store', 'Browse products by category and place an order.') + storeBannerMarkup(state.storeBanner) + `<section class="mb-4"><h2 class="store-section-title">Shop by category</h2>${storeCategoryTiles(products)}</section><section><div class="store-results-head"><h2 class="store-section-title" id="storeResultsTitle">${esc(state.storeCategory==='All'?'All products':state.storeCategory)}</h2><span class="text-secondary small" id="storeResultsCount">${matching.length} ${matching.length===1?'product':'products'}</span></div><div class="store-search mb-3"><input class="form-control" type="search" aria-label="Search products" placeholder="Search by product, category, SKU, or description" value="${esc(state.productSearch)}" oninput="searchProducts(this.value)"></div><div id="storeProductGrid">${storeProductCards(matching)}</div></section>`
}
async function filterStoreCategory(index) {
    const name = index === 0 ? 'All' : state.storeCategories[index - 1]?.name;
    if (name === undefined) return;
    state.storeCategory = name;
    document.querySelectorAll('.category-tile').forEach((tile, i) => tile.classList.toggle('selected', i === index));
    updateStoreListing()
}

function productsGrid(products) {
    return panel('Popular essentials', `<div class="panel-body"><div class="row g-3">${products.map(p=>`<div class="col-md-4"><div class="product-card product-clickable" onclick="openProductDetails(${p.id})" role="button" tabindex="0">${productArt(p)}<div class="product-body"><h3>${esc(p.name)}</h3><div class="d-flex justify-content-between"><b>${money(p.price)}</b><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();buyProduct(${p.id})">Order</button></div></div></div></div>`).join('')}</div></div>`, `<button class="btn btn-sm btn-outline-secondary" onclick="go('store')">Shop all</button>`)
}
async function ordersPage() {
    const {
        orders
    } = await api('orders');
    state.orders = orders;
    const admin = state.user.role === 'admin';
    return head(admin ? 'All orders' : 'My orders', 'Review purchase history and fulfillment status.') + `<div class="panel">${table(['Order','Customer','Items','Date','Total','Payment','Status',...(admin?['Update order','Payment update']:[]),'Receipt'],orders.map(o=>`<tr><td><b>#${o.id}</b></td><td>${esc(o.customer)}</td><td>${esc(o.items)}</td><td>${new Date(o.created_at).toLocaleDateString()}</td><td>${money(o.total)}</td><td><small>${esc(o.payment_method||'Not recorded')}</small><br>${badge(o.payment_status||'Not recorded')}</td><td>${badge(o.status)}</td>${admin?`<td><select class="form-select form-select-sm" onchange="updateOrder(${o.id},this.value)">${['Processing','Shipped','Delivered','Cancelled'].map(x=>`<option ${x===o.status?'selected':''}>${x}</option>`).join('')}</select></td><td><select class="form-select form-select-sm" onchange="updatePayment(${o.id},this.value)">${['Pending','Paid','Failed'].map(x=>`<option ${x===(o.payment_status||'Pending')?'selected':''}>${x}</option>`).join('')}</select></td>`:''}<td><button class="btn btn-sm btn-outline-primary" onclick="openReceipt(${o.id})">View receipt</button></td></tr>`).join(''))}</div>`
}
async function appointmentsPage() {
    const {
        appointments
    } = await api('appointments');
    state.appointments = appointments;
    const admin = state.user.role === 'admin';
    const action = `<button class="btn btn-primary" onclick="openAppointment()">＋ Book appointment</button>`;
    return head(admin ? 'Appointments' : 'My appointments', admin ? 'Schedule and manage cleaning or troubleshooting visits.' : 'View your appointments and book a new service.', action) + (admin ? calendar(appointments) : appointmentsMini(appointments)) + (admin ? panel('All scheduled appointments', table(['Customer', 'Service', 'Service type', 'Date', 'Time', 'Address', 'Status', 'Update'], appointments.map(a => `<tr><td>${esc(a.customer)}</td><td>${esc(a.service)}</td><td>${esc(a.service_mode||'Home Service')}</td><td>${esc(a.visit_date)}</td><td>${esc(String(a.visit_time).slice(0,5))}</td><td>${esc(a.address||'—')}</td><td>${badge(a.status)}</td><td><select class="form-select form-select-sm" onchange="updateAppointment(${a.id},this.value)">${['Pending','Confirmed','Completed','Cancelled'].map(x=>`<option ${x===a.status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join(''))) : '')
}

function calendar(appointments) {
    const now = new Date(),
        first = new Date(now.getFullYear(), now.getMonth(), 1),
        offset = first.getDay(),
        count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let cells = Array.from({
        length: 42
    }, (_, i) => {
        const n = i - offset + 1,
            d = new Date(now.getFullYear(), now.getMonth(), n),
            valid = n > 0 && n <= count,
            key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
            items = appointments.filter(a => a.visit_date === key);
        return `<div class="calendar-day ${valid?'':'text-secondary opacity-50'}"><b>${d.getDate()}</b>${items.map(a=>`<div class="calendar-event ${a.service.toLowerCase().includes('trouble')?'tech':''}">${esc(String(a.visit_time).slice(0,5))} ${esc(a.customer)}</div>`).join('')}</div>`
    }).join('');
    return `<section class="panel mb-3"><div class="panel-head"><h2>${first.toLocaleDateString(undefined,{month:'long',year:'numeric'})} calendar</h2></div><div class="panel-body overflow-auto"><div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="calendar-head">${x}</div>`).join('')}${cells}</div></div></section>`
}
async function inventoryPage() {
    const [{
        products
    }, {
        categories
    }, banner] = await Promise.all([api('inventory'), api('categories'), api('store-banner')]);
    state.products = products;
    state.shopCategories = categories;
    state.storeBanner = banner.image_path;
    return head('Inventory', 'Update product details, stock, and shop categories.', `<button class="btn btn-primary" onclick="openProduct()">＋ Add product</button>`) + storeBannerPanel(banner.image_path) + categoryAdminPanel(categories) + `<div class="panel">${table(['Product','SKU','Category','Price','Stock','Availability','Adjust'],products.map(p=>`<tr><td><div class="d-flex align-items-center gap-2">${p.image_path?`<img class="inventory-thumb" src="${esc(p.image_path)}" alt="">`:`<span>${esc(p.icon)}</span>`}<b>${esc(p.name)}</b></div></td><td>${esc(p.sku)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${Number(p.stock)<10?'<span class="badge-status amber">Low stock</span>':'<span class="badge-status green">In stock</span>'}</td><td><button class="btn btn-sm btn-outline-secondary" onclick="adjustStock(${p.id},-1)">−</button> <button class="btn btn-sm btn-outline-secondary" onclick="adjustStock(${p.id},1)">＋</button></td></tr>`).join(''))}</div>`
}

function storeBannerPanel(path) {
    return panel('Online store banner', `<div class="panel-body"><p class="text-secondary small"></p>${path?`<div class="banner-admin-preview"><img src="${esc(path)}" alt="Current store banner"></div>`:'<div class="banner-admin-empty">No banner picture added yet.</div>'}<button class="btn btn-sm btn-outline-primary mt-3" onclick="openStoreBanner()">${path?'Edit banner picture':'Add banner picture'}</button></div>`)
}

function categoryAdminPanel(categories) {
    return panel('Shop categories', `<div class="panel-body"><div class="row g-3">${categories.map((c,index)=>`<div class="col-6 col-md-4 col-xl-3"><div class="category-admin-card"><div class="category-admin-copy"><b>${esc(c.name)}</b><small>${c.product_count} ${Number(c.product_count)===1?'item':'items'}</small><button class="btn btn-sm btn-outline-primary mt-2" onclick="openCategoryName(${index})">Edit name</button></div></div></div>`).join('')||'<div class="empty-state">Add a product to create a shop category.</div>'}</div></div>`)
}
async function customersPage() {
    const {
        customers
    } = await api('customers');
    return head('Customers', 'Customer accounts, store orders, and service visits.') + `<div class="panel">${table(['Customer','Email','Orders','Appointments','Lifetime value'],customers.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.email)}</td><td>${c.order_count}</td><td>${c.appointment_count}</td><td>${money(c.lifetime_value)}</td></tr>`).join(''))}</div>`
}

function openModal(title, html, submitLabel, handler) {
    $('#modalTitle').textContent = title;
    $('#modalSubmit').textContent = submitLabel;
    $('#modalBody').innerHTML = html;
    $('#modalAddToCart').classList.add('d-none');
    $('#modalAddToCart').onclick = null;
    $('#modalPrintReceipt').classList.add('d-none');
    $('#modalPrintReceipt').onclick = null;
    $('#modalSubmit').classList.remove('d-none');
    $('#modalSubmit').disabled = false;
    const modal = bootstrap.Modal.getOrCreateInstance($('#appModal'));
    $('#modalForm').onsubmit = async e => {
        e.preventDefault();
        try {
            await handler(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget);
            modal.hide();
            await renderPage()
        } catch (error) {
            showAlert(error.message, 'danger')
        }
    };
    modal.show()
}

function field(label, name, type = 'text', required = true, extra = '') {
    return `<div class="mb-3"><label class="form-label">${label}</label><input class="form-control" name="${name}" type="${type}" ${required?'required':''} ${extra}></div>`
}
async function openProductDetails(id) {
    let p = state.products.find(x => Number(x.id) === Number(id));
    if (!p) p = (await api('products')).products.find(x => Number(x.id) === Number(id));
    if (!p) return;
    const available = Number(p.stock) > 0;
    openModal('Product details', `<div class="row g-3 align-items-start"><div class="col-sm-5">${productArt(p)}</div><div class="col-sm-7"><div class="text-secondary small mb-2">${esc(p.category)} · ${p.stock} in stock</div><h3 class="product-detail-title">${esc(p.name)}</h3><p class="product-detail-description">${esc(p.description||'No description available.')}</p><div class="product-detail-price">${money(p.price)}</div></div></div><hr>${field('Quantity','quantity','number',true,`min="1" max="${Math.max(1,Number(p.stock))}" value="1"`)}`, 'Continue to checkout', async v => {
        $('#appModal').addEventListener('hidden.bs.modal', () => openCheckout([{
            product_id: Number(id),
            quantity: Number(v.quantity)
        }]), {
            once: true
        });
    });
    $('#modalSubmit').disabled = !available;
    const addButton = $('#modalAddToCart');
    addButton.classList.remove('d-none');
    addButton.disabled = !available;
    addButton.onclick = () => {
        try {
            const quantity = Number($('#modalBody [name="quantity"]').value);
            addToCart(p, quantity);
            bootstrap.Modal.getInstance($('#appModal')).hide();
            showAlert('Added to your cart. You can check out later.')
        } catch (error) {
            showAlert(error.message, 'danger')
        }
    }
}

function addToCart(product, quantity = 1) {
    quantity = Number(quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Enter a valid quantity.');
    const existing = state.cart.find(item => item.id === Number(product.id)),
        next = (existing?.quantity || 0) + quantity;
    if (next > 99 || next > Number(product.stock)) throw new Error('That quantity is more than the available stock.');
    if (existing) existing.quantity = next;
    else state.cart.push({
        id: Number(product.id),
        quantity
    });
    saveCart()
}

function setCartQuantity(id, value) {
    const item = state.cart.find(x => x.id === Number(id)),
        product = state.products.find(x => Number(x.id) === Number(id));
    if (!item || !product) return;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, Number(product.stock))) {
        showAlert('Enter a quantity within available stock.', 'danger');
        renderPage();
        return
    }
    item.quantity = quantity;
    saveCart();
    renderPage()
}

function removeCartItem(id) {
    state.cart = state.cart.filter(item => item.id !== Number(id));
    saveCart();
    renderPage()
}
async function cartPage() {
    const {
        products
    } = await api('products');
    state.products = products;
    if (!state.cart.length) return head('Your cart', 'Review items and check out when you are ready.') + panel('Shopping cart', '<div class="empty-state">Your cart is empty. <button class="btn btn-sm btn-primary ms-2" onclick="go(\'store\')">Browse products</button></div>');
    const rows = state.cart.map(item => {
        const p = products.find(product => Number(product.id) === item.id);
        if (!p) return `<tr><td colspan="5">This product is no longer available. <button class="btn btn-sm btn-outline-danger" onclick="removeCartItem(${item.id})">Remove</button></td></tr>`;
        const available = Number(p.stock) >= item.quantity;
        return `<tr><td><div class="d-flex align-items-center gap-2"><img class="cart-thumb" src="${esc(p.image_path||'')}" alt="" ${p.image_path?'':'hidden'}><b>${esc(p.name)}</b></div>${available?'':`<small class="text-danger">Only ${p.stock} in stock</small>`}</td><td>${money(p.price)}</td><td><input class="form-control form-control-sm cart-quantity" type="number" min="1" max="${Math.max(1,Math.min(99,Number(p.stock)))}" value="${item.quantity}" onchange="setCartQuantity(${item.id},this.value)" aria-label="Quantity for ${esc(p.name)}"></td><td>${money(Number(p.price)*item.quantity)}</td><td><button class="btn btn-sm btn-outline-danger" onclick="removeCartItem(${item.id})">Remove</button></td></tr>`
    }).join('');
    const total = state.cart.reduce((sum, item) => {
            const p = products.find(product => Number(product.id) === item.id);
            return sum + (p ? Number(p.price) * item.quantity : 0)
        }, 0),
        canCheckout = state.cart.every(item => {
            const p = products.find(product => Number(product.id) === item.id);
            return p && Number(p.stock) >= item.quantity
        });
    return head('Your cart', 'Review items and check out when you are ready.') + `<div class="panel">${table(['Product','Price','Quantity','Subtotal',''],rows)}<div class="cart-summary"><b>Total: ${money(total)}</b><button class="btn btn-primary" onclick="checkoutCart()" ${canCheckout?'':'disabled'}>Checkout</button></div></div>`
}
async function checkoutCart() {
    openCheckout(state.cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity
    })), true)
}
async function buyProduct(id) {
    const p = state.products.find(x => Number(x.id) === Number(id)) || (await api('products')).products.find(x => Number(x.id) === Number(id));
    openCheckout([{
        product_id: Number(id),
        quantity: 1
    }])
}

function openCheckout(items, clearCart = false) {
    const products = items.map(item => ({
        ...item,
        product: state.products.find(p => Number(p.id) === Number(item.product_id))
    }));
    if (!products.length || products.some(item => !item.product)) {
        showAlert('One or more products are no longer available. Review your cart.', 'danger');
        return
    }
    const total = products.reduce((sum, item) => sum + Number(item.product.price) * Number(item.quantity), 0);
    const userName = esc(state.user?.name || ''), userEmail = esc(state.user?.email || '');
    const html = `<div class="checkout-summary"><b>${products.length} ${products.length===1?'item':'items'}</b><span>${money(total)}</span></div><p class="text-secondary small">Debit card payment will remain pending until the store confirms it.</p>${field('Billing name','billing_name','text',true,`maxlength="120" value="${userName}"`)}${field('Billing email','billing_email','email',true,`maxlength="190" value="${userEmail}"`)}<div class="mb-3"><label class="form-label">Billing address</label><textarea class="form-control" name="billing_address" maxlength="255" rows="2" required></textarea></div><div class="mb-3"><label class="form-label">Payment method</label><select class="form-select" name="payment_method" required><option value="Debit Card">Debit Card</option></select></div>`;
    openModal('Billing and payment', html, 'Place order', async billing => {
        const result = await api('orders', {
            method: 'POST',
            body: JSON.stringify({
                items: items.map(item => ({
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity)
                })),
                billing_name: billing.billing_name,
                billing_email: billing.billing_email,
                billing_address: billing.billing_address,
                payment_method: billing.payment_method
            })
        });
        if (clearCart) {
            state.cart = [];
            saveCart()
        }
        showAlert('Order placed. Your receipt is ready.');
        $('#appModal').addEventListener('hidden.bs.modal', () => openReceipt(result.order_id), {
            once: true
        })
    })
}

async function openReceipt(id) {
    try {
        const {
            receipt
        } = await api('receipt', {
            query: {
                id
            }
        });
        const lines = receipt.items.map(item => `<tr><td>${esc(item.product_name)}</td><td>${item.quantity}</td><td>${money(item.unit_price)}</td><td>${money(Number(item.unit_price)*Number(item.quantity))}</td></tr>`).join('');
        const address = esc(receipt.billing_address || 'Not provided').replace(/\n/g, '<br>');
        $('#modalTitle').textContent = 'Customer receipt';
        $('#modalBody').innerHTML = `<article class="receipt-print"><header class="receipt-heading"><div><b>CORE COMPONENTS</b><div class="text-secondary small">Sales receipt</div></div><div class="text-end"><b>${esc(receipt.receipt_number)}</b><div class="text-secondary small">${new Date(receipt.created_at).toLocaleString()}</div></div></header><hr><div class="row g-3 mb-3"><div class="col-sm-6"><b>Bill to</b><div>${esc(receipt.billing_name||receipt.customer)}</div><div>${esc(receipt.billing_email||receipt.account_email)}</div><div>${address}</div></div><div class="col-sm-6"><b>Payment</b><div>${esc(receipt.payment_method||'Not recorded')}</div><div>Status: ${esc(receipt.payment_status||'Not recorded')}</div><div>Order status: ${esc(receipt.status)}</div></div></div>${table(['Item','Qty','Unit price','Amount'],lines)}<div class="receipt-total"><span>Total</span><b>${money(receipt.total)}</b></div><p class="receipt-note">Debit card payment is pending until confirmed by the store.</p></article>`;
        $('#modalAddToCart').classList.add('d-none');
        $('#modalPrintReceipt').classList.remove('d-none');
        $('#modalPrintReceipt').onclick = () => window.print();
        $('#modalSubmit').classList.add('d-none');
        $('#modalForm').onsubmit = e => e.preventDefault();
        bootstrap.Modal.getOrCreateInstance($('#appModal')).show()
    } catch (error) {
        showAlert(error.message, 'danger')
    }
}

function openAppointment() {
    openModal('Book a service appointment', `<div class="mb-3"><label class="form-label">Service type</label><select class="form-select" name="service"><option>Standard cleaning</option><option>Deep cleaning</option><option>Troubleshooting</option></select></div><div class="mb-3"><label class="form-label">Visit option</label><select class="form-select" id="appointmentMode" name="service_mode" required><option>Home Service</option><option>Walk-in</option></select></div>${field('Date','visit_date','date')}${field('Start time','visit_time','time')}<div id="appointmentAddressGroup">${field('Service address','address','text',true)}</div>`, 'Book visit', async v => {
        await api('appointments', {
            method: 'POST',
            body: JSON.stringify(v)
        });
        showAlert('Appointment request submitted.')
    });
    const mode = $('#appointmentMode'),
        addressGroup = $('#appointmentAddressGroup'),
        address = addressGroup.querySelector('[name="address"]');
    mode.addEventListener('change', () => {
        const home = mode.value === 'Home Service';
        addressGroup.classList.toggle('d-none', !home);
        address.required = home;
        if (!home) address.value = ''
    })
}

function openProduct() {
    openModal('Add a product', field('SKU', 'sku') + field('Product name', 'name') + field('Category', 'category', 'text', true, 'maxlength="80" placeholder="For example: Graphics Cards"') + field('Description', 'description') + field('Price', 'price', 'number', true, 'step="0.01" min="0"') + field('Stock', 'stock', 'number', true, 'min="0"') + field('Product picture (JPG, PNG, or WebP; up to 5 MB)', 'image', 'file', false, 'accept="image/jpeg,image/png,image/webp"') + field('Icon / emoji fallback', 'icon', 'text', false, 'value="📦"'), 'Add product', async (v, form) => {
        await api('inventory', {
            method: 'POST',
            body: new FormData(form)
        });
        showAlert('Product added to inventory.')
    })
}

function openStoreBanner() {
    openModal(`${state.storeBanner?'Edit':'Add'} store banner`, `<p class="text-secondary small">Use a wide image (3:1 recommended), JPG, PNG, or WebP, up to 5 MB.</p>${field('Banner picture','image','file',true,'accept="image/jpeg,image/png,image/webp"')}`, 'Save banner', async (v, form) => {
        await api('store-banner', {
            method: 'POST',
            body: new FormData(form)
        });
        showAlert('Store banner saved.')
    })
}

function openCategoryName(index) {
    const category = state.shopCategories[index];
    if (!category) return;
    openModal('Edit category name', `<input type="hidden" name="category" value="${esc(category.name)}">${field('Category name','new_name','text',true,`maxlength="80" value="${esc(category.name)}"`)}`, 'Save name', async v => {
        await api('categories', {
            method: 'PATCH',
            body: JSON.stringify(v)
        });
        showAlert('Category renamed and its products updated.')
    })
}
async function updateOrder(id, status) {
    try {
        await api('orders', {
            method: 'PATCH',
            body: JSON.stringify({
                id,
                status
            })
        });
        showAlert('Order updated.');
        await renderPage()
    } catch (e) {
        showAlert(e.message, 'danger')
    }
}
async function updatePayment(id, payment_status) {
    try {
        await api('orders', {
            method: 'PATCH',
            body: JSON.stringify({
                id,
                payment_status
            })
        });
        showAlert('Payment status updated.');
        await renderPage()
    } catch (error) {
        showAlert(error.message, 'danger')
    }
}
async function updateAppointment(id, status) {
    try {
        await api('appointments', {
            method: 'PATCH',
            body: JSON.stringify({
                id,
                status
            })
        });
        showAlert('Appointment updated.');
        await renderPage()
    } catch (e) {
        showAlert(e.message, 'danger')
    }
}
async function adjustStock(id, change) {
    try {
        const {
            products
        } = await api('inventory');
        const p = products.find(x => Number(x.id) === Number(id));
        await api('inventory', {
            method: 'PATCH',
            body: JSON.stringify({
                id,
                stock: Math.max(0, Number(p.stock) + change)
            })
        });
        await renderPage()
    } catch (e) {
        showAlert(e.message, 'danger')
    }
}
boot();
