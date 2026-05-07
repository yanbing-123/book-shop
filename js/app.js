(function() {
  'use strict';

  // ===== 商品数据 =====
  const PRODUCTS = [
    { id: 1,  name: '红楼梦',       author: '曹雪芹',               category: '文学', price: 59.00,  stock: 30, emoji: '📕' },
    { id: 2,  name: '三体',         author: '刘慈欣',               category: '科幻', price: 68.00,  stock: 25, emoji: '📗' },
    { id: 3,  name: '人类简史',     author: '尤瓦尔·赫拉利',       category: '历史', price: 45.00,  stock: 20, emoji: '📘' },
    { id: 4,  name: '小王子',       author: '安托万·德·圣-埃克苏佩里', category: '儿童', price: 28.00,  stock: 50, emoji: '📖' },
    { id: 5,  name: '活着',         author: '余华',                 category: '小说', price: 35.00,  stock: 40, emoji: '📕' },
    { id: 6,  name: 'Python编程',   author: '埃里克·马瑟斯',         category: '科技', price: 89.00,  stock: 15, emoji: '📗' },
    { id: 7,  name: '资本论',       author: '卡尔·马克思',           category: '社科', price: 128.00, stock: 10, emoji: '📘' },
    { id: 8,  name: '十万个为什么', author: '儿童百科编委会',         category: '儿童', price: 49.00,  stock: 35, emoji: '📖' },
    { id: 9,  name: '百年孤独',     author: '加西亚·马尔克斯',       category: '小说', price: 42.00,  stock: 20, emoji: '📕' },
    { id: 10, name: '时间简史',     author: '史蒂芬·霍金',           category: '科技', price: 55.00,  stock: 18, emoji: '📗' },
  ];

  const LS_STOCK = 'book_stock';
  const LS_CART  = 'book_cart';
  const LS_FAVORITES = 'book_favorites';

  let stockData = {};
  let cartData  = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let lastOrderSnapshot = [];
  let favoriteIds = [];

  // ===== 初始化 =====
  function init() {
    loadStock(); loadCart(); loadFavorites(); renderProducts(); updateCartBadge(); updateCartSidebar();
  }

  // ===== 库存 =====
  function loadStock() {
    const saved = localStorage.getItem(LS_STOCK);
    if (saved) {
      stockData = JSON.parse(saved);
    } else {
      PRODUCTS.forEach(p => { stockData[p.id] = p.stock; });
      saveStock();
    }
  }

  function saveStock() { localStorage.setItem(LS_STOCK, JSON.stringify(stockData)); }

  // ===== 收藏夹 =====
  function loadFavorites() {
    const saved = localStorage.getItem(LS_FAVORITES);
    if (saved) favoriteIds = JSON.parse(saved);
  }
  function saveFavorites() { localStorage.setItem(LS_FAVORITES, JSON.stringify(favoriteIds)); }
  function isFavorite(id) { return favoriteIds.includes(id); }
  function toggleFavorite(id) {
    const idx = favoriteIds.indexOf(id);
    if (idx >= 0) { favoriteIds.splice(idx, 1); }
    else          { favoriteIds.push(id); }
    saveFavorites(); renderProducts();
  }

  // ===== 购物车 =====
  function loadCart() {
    const saved = localStorage.getItem(LS_CART);
    if (saved) cartData = JSON.parse(saved);
  }

  function saveCart() { localStorage.setItem(LS_CART, JSON.stringify(cartData)); }

  function cartIndex(id) { return cartData.findIndex(item => item.id === id); }
  function getCartCount() { return cartData.reduce((s, item) => s + item.quantity, 0); }
  function getCartTotal()  { return cartData.reduce((s, item) => s + item.price * item.quantity, 0); }

  // ===== 商品渲染 =====
  function renderProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    PRODUCTS.forEach(p => {
      const stock = stockData[p.id] ?? p.stock;
      const outOfStock = stock <= 0;
      const isLow = stock > 0 && stock <= 5;
      let show;
      if (currentCategory === 'favorites') {
        show = favoriteIds.includes(p.id);
      } else {
        show = currentCategory === 'all' || p.category === currentCategory;
      }
      if (searchQuery) {
        show = show && p.name.includes(searchQuery);
      }
      if (!show) return;

      let stockClass = '';
      let stockText = '库存：' + stock + '册';
      if (outOfStock) { stockClass = 'empty'; stockText = '缺货'; }
      else if (isLow)  { stockClass = 'low';   stockText += ' (紧张)'; }

      const div = document.createElement('div');
      div.className = 'product-card' + (outOfStock ? ' out-of-stock' : '');
      div.innerHTML = `
        <div class="card-cover">
          ${p.emoji}
          <span class="fav-toggle ${isFavorite(p.id) ? 'active' : ''}" onclick="window._book.toggleFavorite(${p.id})">${isFavorite(p.id) ? '♥' : '♡'}</span>
        </div>
        <div class="card-body">
          <span class="card-cat ${p.category}">${p.category}</span>
          <div class="card-name">${p.name}</div>
          <div class="card-author">${p.author}</div>
          <div class="card-price">¥${p.price.toFixed(2)}</div>
          <div class="card-stock ${stockClass}">${stockText}</div>
          <button class="btn-add" onclick="window._book.addToCart(${p.id})" ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? '缺货' : '加入购物车'}
          </button>
        </div>`;
      grid.appendChild(div);
    });
  }

  // ===== 筛选 =====
  function filterByCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat || (cat === 'all' && btn.dataset.cat === 'all'));
    });
    renderProducts();
  }

  // ===== 搜索 =====
  function searchBooks(query) {
    searchQuery = query.trim();
    renderProducts();
  }

  // ===== 购物车操作 =====

  // Bug防护：addToCart 验证库存上限
  function addToCart(id) {
    const stock = stockData[id] ?? 0;
    const idx = cartIndex(id);
    const current = idx >= 0 ? cartData[idx].quantity : 0;
    if (current >= stock) {
      const p = PRODUCTS.find(x => x.id === id);
      showToast(p.name + ' 已达库存上限 (' + stock + '册)');
      return;
    }
    const product = PRODUCTS.find(x => x.id === id);
    if (idx >= 0) {
      cartData[idx].quantity++;
    } else {
      cartData.push({ id, name: product.name, author: product.author, category: product.category, price: product.price, emoji: product.emoji, quantity: 1 });
    }
    saveCart(); updateCartBadge(); updateCartSidebar(); renderProducts();
    showToast('已加入购物车 ✓');
  }

  // Bug防护：updateQuantity 验证库存上限
  function updateQuantity(id, delta) {
    const stock = stockData[id] ?? 0;
    const idx = cartIndex(id);
    if (idx < 0) return;
    const next = cartData[idx].quantity + delta;
    if (next <= 0) { removeFromCart(id); return; }
    if (next > stock) {
      const p = PRODUCTS.find(x => x.id === id);
      showToast(p.name + ' 数量不能超过库存 (' + stock + '册)');
      return;
    }
    cartData[idx].quantity = next;
    saveCart(); updateCartSidebar(); updateCartBadge(); renderProducts();
  }

  function removeFromCart(id) {
    cartData = cartData.filter(item => item.id !== id);
    saveCart(); updateCartBadge(); updateCartSidebar(); renderProducts();
  }

  function clearCart() {
    if (cartData.length === 0) return;
    if (!confirm('确定要清空购物车吗？此操作不可撤销。')) return;
    cartData = []; saveCart(); updateCartBadge(); updateCartSidebar(); renderProducts();
    showToast('购物车已清空');
  }

  // ===== UI 更新 =====
  function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const count = getCartCount();
    badge.textContent = count;
    badge.className = 'cart-badge' + (count === 0 ? ' zero' : '');
  }

  function updateCartSidebar() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (cartData.length === 0) {
      container.innerHTML = '<div class="cart-empty">购物车是空的，快去挑选书籍吧~</div>';
      totalEl.textContent = '¥0.00'; checkoutBtn.disabled = true; return;
    }
    checkoutBtn.disabled = false;
    container.innerHTML = '';
    cartData.forEach(item => {
      const stock = stockData[item.id] ?? 0;
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <span class="cart-item-emoji">${item.emoji}</span>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-author">${item.author}</div>
          <div class="cart-item-price">¥${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="window._book.updateQuantity(${item.id}, -1)" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="window._book.updateQuantity(${item.id}, 1)" ${item.quantity >= stock ? 'disabled' : ''}>+</button>
        </div>
        <button class="btn-delete" onclick="window._book.removeFromCart(${item.id})">🗑</button>`;
      container.appendChild(el);
    });
    totalEl.textContent = '¥' + getCartTotal().toFixed(2);
  }

  function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('open');
    document.getElementById('cartOverlay').classList.toggle('show');
  }

  // ===== 结算 =====
  function openCheckout() {
    if (cartData.length === 0) return;
    for (const item of cartData) {
      const stock = stockData[item.id] ?? 0;
      if (item.quantity > stock) { showToast('部分商品库存不足，请调整购物车'); return; }
    }
    toggleCart();
    document.getElementById('summaryCount').textContent = getCartCount();
    document.getElementById('summaryTotal').textContent = '¥' + getCartTotal().toFixed(2);
    document.getElementById('checkoutForm').reset(); clearErrors();
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('checkoutModal').classList.add('show');
  }

  function closeCheckout() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('checkoutModal').classList.remove('show');
  }

  function submitOrder(e) {
    e.preventDefault();
    if (!validateForm()) return;
    for (const item of cartData) {
      const stock = stockData[item.id] ?? 0;
      if (item.quantity > stock) { showToast('库存不足，订单无法提交'); return; }
    }

    lastOrderSnapshot = cartData.map(item => ({
      name: item.name, author: item.author, emoji: item.emoji,
      qty: item.quantity, subtotal: item.price * item.quantity,
    }));

    cartData.forEach(item => {
      stockData[item.id] = (stockData[item.id] ?? 0) - item.quantity;
    });
    saveStock();

    const orderNo = 'BK' + Date.now();
    cartData = []; saveCart();

    closeCheckout(); updateCartBadge(); updateCartSidebar(); renderProducts();

    document.getElementById('orderNo').textContent = '订单编号：' + orderNo;
    document.getElementById('orderItems').innerHTML = lastOrderSnapshot
      .map(i => i.emoji + ' ' + i.name + ' × ' + i.qty + ' = ¥' + i.subtotal.toFixed(2))
      .join('<br>');
    document.getElementById('successOverlay').classList.add('show');
    document.getElementById('successModal').classList.add('show');
  }

  function closeSuccess() {
    document.getElementById('successOverlay').classList.remove('show');
    document.getElementById('successModal').classList.remove('show');
    lastOrderSnapshot = [];
  }

  // ===== 表单验证 =====
  function validateForm() {
    let valid = true; clearErrors();
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const address = document.getElementById('userAddress').value.trim();
    if (!name) { showError('userName', 'errorName', '请输入收货人姓名'); valid = false; }
    if (!phone) { showError('userPhone', 'errorPhone', '请输入手机号'); valid = false; }
    else if (!/^1[3-9]\d{9}$/.test(phone)) { showError('userPhone', 'errorPhone', '手机号格式不正确'); valid = false; }
    if (!address) { showError('userAddress', 'errorAddress', '请输入收货地址'); valid = false; }
    else if (address.length < 5) { showError('userAddress', 'errorAddress', '地址太短，请填写完整'); valid = false; }
    return valid;
  }

  function showError(inputId, errorId, msg) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = msg;
  }

  function clearErrors() {
    ['userName', 'userPhone', 'userAddress'].forEach(id => document.getElementById(id).classList.remove('error'));
    ['errorName', 'errorPhone', 'errorAddress'].forEach(id => document.getElementById(id).textContent = '');
  }

  // ===== Toast =====
  function showToast(msg) {
    const old = document.getElementById('toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(92,64,51,0.92);color:#FDF6E3;padding:10px 24px;border-radius:20px;font-size:0.88rem;z-index:9999;white-space:nowrap;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 1800);
  }

  // ===== 暴露关键函数到 window =====
  window._book = { addToCart, updateQuantity, removeFromCart, clearCart, toggleCart, openCheckout, closeCheckout, submitOrder, closeSuccess, filterByCategory, toggleFavorite, searchBooks };

  init();

})();
