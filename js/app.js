(function() {
  'use strict';

  // ===== 商品数据 =====
  var PRODUCTS = [
    { id: 1,  name: '红楼梦',       author: '曹雪芹',               category: '文学', price: 59.00,  stock: 30, emoji: '📕' },
    { id: 2,  name: '三体',         author: '刘慈欣',               category: '科幻', price: 68.00,  stock: 25, emoji: '📗' },
    { id: 3,  name: '人类简史',     author: '尤瓦尔·赫拉利',         category: '历史', price: 45.00,  stock: 20, emoji: '📘' },
    { id: 4,  name: '小王子',       author: '安托万·德·圣-埃克苏佩里', category: '儿童', price: 28.00,  stock: 50, emoji: '📖' },
    { id: 5,  name: '活着',         author: '余华',                 category: '小说', price: 35.00,  stock: 40, emoji: '📕' },
    { id: 6,  name: 'Python编程',   author: '埃里克·马瑟斯',           category: '科技', price: 89.00,  stock: 15, emoji: '📗' },
    { id: 7,  name: '资本论',       author: '卡尔·马克思',             category: '社科', price: 128.00, stock: 10, emoji: '📘' },
    { id: 8,  name: '十万个为什么', author: '儿童百科编委会',             category: '儿童', price: 49.00,  stock: 35, emoji: '📖' },
    { id: 9,  name: '百年孤独',     author: '加西亚·马尔克斯',           category: '小说', price: 42.00,  stock: 20, emoji: '📕' },
    { id: 10, name: '时间简史',     author: '史蒂芬·霍金',               category: '科技', price: 55.00,  stock: 18, emoji: '📗' }
  ];

  var LS_STOCK = 'book_stock';
  var LS_CART  = 'book_cart';

  var stockData = {};
  var cartData  = [];
  var currentCategory = 'all';
  var searchKeyword = '';
  var priceMin = '';
  var priceMax = '';
  var sortBy = 'default';
  var searchVisible = false;
  var lastOrderSnapshot = [];

  // ===== 初始化 =====
  function init() {
    loadStock();
    loadCart();
    renderProducts();
    updateCartBadge();
    updateCartSidebar();
    // 搜索与筛选事件
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    document.getElementById('priceMin').addEventListener('input', doPriceFilter);
    document.getElementById('priceMax').addEventListener('input', doPriceFilter);
    document.getElementById('sortSelect').addEventListener('change', function() { doSort(this.value); });
    // Ctrl+F 快捷键展开搜索
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        toggleSearch();
      }
    });
  }

  // ===== 库存 =====
  function loadStock() {
    var saved = localStorage.getItem(LS_STOCK);
    if (saved) {
      stockData = JSON.parse(saved);
    } else {
      PRODUCTS.forEach(function(p) { stockData[p.id] = p.stock; });
      saveStock();
    }
  }

  function saveStock() { localStorage.setItem(LS_STOCK, JSON.stringify(stockData)); }

  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  // ===== 购物车 =====
  function loadCart() {
    var saved = localStorage.getItem(LS_CART);
    if (saved) cartData = JSON.parse(saved);
  }

  function saveCart() { localStorage.setItem(LS_CART, JSON.stringify(cartData)); }

  function cartIndex(id) { return cartData.findIndex(function(item) { return item.id === id; }); }
  function getCartCount() { return cartData.reduce(function(s, item) { return s + item.quantity; }, 0); }
  function getCartTotal()  { return cartData.reduce(function(s, item) { return s + item.price * item.quantity; }, 0); }

  // ===== 商品渲染 =====
  function renderProducts() {
    var grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    var filtered = PRODUCTS.filter(function(p) {
      // 分类筛选
      if (currentCategory !== 'all' && p.category !== currentCategory) return false;
      // 关键词搜索（书名 + 作者，不区分大小写）
      if (searchKeyword) {
        var kw = searchKeyword.toLowerCase();
        if (p.name.toLowerCase().indexOf(kw) === -1 && p.author.toLowerCase().indexOf(kw) === -1) return false;
      }
      // 价格区间
      if (priceMin !== '') {
        var mn = parseFloat(priceMin);
        if (!isNaN(mn) && p.price < mn) return false;
      }
      if (priceMax !== '') {
        var mx = parseFloat(priceMax);
        if (!isNaN(mx) && p.price > mx) return false;
      }
      return true;
    });

    // 排序
    if (sortBy === 'price-asc') {
      filtered.sort(function(a, b) { return a.price - b.price; });
    } else if (sortBy === 'price-desc') {
      filtered.sort(function(a, b) { return b.price - a.price; });
    } else if (sortBy === 'name') {
      filtered.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
    } else if (sortBy === 'stock') {
      filtered.sort(function(a, b) {
        var sa = stockData[a.id] !== undefined ? stockData[a.id] : a.stock;
        var sb = stockData[b.id] !== undefined ? stockData[b.id] : b.stock;
        return sb - sa;
      });
    }

    // 空状态
    if (filtered.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.innerHTML = '<div class="empty-state-icon">🔍</div><div class="empty-state-text">没有找到符合条件的书籍，试试调整搜索条件吧</div>';
      grid.appendChild(emptyEl);
      return;
    }

    filtered.forEach(function(p) {
      var stock = stockData[p.id] !== undefined ? stockData[p.id] : p.stock;
      var outOfStock = stock <= 0;
      var isLow = stock > 0 && stock <= 5;

      var stockClass = '';
      var stockText = '库存：' + stock + '册';
      if (outOfStock) { stockClass = 'empty'; stockText = '缺货'; }
      else if (isLow)  { stockClass = 'low';   stockText += ' (紧张)'; }

      var card = document.createElement('div');
      card.className = 'product-card' + (outOfStock ? ' out-of-stock' : '');
      card.innerHTML =
        '<div class="card-cover">' + p.emoji + '</div>' +
        '<div class="card-body">' +
          '<span class="card-cat ' + p.category + '">' + p.category + '</span>' +
          '<div class="card-name">' + p.name + '</div>' +
          '<div class="card-author">' + p.author + '</div>' +
          '<div class="card-price">¥' + p.price.toFixed(2) + '</div>' +
          '<div class="card-stock ' + stockClass + '">' + stockText + '</div>' +
          '<button class="btn-add" onclick="window._book.addToCart(' + p.id + ')"' + (outOfStock ? ' disabled' : '') + '>' +
            (outOfStock ? '缺货' : '加入购物车') +
          '</button>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  // ===== 筛选 =====
  function filterByCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.type-btn').forEach(function(btn) {
      var isActive = (cat === 'all' && btn.dataset.cat === 'all') || btn.dataset.cat === cat;
      if (isActive) btn.classList.add('active'); else btn.classList.remove('active');
    });
    renderProducts();
  }

  // ===== 搜索与高级筛选 =====
  var handleSearchInput = debounce(function() {
    var input = document.getElementById('searchInput');
    searchKeyword = input.value.trim();
    var clearBtn = document.getElementById('searchClear');
    if (input.value) clearBtn.classList.add('show'); else clearBtn.classList.remove('show');
    renderProducts();
  }, 300);

  function doPriceFilter() {
    priceMin = document.getElementById('priceMin').value;
    priceMax = document.getElementById('priceMax').value;
    renderProducts();
  }

  function doSort(value) {
    sortBy = value;
    renderProducts();
  }

  function toggleSearch() {
    if (searchVisible) {
      searchVisible = false;
      searchKeyword = '';
      priceMin = '';
      priceMax = '';
      sortBy = 'default';
      document.getElementById('searchBar').classList.remove('show');
      document.getElementById('searchInput').value = '';
      document.getElementById('priceMin').value = '';
      document.getElementById('priceMax').value = '';
      document.getElementById('sortSelect').value = 'default';
      document.getElementById('searchClear').classList.remove('show');
      renderProducts();
    } else {
      searchVisible = true;
      document.getElementById('searchBar').classList.add('show');
      setTimeout(function() { document.getElementById('searchInput').focus(); }, 100);
    }
  }

  function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchKeyword = '';
    document.getElementById('searchClear').classList.remove('show');
    renderProducts();
    document.getElementById('searchInput').focus();
  }

  // ===== 购物车操作 =====

  function addToCart(id) {
    var stock = stockData[id] !== undefined ? stockData[id] : 0;
    var idx = cartIndex(id);
    var current = idx >= 0 ? cartData[idx].quantity : 0;
    if (current >= stock) {
      var p = PRODUCTS.find(function(x) { return x.id === id; });
      showToast(p.name + ' 已达库存上限 (' + stock + '册)');
      return;
    }
    var product = PRODUCTS.find(function(x) { return x.id === id; });
    if (idx >= 0) {
      cartData[idx].quantity++;
    } else {
      cartData.push({ id: id, name: product.name, author: product.author, category: product.category, price: product.price, emoji: product.emoji, quantity: 1 });
    }
    saveCart();
    updateCartBadge();
    updateCartSidebar();
    renderProducts();
    showToast('已加入购物车 ✓');
  }

  function updateQuantity(id, delta) {
    var stock = stockData[id] !== undefined ? stockData[id] : 0;
    var idx = cartIndex(id);
    if (idx < 0) return;
    var next = cartData[idx].quantity + delta;
    if (next <= 0) { removeFromCart(id); return; }
    if (next > stock) {
      var p = PRODUCTS.find(function(x) { return x.id === id; });
      showToast(p.name + ' 数量不能超过库存 (' + stock + '册)');
      return;
    }
    cartData[idx].quantity = next;
    saveCart();
    updateCartSidebar();
    updateCartBadge();
    renderProducts();
  }

  function removeFromCart(id) {
    cartData = cartData.filter(function(item) { return item.id !== id; });
    saveCart();
    updateCartBadge();
    updateCartSidebar();
    renderProducts();
  }

  function clearCart() {
    if (cartData.length === 0) return;
    if (!confirm('确定要清空购物车吗？此操作不可撤销。')) return;
    cartData = [];
    saveCart();
    updateCartBadge();
    updateCartSidebar();
    renderProducts();
    showToast('购物车已清空');
  }

  // ===== UI 更新 =====
  function updateCartBadge() {
    var badge = document.getElementById('cartBadge');
    var count = getCartCount();
    badge.textContent = count;
    badge.className = 'cart-badge' + (count === 0 ? ' zero' : '');
  }

  function updateCartSidebar() {
    var container = document.getElementById('cartItems');
    var totalEl = document.getElementById('totalPrice');
    var checkoutBtn = document.getElementById('checkoutBtn');
    if (cartData.length === 0) {
      container.innerHTML = '<div class="cart-empty">购物车是空的，快去挑选书籍吧~</div>';
      totalEl.textContent = '¥0.00';
      checkoutBtn.disabled = true;
      return;
    }
    checkoutBtn.disabled = false;
    container.innerHTML = '';
    cartData.forEach(function(item) {
      var stock = stockData[item.id] !== undefined ? stockData[item.id] : 0;
      var el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML =
        '<span class="cart-item-emoji">' + item.emoji + '</span>' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + item.name + '</div>' +
          '<div class="cart-item-author">' + item.author + '</div>' +
          '<div class="cart-item-price">¥' + (item.price * item.quantity).toFixed(2) + '</div>' +
        '</div>' +
        '<div class="cart-item-controls">' +
          '<button class="qty-btn" onclick="window._book.updateQuantity(' + item.id + ',-1)"' + (item.quantity <= 1 ? ' disabled' : '') + '>−</button>' +
          '<span class="qty-num">' + item.quantity + '</span>' +
          '<button class="qty-btn" onclick="window._book.updateQuantity(' + item.id + ',1)"' + (item.quantity >= stock ? ' disabled' : '') + '>+</button>' +
        '</div>' +
        '<button class="btn-delete" onclick="window._book.removeFromCart(' + item.id + ')">🗑</button>';
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
    for (var i = 0; i < cartData.length; i++) {
      var item = cartData[i];
      var stock = stockData[item.id] !== undefined ? stockData[item.id] : 0;
      if (item.quantity > stock) { showToast('部分商品库存不足，请调整购物车'); return; }
    }
    toggleCart();
    document.getElementById('summaryCount').textContent = getCartCount();
    document.getElementById('summaryTotal').textContent = '¥' + getCartTotal().toFixed(2);
    document.getElementById('checkoutForm').reset();
    clearErrors();
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
    for (var i = 0; i < cartData.length; i++) {
      var item = cartData[i];
      var stock = stockData[item.id] !== undefined ? stockData[item.id] : 0;
      if (item.quantity > stock) { showToast('库存不足，订单无法提交'); return; }
    }

    lastOrderSnapshot = cartData.map(function(item) {
      return { name: item.name, author: item.author, emoji: item.emoji, qty: item.quantity, subtotal: item.price * item.quantity };
    });

    for (var j = 0; j < cartData.length; j++) {
      var ci = cartData[j];
      stockData[ci.id] = (stockData[ci.id] !== undefined ? stockData[ci.id] : 0) - ci.quantity;
    }
    saveStock();

    var orderNo = 'BK' + Date.now();
    cartData = [];
    saveCart();

    closeCheckout();
    updateCartBadge();
    updateCartSidebar();
    renderProducts();

    document.getElementById('orderNo').textContent = '订单编号：' + orderNo;
    var itemsHtml = '';
    for (var k = 0; k < lastOrderSnapshot.length; k++) {
      var snap = lastOrderSnapshot[k];
      itemsHtml += snap.emoji + ' ' + snap.name + ' × ' + snap.qty + ' = ¥' + snap.subtotal.toFixed(2) + '<br>';
    }
    document.getElementById('orderItems').innerHTML = itemsHtml;
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
    var valid = true;
    clearErrors();
    var name = document.getElementById('userName').value.trim();
    var phone = document.getElementById('userPhone').value.trim();
    var address = document.getElementById('userAddress').value.trim();
    if (!name) { showFieldError('userName', 'errorName', '请输入收货人姓名'); valid = false; }
    if (!phone) { showFieldError('userPhone', 'errorPhone', '请输入手机号'); valid = false; }
    else if (!/^1[3-9]\d{9}$/.test(phone)) { showFieldError('userPhone', 'errorPhone', '手机号格式不正确'); valid = false; }
    if (!address) { showFieldError('userAddress', 'errorAddress', '请输入收货地址'); valid = false; }
    else if (address.length < 5) { showFieldError('userAddress', 'errorAddress', '地址太短，请填写完整'); valid = false; }
    return valid;
  }

  function showFieldError(inputId, errorId, msg) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = msg;
  }

  function clearErrors() {
    var ids = ['userName', 'userPhone', 'userAddress'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).classList.remove('error');
    }
    var errIds = ['errorName', 'errorPhone', 'errorAddress'];
    for (var j = 0; j < errIds.length; j++) {
      document.getElementById(errIds[j]).textContent = '';
    }
  }

  // ===== Toast =====
  function showToast(msg) {
    var old = document.getElementById('toast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(92,64,51,0.92);color:#FDF6E3;padding:10px 24px;border-radius:20px;font-size:0.88rem;z-index:9999;white-space:nowrap;';
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, 1800);
  }

  // ===== 暴露关键函数到 window =====
  window._book = {
    addToCart: addToCart,
    updateQuantity: updateQuantity,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    toggleCart: toggleCart,
    openCheckout: openCheckout,
    closeCheckout: closeCheckout,
    submitOrder: submitOrder,
    closeSuccess: closeSuccess,
    filterByCategory: filterByCategory,
    toggleSearch: toggleSearch,
    clearSearch: clearSearch,
    doSort: doSort,
    doPriceFilter: doPriceFilter
  };

  init();

})();
