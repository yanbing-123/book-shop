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

  var LS_STOCK    = 'book_stock';
  var LS_CART     = 'book_cart';
  var LS_USERS    = 'book_users';
  var LS_SESSION  = 'book_session';
  var LS_PREFIX_FAV     = 'book_fav_';
  var LS_PREFIX_ORDERS  = 'book_orders_';
  var LS_PREFIX_PROFILE = 'book_profile_';
  var LS_ORDER_QUEUE    = 'book_order_queue';
  var LS_SPECIALS       = 'book_specials';
  var LS_STAFF_SESSION  = 'book_staff_session';

  var stockData = {};
  var cartData  = [];
  var currentCategory = 'all';
  var searchKeyword = '';
  var priceMin = '';
  var priceMax = '';
  var sortBy = 'default';
  var searchVisible = false;
  var lastOrderSnapshot = [];

  var currentUser = null;
  var isStaff = false;
  var favData = {};
  var ordersData = [];
  var orderQueue = [];
  var specialsData = [];
  var bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('book_shop') : null;

  function broadcast(msg) {
    if (bc) bc.postMessage(msg);
  }

  // ===== 初始化 =====
  function init() {
    loadStock();
    loadCart();
    authInit();
    loadFavorites();
    loadOrders();
    loadOrderQueue();
    loadSpecials();
    loadStaffSession();
    renderProducts();
    renderSpecialsBanner();
    updateCartBadge();
    updateCartSidebar();
    updateAuthUI();
    updateWishlistBadge();
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
    // BroadcastChannel
    if (bc) {
      bc.onmessage = function(e) {
        var data = e.data;
        if (!data) return;
        if (data.type === 'new_order' && isStaff) {
          renderStaffDashboard();
          showToast('📢 新订单来了！');
        }
        if (data.type === 'order_status' && isStaff) {
          loadOrderQueue();
          renderStaffDashboard();
        }
        if (data.type === 'stock_update') {
          loadStock();
          renderProducts();
        }
        if (data.type === 'specials_update') {
          loadSpecials();
          renderSpecialsBanner();
        }
      };
    }
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
      if (currentCategory === 'fav') {
        if (!isFavorite(p.id)) return false;
      } else if (currentCategory !== 'all' && p.category !== currentCategory) {
        return false;
      }
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
      var faved = isFavorite(p.id);
      var specialPrice = getSpecialPrice(p.id, p.price);
      var hasSpecial = specialPrice !== p.price;

      var stockClass = '';
      var stockText = '库存：' + stock + '册';
      if (outOfStock) { stockClass = 'empty'; stockText = '缺货'; }
      else if (isLow)  { stockClass = 'low';   stockText += ' (紧张)'; }

      var card = document.createElement('div');
      card.className = 'product-card' + (outOfStock ? ' out-of-stock' : '') + (hasSpecial ? ' has-special' : '');
      card.onclick = function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('.fav-btn,.btn-add')) return;
        openDetail(p.id);
      };
      var specialTag = hasSpecial ? '<div class="card-special-tag">🔥 特价</div>' : '';
      card.innerHTML =
        '<div class="card-cover">' + p.emoji +
          '<button class="fav-btn' + (faved ? ' faved' : '') + '" onclick="event.stopPropagation();window._book.toggleFavorite(' + p.id + ')" title="' + (faved ? '取消收藏' : '收藏') + '">' +
            (faved ? '❤️' : '🤍') +
          '</button>' +
          specialTag +
        '</div>' +
        '<div class="card-body">' +
          '<span class="card-cat ' + p.category + '">' + p.category + '</span>' +
          '<div class="card-name">' + p.name + '</div>' +
          '<div class="card-author">' + p.author + '</div>' +
          '<div class="card-price">' + (hasSpecial ? '<span class="price-original">¥' + p.price.toFixed(2) + '</span> ' : '') + '¥' + specialPrice.toFixed(2) + '</div>' +
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
    if (cat === 'fav') {
      filterFavorites();
      return;
    }
    currentCategory = cat;
    updateTypeButtons();
    renderProducts();
  }
  function updateTypeButtons() {
    document.querySelectorAll('.type-btn').forEach(function(btn) {
      var isActive = (currentCategory === 'all' && btn.dataset.cat === 'all') || btn.dataset.cat === currentCategory;
      btn.classList.toggle('active', isActive);
    });
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
    renderWishlist();
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

  // ===== 商品定制（礼品包装、备注）=====
  var GIFT_WRAP_FEE = 5.00;

  function toggleGiftWrap() {
    var checked = document.getElementById('giftWrapCheck').checked;
    var giftEl = document.getElementById('summaryGift');
    var totalEl = document.getElementById('summaryGrandTotal');
    giftEl.style.display = checked ? 'block' : 'none';
    var subtotal = getCartTotal();
    totalEl.textContent = '¥' + (subtotal + (checked ? GIFT_WRAP_FEE : 0)).toFixed(2);
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
    var subtotal = getCartTotal();
    document.getElementById('summaryCount').textContent = getCartCount();
    document.getElementById('summaryTotal').textContent = '¥' + subtotal.toFixed(2);
    document.getElementById('summaryGift').style.display = 'none';
    document.getElementById('summaryGrandTotal').textContent = '¥' + subtotal.toFixed(2);
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

    var orderTotal = 0;
    for (var j = 0; j < cartData.length; j++) {
      var ci = cartData[j];
      stockData[ci.id] = (stockData[ci.id] !== undefined ? stockData[ci.id] : 0) - ci.quantity;
      orderTotal += ci.price * ci.quantity;
    }

    var hasGiftWrap = document.getElementById('giftWrapCheck').checked;
    var orderNote = document.getElementById('orderNote').value.trim();
    if (hasGiftWrap) orderTotal += GIFT_WRAP_FEE;

    saveStock();

    var orderNo = 'BK' + Date.now();
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate()) + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());

    var orderRecord = {
      orderNo: orderNo,
      date: dateStr,
      items: lastOrderSnapshot.slice(),
      total: orderTotal,
      customerName: document.getElementById('userName').value.trim() || (currentUser ? currentUser.username : '未知'),
      status: 'pending',
      giftWrap: hasGiftWrap,
      note: orderNote
    };

    if (isLoggedIn()) {
      addOrder(orderRecord);
    }
    pushToOrderQueue(orderRecord);

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
    if (hasGiftWrap) {
      itemsHtml += '🎁 礼品包装 +¥' + GIFT_WRAP_FEE.toFixed(2) + '<br>';
    }
    if (orderNote) {
      itemsHtml += '📝 备注：' + escapeHtml(orderNote) + '<br>';
    }
    document.getElementById('orderItems').innerHTML = itemsHtml;
    document.getElementById('successOverlay').classList.add('show');
    document.getElementById('successModal').classList.add('show');
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

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

  // ===== 用户认证 =====
  function authInit() {
    loadSession();
    updateAuthUI();
    loadUserData();
  }

  function loadStaffSession() {
    if (localStorage.getItem(LS_STAFF_SESSION)) {
      isStaff = true;
      loadOrderQueue();
    }
  }

  function loadUserData() {
    if (currentUser) {
      loadFavorites();
      loadOrders();
    }
  }

  function loadSession() {
    var saved = localStorage.getItem(LS_SESSION);
    if (!saved) return;
    try {
      var data = JSON.parse(saved);
      if (!data || !data.username) return;
      var users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
      for (var i = 0; i < users.length; i++) {
        if (users[i].username === data.username) {
          currentUser = users[i];
          return;
        }
      }
    } catch(e) {}
  }

  function register(username, password) {
    if (!username || username.length < 2) { showToast('用户名至少需要 2 个字符'); return false; }
    if (!password || password.length < 6) { showToast('密码至少需要 6 个字符'); return false; }
    var users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username) { showToast('用户名已存在'); return false; }
    }
    users.push({ username: username, password: btoa(password), createdAt: Date.now() });
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    return true;
  }

  function login(username, password) {
    if (!username || !password) { showToast('请输入用户名和密码'); return false; }
    var users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
    var encoded = btoa(password);
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username && users[i].password === encoded) {
        currentUser = users[i];
        localStorage.setItem(LS_SESSION, JSON.stringify({ username: username }));
        loadFavorites();
        loadOrders();
        updateAuthUI();
        showToast('登录成功，欢迎 ' + username + '！');
        return true;
      }
    }
    showToast('用户名或密码错误');
    return false;
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem(LS_SESSION);
    favData = {};
    ordersData = [];
    updateAuthUI();
    renderProducts();
    updateWishlistBadge();
    showToast('已退出登录');
  }

  function isLoggedIn() {
    return currentUser !== null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function updateAuthUI() {
    var container = document.getElementById('authContainer');
    if (!container) return;
    var html = '';
    if (currentUser) {
      html =
        '<span class="user-greeting" onclick="window._book.openProfile()" style="cursor:pointer" title="编辑资料">你好，' + escapeHtml(currentUser.username) + '</span>' +
        '<button class="auth-btn" onclick="window._book.openOrderHistory()">📋 订单</button>' +
        '<button class="auth-btn" onclick="window._book.logout()">退出</button>';
    } else {
      html =
        '<button class="auth-btn" onclick="window._book.openLogin()">登录</button>' +
        '<button class="auth-btn auth-btn-register" onclick="window._book.openRegister()">注册</button>';
    }
    if (isStaff) {
      html +=
        '<button class="auth-btn auth-btn-staff" onclick="window._book.openStaffDashboard()">📊 管理台 <span class="staff-badge" id="staffOrderCount">0</span></button>' +
        '<button class="auth-btn auth-btn-staff" onclick="window._book.openStockManager()">📦 库存</button>' +
        '<button class="auth-btn auth-btn-staff" onclick="window._book.openSpecialsManager()">🏷️ 特价</button>' +
        '<button class="auth-btn" onclick="window._book.staffLogout()">退出管理</button>';
    } else {
      html += '<button class="auth-btn auth-btn-staff-login" onclick="window._book.openStaffLogin()">🔧 员工</button>';
    }
    container.innerHTML = html;
  }

  // ===== Auth Modals =====
  function openLogin() {
    document.getElementById('loginOverlay').classList.add('show');
    document.getElementById('loginModal').classList.add('show');
    setTimeout(function() { var inp = document.getElementById('loginUsername'); if (inp) inp.focus(); }, 100);
  }
  function closeLogin() {
    document.getElementById('loginOverlay').classList.remove('show');
    document.getElementById('loginModal').classList.remove('show');
    var form = document.getElementById('loginForm');
    if (form) form.reset();
  }
  function submitLogin(e) {
    e.preventDefault();
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!username) { showToast('请输入用户名'); return; }
    if (!password) { showToast('请输入密码'); return; }
    if (login(username, password)) closeLogin();
  }
  function openRegister() {
    document.getElementById('registerOverlay').classList.add('show');
    document.getElementById('registerModal').classList.add('show');
    setTimeout(function() { var inp = document.getElementById('regUsername'); if (inp) inp.focus(); }, 100);
  }
  function closeRegister() {
    document.getElementById('registerOverlay').classList.remove('show');
    document.getElementById('registerModal').classList.remove('show');
    var form = document.getElementById('registerForm');
    if (form) form.reset();
  }
  function submitRegister(e) {
    e.preventDefault();
    var username = document.getElementById('regUsername').value.trim();
    var password = document.getElementById('regPassword').value;
    var confirmPwd = document.getElementById('regConfirmPassword').value;
    if (!username || username.length < 2) { showToast('用户名至少需要 2 个字符'); return; }
    if (!password || password.length < 6) { showToast('密码至少需要 6 个字符'); return; }
    if (password !== confirmPwd) { showToast('两次密码输入不一致'); return; }
    if (register(username, password)) { closeRegister(); showToast('注册成功，请登录'); }
  }

  // ===== 用户资料 =====
  function profileKey() {
    return LS_PREFIX_PROFILE + (currentUser ? currentUser.username : 'guest');
  }
  function loadProfile() {
    var saved = localStorage.getItem(profileKey());
    return saved ? JSON.parse(saved) : null;
  }
  function saveProfileData(data) {
    localStorage.setItem(profileKey(), JSON.stringify(data));
  }
  function openProfile() {
    if (!isLoggedIn()) { showToast('请先登录'); openLogin(); return; }
    var profile = loadProfile() || {};
    document.getElementById('profileName').value = profile.name || currentUser.username || '';
    document.getElementById('profilePhone').value = profile.phone || '';
    document.getElementById('profileAddress').value = profile.address || '';
    document.getElementById('profileOverlay').classList.add('show');
    document.getElementById('profileModal').classList.add('show');
  }
  function closeProfile() {
    document.getElementById('profileOverlay').classList.remove('show');
    document.getElementById('profileModal').classList.remove('show');
  }
  function submitProfile(e) {
    e.preventDefault();
    var name = document.getElementById('profileName').value.trim();
    var phone = document.getElementById('profilePhone').value.trim();
    var address = document.getElementById('profileAddress').value.trim();
    if (!name) { showToast('请输入姓名'); return; }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) { showToast('手机号格式不正确'); return; }
    saveProfileData({ name: name, phone: phone, address: address });
    closeProfile();
    showToast('资料已保存 ✓');
  }

  // ===== 收藏系统 =====
  function favKey() {
    return LS_PREFIX_FAV + (currentUser ? currentUser.username : 'guest');
  }
  function loadFavorites() {
    var saved = localStorage.getItem(favKey());
    favData = saved ? JSON.parse(saved) : {};
  }
  function saveFavorites() {
    localStorage.setItem(favKey(), JSON.stringify(favData));
    updateWishlistBadge();
  }
  function isFavorite(id) {
    return favData[id] === true;
  }
  function toggleFavorite(id) {
    if (!isLoggedIn()) { showToast('请先登录后使用收藏功能'); openLogin(); return; }
    var p = getProductById(id);
    if (!p) return;
    if (favData[id]) {
      delete favData[id];
      showToast('已取消收藏 ' + p.name);
    } else {
      favData[id] = true;
      showToast('已收藏 ' + p.name + ' ❤️');
    }
    saveFavorites();
    renderProducts();
    renderWishlist();
  }
  function filterFavorites() {
    if (!isLoggedIn()) { showToast('请先登录后使用收藏功能'); openLogin(); return; }
    currentCategory = 'fav';
    document.querySelectorAll('.type-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.cat === 'fav');
    });
    renderProducts();
  }
  function getProductById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) return PRODUCTS[i]; }
    return null;
  }

  // ===== 订单历史 =====
  function ordersKey() {
    return LS_PREFIX_ORDERS + (currentUser ? currentUser.username : 'guest');
  }
  function loadOrders() {
    var saved = localStorage.getItem(ordersKey());
    ordersData = saved ? JSON.parse(saved) : [];
  }
  function saveOrders() {
    localStorage.setItem(ordersKey(), JSON.stringify(ordersData));
  }
  function addOrder(order) {
    ordersData.unshift(order);
    saveOrders();
  }
  function openOrderHistory() {
    if (!isLoggedIn()) { showToast('请先登录后查看订单'); openLogin(); return; }
    renderOrderHistory();
    document.getElementById('orderHistoryOverlay').classList.add('show');
    document.getElementById('orderHistoryModal').classList.add('show');
  }
  function closeOrderHistory() {
    document.getElementById('orderHistoryOverlay').classList.remove('show');
    document.getElementById('orderHistoryModal').classList.remove('show');
  }
  function renderOrderHistory() {
    var container = document.getElementById('orderHistoryList');
    if (!container) return;
    container.innerHTML = '';
    if (ordersData.length === 0) {
      container.innerHTML = '<div class="drawer-empty">暂无订单记录 📭</div>';
      return;
    }
    for (var i = 0; i < ordersData.length; i++) {
      var order = ordersData[i];
      var div = document.createElement('div');
      div.className = 'order-history-card';
      var itemsHtml = '';
      for (var j = 0; j < order.items.length; j++) {
        var item = order.items[j];
        itemsHtml += '<span class="oh-item">' + item.emoji + ' ' + item.name + ' × ' + item.qty + '</span>';
      }
      div.innerHTML =
        '<div class="oh-header">' +
          '<span class="oh-no">📦 ' + order.orderNo + '</span>' +
          '<span class="oh-date">' + order.date + '</span>' +
        '</div>' +
        '<div class="oh-items">' + itemsHtml + '</div>' +
        '<div class="oh-footer">' +
          '<span class="oh-total">合计：<strong>¥' + order.total.toFixed(2) + '</strong></span>' +
          '<button class="oh-reorder" onclick="window._book.reorder(' + i + ')">再来一单</button>' +
        '</div>';
      container.appendChild(div);
    }
  }
  function reorder(idx) {
    var order = ordersData[idx];
    if (!order) return;
    for (var i = 0; i < order.items.length; i++) {
      var oi = order.items[i];
      var p = getBookByName(oi.name);
      if (!p) continue;
      var stock = stockData[p.id] !== undefined ? stockData[p.id] : p.stock;
      var ci = cartIndex(p.id);
      var currentQty = ci >= 0 ? cartData[ci].quantity : 0;
      if (currentQty < stock) {
        var addQty = Math.min(oi.qty, stock - currentQty);
        if (ci >= 0) {
          cartData[ci].quantity += addQty;
        } else {
          cartData.push({ id: p.id, name: p.name, author: p.author, emoji: p.emoji, price: p.price, quantity: addQty });
        }
      }
    }
    saveCart();
    updateCartBadge();
    updateCartSidebar();
    renderProducts();
    showToast('已添加到购物车');
  }
  function getBookByName(name) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].name === name) return PRODUCTS[i]; }
    return null;
  }

  // ===== 全局订单队列 (Staff) =====
  function loadOrderQueue() {
    var saved = localStorage.getItem(LS_ORDER_QUEUE);
    orderQueue = saved ? JSON.parse(saved) : [];
  }
  function saveOrderQueue() {
    localStorage.setItem(LS_ORDER_QUEUE, JSON.stringify(orderQueue));
  }
  function pushToOrderQueue(order) {
    orderQueue.unshift(order);
    saveOrderQueue();
    broadcast({ type: 'new_order', order: order });
  }

  // ===== 员工认证 =====
  function staffLogin(password) {
    if (password === 'admin888') {
      isStaff = true;
      localStorage.setItem(LS_STAFF_SESSION, '1');
      loadOrderQueue();
      updateAuthUI();
      showToast('✅ 员工模式已开启');
      return true;
    }
    showToast('❌ 员工密码错误');
    return false;
  }
  function staffLogout() {
    isStaff = false;
    localStorage.removeItem(LS_STAFF_SESSION);
    updateAuthUI();
    closeStaffDashboard();
    closeStockManager();
    closeSpecialsManager();
    showToast('已退出员工模式');
  }
  function openStaffLogin() {
    document.getElementById('staffLoginOverlay').classList.add('show');
    document.getElementById('staffLoginModal').classList.add('show');
    setTimeout(function() { var inp = document.getElementById('staffLoginPwd'); if (inp) inp.focus(); }, 100);
  }
  function closeStaffLogin() {
    document.getElementById('staffLoginOverlay').classList.remove('show');
    document.getElementById('staffLoginModal').classList.remove('show');
    var inp = document.getElementById('staffLoginPwd');
    if (inp) inp.value = '';
  }
  function submitStaffLogin(e) {
    e.preventDefault();
    var pwd = document.getElementById('staffLoginPwd').value;
    if (staffLogin(pwd)) closeStaffLogin();
  }

  // ===== Staff Dashboard =====
  function openStaffDashboard() {
    loadOrderQueue();
    renderStaffDashboard();
    document.getElementById('staffDashboardOverlay').classList.add('show');
    document.getElementById('staffDashboardModal').classList.add('show');
  }
  function closeStaffDashboard() {
    document.getElementById('staffDashboardOverlay').classList.remove('show');
    document.getElementById('staffDashboardModal').classList.remove('show');
  }
  function renderStaffDashboard() {
    var container = document.getElementById('staffOrderList');
    if (!container) return;
    container.innerHTML = '';
    if (orderQueue.length === 0) {
      container.innerHTML = '<div class="drawer-empty">暂无订单 📭</div>';
      return;
    }
    for (var i = 0; i < orderQueue.length; i++) {
      var o = orderQueue[i];
      var card = document.createElement('div');
      card.className = 'staff-order-card status-' + o.status;
      var itemsHtml = '';
      for (var j = 0; j < o.items.length; j++) {
        var item = o.items[j];
        itemsHtml += '<span class="so-item-tag">' + item.emoji + ' ' + item.name + ' × ' + item.qty + '</span>';
      }
      var statusLabels = { pending: '⏳ 待处理', preparing: '👨‍🍳 处理中', ready: '✅ 已完成', completed: '📦 已取走' };
      var canPrepare = o.status === 'pending';
      var canReady = o.status === 'preparing';
      var canComplete = o.status === 'ready';
      card.innerHTML =
        '<div class="so-header">' +
          '<span class="so-no">📦 ' + o.orderNo + '</span>' +
          '<span class="so-customer">👤 ' + escapeHtml(o.customerName || '未知') + '</span>' +
          '<span class="so-status-badge ' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span>' +
        '</div>' +
        '<div class="so-body">' +
          '<div class="so-items">' + itemsHtml + '</div>' +
          '<div class="so-total">合计：<strong>¥' + o.total.toFixed(2) + '</strong></div>' +
        '</div>' +
        '<div class="so-actions">' +
          (canPrepare ? '<button class="so-btn prepare" onclick="window._book.updateOrderStatus(' + i + ',\'preparing\')">👨‍🍳 开始处理</button>' : '') +
          (canReady ? '<button class="so-btn ready" onclick="window._book.updateOrderStatus(' + i + ',\'ready\')">✅ 完成</button>' : '') +
          (canComplete ? '<button class="so-btn complete" onclick="window._book.updateOrderStatus(' + i + ',\'completed\')">📦 取走</button>' : '') +
          (o.status === 'completed' ? '<button class="so-btn remove" onclick="window._book.removeCompletedOrder(' + i + ')">🗑 移除</button>' : '') +
        '</div>';
      container.appendChild(card);
    }
    var countEl = document.getElementById('staffOrderCount');
    if (countEl) {
      var pending = 0;
      for (var k = 0; k < orderQueue.length; k++) {
        if (orderQueue[k].status === 'pending' || orderQueue[k].status === 'preparing') pending++;
      }
      countEl.textContent = pending;
    }
  }
  function updateOrderStatus(idx, newStatus) {
    if (idx < 0 || idx >= orderQueue.length) return;
    orderQueue[idx].status = newStatus;
    saveOrderQueue();
    renderStaffDashboard();
    broadcast({ type: 'order_status', idx: idx, status: newStatus });
    var labels = { pending: '⏳ 待处理', preparing: '👨‍🍳 处理中', ready: '✅ 已完成', completed: '📦 已取走' };
    showToast('订单状态已更新：' + (labels[newStatus] || newStatus));
  }
  function removeCompletedOrder(idx) {
    if (idx < 0 || idx >= orderQueue.length) return;
    orderQueue.splice(idx, 1);
    saveOrderQueue();
    renderStaffDashboard();
  }

  // ===== Stock Management =====
  function openStockManager() {
    renderStockManager();
    document.getElementById('stockOverlay').classList.add('show');
    document.getElementById('stockModal').classList.add('show');
  }
  function closeStockManager() {
    document.getElementById('stockOverlay').classList.remove('show');
    document.getElementById('stockModal').classList.remove('show');
  }
  function renderStockManager() {
    var container = document.getElementById('stockList');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < PRODUCTS.length; i++) {
      var p = PRODUCTS[i];
      var s = stockData[p.id] !== undefined ? stockData[p.id] : p.stock;
      var div = document.createElement('div');
      div.className = 'stock-item';
      div.innerHTML =
        '<span class="stock-emoji">' + p.emoji + '</span>' +
        '<div class="stock-info">' +
          '<div class="stock-name">' + p.name + '</div>' +
          '<div class="stock-level">库存：<strong>' + s + '</strong></div>' +
        '</div>' +
        '<div class="stock-controls">' +
          '<button class="stock-btn" onclick="window._book.restockProduct(' + p.id + ',10)">+10</button>' +
          '<button class="stock-btn" onclick="window._book.restockProduct(' + p.id + ',50)">+50</button>' +
          '<button class="stock-btn set" onclick="window._book.setStockPrompt(' + p.id + ')">设定</button>' +
        '</div>';
      container.appendChild(div);
    }
  }
  function restockProduct(id, amount) {
    stockData[id] = (stockData[id] !== undefined ? stockData[id] : 0) + amount;
    saveStock();
    renderStockManager();
    renderProducts();
    broadcast({ type: 'stock_update' });
    var p = getProductById(id);
    showToast((p ? p.name : '商品') + ' 已补货 +' + amount);
  }
  function setStockPrompt(id) {
    var current = stockData[id] !== undefined ? stockData[id] : 0;
    var p = getProductById(id);
    var input = prompt('请输入 "' + (p ? p.name : '商品') + '" 的新库存数量：', current);
    if (input === null) return;
    var val = parseInt(input, 10);
    if (isNaN(val) || val < 0) { showToast('请输入有效的正整数'); return; }
    stockData[id] = val;
    saveStock();
    renderStockManager();
    renderProducts();
    broadcast({ type: 'stock_update' });
    showToast((p ? p.name : '商品') + ' 库存已设置为 ' + val);
  }

  // ===== Daily Specials =====
  function loadSpecials() {
    var saved = localStorage.getItem(LS_SPECIALS);
    specialsData = saved ? JSON.parse(saved) : [];
  }
  function saveSpecials() {
    localStorage.setItem(LS_SPECIALS, JSON.stringify(specialsData));
  }
  function renderSpecialsBanner() {
    var banner = document.getElementById('specialsBanner');
    if (!banner) return;
    var active = [];
    for (var i = 0; i < specialsData.length; i++) {
      if (specialsData[i].active) active.push(specialsData[i]);
    }
    if (active.length === 0) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.innerHTML = '';
    for (var j = 0; j < active.length; j++) {
      var s = active[j];
      var p = getProductById(s.productId);
      var tag = document.createElement('div');
      tag.className = 'specials-tag';
      tag.innerHTML =
        '<span class="specials-emoji">🏷️</span>' +
        '<span class="specials-text">今日特惠：<strong>' + (p ? p.name : '商品') + '</strong> ' +
        (s.type === 'discount' ? '打 <em>' + s.value + '</em> 折！' : '直降 <em>¥' + s.value + '</em>！') +
        '</span>' +
        (isStaff ? '<button class="specials-remove" onclick="window._book.removeSpecial(' + j + ')">✕</button>' : '');
      banner.appendChild(tag);
    }
  }
  function openSpecialsManager() {
    loadSpecials();
    renderSpecialsManager();
    document.getElementById('specialsOverlay').classList.add('show');
    document.getElementById('specialsModal').classList.add('show');
  }
  function closeSpecialsManager() {
    document.getElementById('specialsOverlay').classList.remove('show');
    document.getElementById('specialsModal').classList.remove('show');
  }
  function renderSpecialsManager() {
    var container = document.getElementById('specialsManagerList');
    if (!container) return;
    container.innerHTML = '';
    if (specialsData.length === 0) {
      container.innerHTML = '<div class="drawer-empty">暂无特价活动，点击下方添加 🎯</div>';
    } else {
      for (var i = 0; i < specialsData.length; i++) {
        var s = specialsData[i];
        var p = getProductById(s.productId);
        var div = document.createElement('div');
        div.className = 'specials-manager-item';
        div.innerHTML =
          '<div class="sm-info">' +
            '<strong>' + (p ? p.emoji + ' ' + p.name : '商品已删除') + '</strong>' +
            '<span class="sm-detail">' + (s.type === 'discount' ? s.value + '折' : '减¥' + s.value) + '</span>' +
          '</div>' +
          '<div class="sm-actions">' +
            '<button class="sm-toggle" onclick="window._book.toggleSpecial(' + i + ')">' + (s.active ? '🔴 停用' : '🟢 启用') + '</button>' +
            '<button class="sm-remove" onclick="window._book.removeSpecialManager(' + i + ')">🗑</button>' +
          '</div>';
        container.appendChild(div);
      }
    }
    var sel = document.getElementById('specialsProduct');
    if (sel) {
      sel.innerHTML = '<option value="">-- 选择商品 --</option>';
      for (var j = 0; j < PRODUCTS.length; j++) {
        var opt = document.createElement('option');
        opt.value = PRODUCTS[j].id;
        opt.textContent = PRODUCTS[j].name;
        sel.appendChild(opt);
      }
    }
  }
  function addSpecial() {
    var pid = parseInt(document.getElementById('specialsProduct').value, 10);
    var type = document.getElementById('specialsType').value;
    var val = parseFloat(document.getElementById('specialsValue').value);
    if (!pid || isNaN(pid)) { showToast('请选择商品'); return; }
    if (!type) { showToast('请选择优惠类型'); return; }
    if (isNaN(val) || val <= 0) { showToast('请输入有效的优惠值'); return; }
    if (type === 'discount' && (val < 1 || val > 9.9)) { showToast('折扣范围为 1-9.9 折'); return; }
    specialsData.push({ productId: pid, type: type, value: val, active: true, createdAt: Date.now() });
    saveSpecials();
    renderSpecialsManager();
    renderSpecialsBanner();
    broadcast({ type: 'specials_update' });
    showToast('特价活动已添加 🎉');
    document.getElementById('specialsProduct').value = '';
    document.getElementById('specialsType').value = '';
    document.getElementById('specialsValue').value = '';
  }
  function toggleSpecial(idx) {
    if (idx < 0 || idx >= specialsData.length) return;
    specialsData[idx].active = !specialsData[idx].active;
    saveSpecials();
    renderSpecialsManager();
    renderSpecialsBanner();
    broadcast({ type: 'specials_update' });
  }
  function removeSpecial(idx) {
    if (idx < 0 || idx >= specialsData.length) return;
    specialsData.splice(idx, 1);
    saveSpecials();
    renderSpecialsBanner();
    showToast('特价已移除');
  }
  function removeSpecialManager(idx) {
    if (idx < 0 || idx >= specialsData.length) return;
    specialsData.splice(idx, 1);
    saveSpecials();
    renderSpecialsManager();
    renderSpecialsBanner();
    broadcast({ type: 'specials_update' });
    showToast('特价已删除');
  }
  function getSpecialPrice(productId, basePrice) {
    for (var i = 0; i < specialsData.length; i++) {
      if (specialsData[i].productId === productId && specialsData[i].active) {
        var s = specialsData[i];
        if (s.type === 'discount') return basePrice * s.value / 10;
        if (s.type === 'fixed') return Math.max(0, basePrice - s.value);
      }
    }
    return basePrice;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ===== Wishlist Sidebar =====
  function toggleWishlist() {
    if (!isLoggedIn()) {
      showToast('请先登录后查看收藏夹');
      openLogin();
      return;
    }
    var open = document.getElementById('wishlistSidebar').classList.toggle('open');
    document.getElementById('wishlistOverlay').classList.toggle('show', open);
    if (open) renderWishlist();
  }
  function renderWishlist() {
    var container = document.getElementById('wishlistItems');
    if (!container) return;
    var faves = [];
    for (var k in favData) {
      if (favData.hasOwnProperty(k) && favData[k]) faves.push(parseInt(k, 10));
    }
    if (faves.length === 0) {
      container.innerHTML = '<div class="cart-empty">收藏夹是空的，快去收藏喜欢的书籍吧~ ❤️</div>';
      return;
    }
    container.innerHTML = '';
    for (var i = 0; i < faves.length; i++) {
      var p = getProductById(faves[i]);
      if (!p) continue;
      var stock = stockData[p.id] !== undefined ? stockData[p.id] : p.stock;
      var outOfStock = stock <= 0;
      var inCart = cartData.some(function(item) { return item.id === p.id; });
      var el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML =
        '<span class="cart-item-emoji">' + p.emoji + '</span>' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + p.name + '</div>' +
          '<div class="cart-item-author">' + p.author + '</div>' +
          '<div class="cart-item-price">¥' + p.price.toFixed(2) + '</div>' +
          (outOfStock ? '<div class="card-stock empty" style="margin:2px 0 0;padding:0">缺货</div>' : '') +
        '</div>' +
        '<div class="wishlist-item-actions">' +
          (inCart
            ? '<span class="wishlist-in-cart">已在购物车</span>'
            : '<button class="wishlist-add-btn" onclick="window._book.addToCart(' + p.id + ')"' + (outOfStock ? ' disabled' : '') + '>加入购物车</button>'
          ) +
          '<button class="wishlist-remove-btn" onclick="window._book.toggleFavorite(' + p.id + ')">取消收藏</button>' +
        '</div>';
      container.appendChild(el);
    }
  }
  function updateWishlistBadge() {
    var badge = document.getElementById('wishlistBadge');
    if (!badge) return;
    var count = 0;
    for (var k in favData) {
      if (favData.hasOwnProperty(k) && favData[k]) count++;
    }
    badge.textContent = count;
  }

  // ===== Book Detail Modal =====
  function openDetail(id) {
    var p = getProductById(id);
    if (!p) return;
    var stock = stockData[p.id] !== undefined ? stockData[p.id] : p.stock;
    var specialPrice = getSpecialPrice(p.id, p.price);
    var hasSpecial = specialPrice !== p.price;
    var faved = isFavorite(p.id);
    var container = document.getElementById('detailContent');
    if (!container) return;
    container.innerHTML =
      '<div class="detail-header">' +
        '<span class="detail-emoji">' + p.emoji + '</span>' +
        '<h2>' + p.name + '</h2>' +
        '<div class="detail-author">' + p.author + '</div>' +
      '</div>' +
      '<div class="detail-body">' +
        '<p><strong>分类：</strong>' + p.category + '</p>' +
        '<p><strong>价格：</strong>' + (hasSpecial ? '<span class="price-original">¥' + p.price.toFixed(2) + '</span> ' : '') + '<span class="detail-price">¥' + specialPrice.toFixed(2) + '</span></p>' +
        '<p><strong>库存：</strong>' + (stock <= 0 ? '缺货' : stock + ' 册') + '</p>' +
      '</div>' +
      '<div class="detail-actions">' +
        '<button class="btn-submit" onclick="window._book.addToCart(' + p.id + ');window._book.closeDetail()" ' + (stock <= 0 ? 'disabled' : '') + '>' + (stock <= 0 ? '缺货' : '加入购物车') + '</button>' +
        '<button class="oh-reorder" onclick="window._book.toggleFavorite(' + p.id + ');window._book.closeDetail()">' + (faved ? '取消收藏' : '❤️ 收藏') + '</button>' +
      '</div>';
    document.getElementById('detailOverlay').classList.add('show');
    document.getElementById('detailModal').classList.add('show');
  }
  function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('show');
    document.getElementById('detailModal').classList.remove('show');
  }

  // ===== 暴露关键函数到 window =====
  window._book = {
    // Core
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
    doPriceFilter: doPriceFilter,
    // Auth
    openLogin: openLogin,
    closeLogin: closeLogin,
    submitLogin: submitLogin,
    openRegister: openRegister,
    closeRegister: closeRegister,
    submitRegister: submitRegister,
    logout: logout,
    isLoggedIn: isLoggedIn,
    getCurrentUser: getCurrentUser,
    // Profile
    openProfile: openProfile,
    closeProfile: closeProfile,
    submitProfile: submitProfile,
    // Favorites
    toggleFavorite: toggleFavorite,
    filterFavorites: filterFavorites,
    // Order History
    openOrderHistory: openOrderHistory,
    closeOrderHistory: closeOrderHistory,
    reorder: reorder,
    // Staff
    openStaffLogin: openStaffLogin,
    closeStaffLogin: closeStaffLogin,
    submitStaffLogin: submitStaffLogin,
    staffLogout: staffLogout,
    openStaffDashboard: openStaffDashboard,
    closeStaffDashboard: closeStaffDashboard,
    updateOrderStatus: updateOrderStatus,
    removeCompletedOrder: removeCompletedOrder,
    // Stock
    openStockManager: openStockManager,
    closeStockManager: closeStockManager,
    restockProduct: restockProduct,
    setStockPrompt: setStockPrompt,
    // Specials
    openSpecialsManager: openSpecialsManager,
    closeSpecialsManager: closeSpecialsManager,
    addSpecial: addSpecial,
    toggleSpecial: toggleSpecial,
    removeSpecialManager: removeSpecialManager,
    removeSpecial: removeSpecial,
    // Wishlist Sidebar
    toggleWishlist: toggleWishlist,
    updateWishlistBadge: updateWishlistBadge,
    // Detail Modal
    openDetail: openDetail,
    closeDetail: closeDetail,
    // Customization
    toggleGiftWrap: toggleGiftWrap
  };

  init();

})();
