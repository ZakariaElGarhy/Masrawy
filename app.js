// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://coyumqwxcwpaeeqlesdo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveXVtcXd4Y3dwYWVlcWxlc2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMTU0MDgsImV4cCI6MjEwMzg5MTQwOH0.Ks_90BSBWqGDvdVj39HFzhflixAgQ6sCnWwTwqF2MYY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CACHE HELPERS
const Cache = {
  get: (key) => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); } },
  clear: () => sessionStorage.clear()
};

let currentUser = Cache.get('m_user');
let currentUserProfile = Cache.get('m_profile');
let productsList = Cache.get('m_products') || [];
let userOrdersList = Cache.get('m_orders') || [];
let allAdminOrders = [];
let allProfiles = [];
let cart = JSON.parse(localStorage.getItem('masrawy_cart')) || [];

function saveCart() {
  localStorage.setItem('masrawy_cart', JSON.stringify(cart));
  updateCartUI();
}

// ==========================================
// AUTH MODAL & USER MANAGEMENT FUNCTIONS
// ==========================================
let isSignUp = false;

function showAuthModal() {
  if (document.getElementById('auth-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="background: #1c1917; border: 1px solid #27272a; border-radius: 12px; padding: 24px; width: 90%; max-width: 400px; color: #fff; text-align: right;">
      <h3 id="auth-title" style="margin: 0 0 16px 0; color: #f59e0b;">تسجيل الدخول</h3>
      <form onsubmit="executeAuth(event)" style="display: flex; flex-direction: column; gap: 12px;">
        <div id="signup-extra-fields" class="hidden" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="text" id="auth-name" placeholder="الاسم بالكامل" style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">
          <input type="tel" id="auth-phone" placeholder="رقم الهاتف" style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">
        </div>
        <input type="email" id="auth-email" placeholder="البريد الإلكتروني" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">
        <input type="password" id="auth-pass" placeholder="كلمة المرور" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">
        
        <button type="submit" class="btn-submit" style="margin-top: 8px;">تأكيد</button>
      </form>
      <div style="margin-top: 16px; font-size: 13px; color: #a8a29e; text-align: center;">
        <span id="auth-toggle-text">ليس لديك حساب؟</span>
        <button onclick="toggleAuthMode()" style="background: none; border: none; color: #f59e0b; font-weight: bold; cursor: pointer; text-decoration: underline; margin-right: 4px;">انشاء حساب جديد</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function removeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.remove();
}

function toggleAuthMode() {
  isSignUp = !isSignUp;
  const title = document.getElementById('auth-title');
  const extraFields = document.getElementById('signup-extra-fields');
  const toggleText = document.getElementById('auth-toggle-text');

  if (isSignUp) {
    if (title) title.innerText = 'إنشاء حساب جديد';
    if (extraFields) extraFields.classList.remove('hidden');
    if (toggleText) toggleText.innerText = 'لديك حساب بالفعل؟';
  } else {
    if (title) title.innerText = 'تسجيل الدخول';
    if (extraFields) extraFields.classList.add('hidden');
    if (toggleText) toggleText.innerText = 'ليس لديك حساب؟';
  }
}

async function executeAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pass').value;

  if (isSignUp) {
    const fullName = document.getElementById('auth-name').value;
    const phone = document.getElementById('auth-phone').value;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: phone } }
    });

    if (error) return alert('خطأ أثناء إنشاء الحساب: ' + error.message);

    if (data.user) {
      await supabaseClient.from('profiles').upsert([{
        id: data.user.id,
        email: email,
        full_name: fullName,
        phone: phone,
        role: 'client'
      }]);
    }

    alert('تم إنشاء الحساب بنجاح!');
    window.location.reload();
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert('خطأ في تسجيل الدخول: ' + error.message);
    window.location.reload();
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  Cache.clear();
  window.location.href = getHomePath();
}

function isSubfolder() { return window.location.pathname.includes('/pages/'); }
function getHomePath() { return isSubfolder() ? '../index.html' : 'index.html'; }

// INITIALIZATION PIPELINE
window.addEventListener('load', async () => {
  updateCartUI();

  if (currentUser) {
    removeAuthModal();
    populateUserPersonalization();
    triggerPageRenders();
  } else {
    showAuthModal();
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    Cache.set('m_user', currentUser);
    removeAuthModal();
    syncProfileAndData();
  } else {
    Cache.clear();
    showAuthModal();
  }
  await handleStripeReturn();
});

function triggerPageRenders() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page.includes('store.html')) renderProductsUI();
  if (page.includes('contact.html')) {
    renderOrdersUI(document.getElementById('my-orders-container'), userOrdersList, false);
    updateContactOrderDropdown();
  }
  if (page.includes('admin.html')) loadAdminDashboard();
}

async function syncProfileAndData() {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (profile) {
    currentUserProfile = profile;
    Cache.set('m_profile', profile);
    populateUserPersonalization();
  }

  if (page.includes('store.html')) loadProducts();
  if (page.includes('contact.html')) fetchUserOrders();
  if (page.includes('admin.html')) loadAdminDashboard();
}

function populateUserPersonalization() {
  const name = currentUserProfile?.full_name || currentUser?.email?.split('@')[0] || '';
  const email = currentUser?.email || '';

  const heroNameEl = document.getElementById('hero-username');
  if (heroNameEl) heroNameEl.innerText = name ? `${name} في Masrawy ` : 'Masrawy ';

  const accName = document.getElementById('acc-name');
  if (accName) {
    accName.innerText = name;
    document.getElementById('acc-email').innerText = `📧 ${email}`;
    document.getElementById('acc-phone').innerText = `📱 ${currentUserProfile?.phone || 'غير مسجل'}`;
    document.getElementById('acc-role').innerText = `نوع الحساب: ${currentUserProfile?.role === 'admin' ? 'مدير (Admin)' : 'عميل'}`;
  }

  if (currentUserProfile?.role === 'admin') {
    document.getElementById('admin-tab-btn')?.classList.remove('hidden');
  }
}
// ==========================================
// PRODUCT MANAGEMENT (ADD, EDIT MODAL, DELETE)
// ==========================================

async function createNewProduct(e) {
  e.preventDefault();
  const title = document.getElementById('new-prod-title').value;
  const price = parseFloat(document.getElementById('new-prod-price').value);
  const stock = parseInt(document.getElementById('new-prod-stock').value, 10);
  const image_url = document.getElementById('new-prod-img').value;
  const category = document.getElementById('new-prod-category')?.value || 'General';

  const { error } = await supabaseClient
    .from('products')
    .insert([{ title, price, stock, image_url, category }]);

  if (error) return alert('خطأ في الإضافة: ' + error.message);

  alert('تمت إضافة المنتج بنجاح!');
  document.getElementById('add-product-form').reset();
  await loadProducts();
  renderAdminProductsTab();
}

async function deleteProduct(productId) {
  if (!confirm('هل أنت تأكد من إزالة هذا المنتج نهائياً؟')) return;

  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) return alert('خطأ أثناء الحذف: ' + error.message);

  alert('تم حذف المنتج بنجاح');
  await loadProducts();
  renderAdminProductsTab();
}

function openEditProductModal(productId) {
  const prod = productsList.find(p => p.id === productId);
  if (!prod) return;

  closeEditProductModal();

  const modal = document.createElement('div');
  modal.id = 'edit-product-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="background: #1c1917; border: 1px solid #27272a; border-radius: 12px; padding: 24px; width: 90%; max-width: 480px; color: #fff; text-align: right;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #f59e0b;">تعديل بيانات المنتج</h3>
        <button onclick="closeEditProductModal()" style="background: none; border: none; color: #ef4444; font-size: 20px; cursor: pointer;">✕</button>
      </div>

      <form onsubmit="saveProductEdits(event, '${prod.id}')" style="display: flex; flex-direction: column; gap: 12px;">
        <label style="font-size: 13px; color: #a8a29e;">اسم المنتج</label>
        <input type="text" id="edit-prod-title" value="${prod.title || ''}" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">

        <label style="font-size: 13px; color: #a8a29e;">السعر (ج.م)</label>
        <input type="number" step="0.01" id="edit-prod-price" value="${prod.price || 0}" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">

        <label style="font-size: 13px; color: #a8a29e;">الكمية في المخزون</label>
        <input type="number" id="edit-prod-stock" value="${prod.stock || 0}" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">

        <label style="font-size: 13px; color: #a8a29e;">رابط الصورة (URL)</label>
        <input type="url" id="edit-prod-img" value="${prod.image_url || ''}" required style="padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: #fff; border-radius: 6px;">

        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <button type="submit" style="flex: 1; padding: 10px; background: #f59e0b; color: #000; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">حفظ التعديلات</button>
          <button type="button" onclick="closeEditProductModal()" style="padding: 10px 16px; background: #27272a; color: #fff; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer;">إلغاء</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeEditProductModal() {
  const modal = document.getElementById('edit-product-modal');
  if (modal) modal.remove();
}

async function saveProductEdits(e, productId) {
  e.preventDefault();
  const title = document.getElementById('edit-prod-title').value;
  const price = parseFloat(document.getElementById('edit-prod-price').value);
  const stock = parseInt(document.getElementById('edit-prod-stock').value, 10);
  const image_url = document.getElementById('edit-prod-img').value;

  const { error } = await supabaseClient
    .from('products')
    .update({ title, price, stock, image_url })
    .eq('id', productId);

  if (error) return alert('خطأ أثناء تحديث المنتج: ' + error.message);

  alert('تم تحديث بيانات المنتج بنجاح!');
  closeEditProductModal();
  await loadProducts();
  renderAdminProductsTab();
}

function renderAdminProductsTab() {
  const container = document.getElementById('admin-products-list');
  if (!container) return;

  if (!productsList || productsList.length === 0) {
    container.innerHTML = '<p style="color: #a8a29e;">لا توجد منتجات مسجلة حالياً.</p>';
    return;
  }

  container.innerHTML = productsList.map(prod => `
    <div style="background: #1c1917; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="${prod.image_url}" alt="${prod.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; background: #27272a;">
        <div>
          <h4 style="margin: 0; color: #fff;">${prod.title}</h4>
          <span style="font-size: 13px; color: #a8a29e;">السعر: <strong style="color: #f59e0b;">${prod.price} ج.م</strong> | المخزون: <strong style="color: #60a5fa;">${prod.stock ?? 0}</strong></span>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="openEditProductModal('${prod.id}')" style="background: #27272a; color: #f59e0b; border: 1px solid #f59e0b; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">✏️ تعديل</button>
        <button onclick="deleteProduct('${prod.id}')" style="background: #ef4444; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">🗑️ حذف</button>
      </div>
    </div>
  `).join('');
}

// STORE & PRODUCTS WITH STOCK LOGIC
async function loadProducts() {
  const { data } = await supabaseClient.from('products').select('*, product_reviews(*)');
  if (data) {
    productsList = data;
    Cache.set('m_products', data);
    renderProductsUI();
  }
}

function renderProductsUI() {
  const grid = document.getElementById('products-grid');
  if (!grid || !productsList.length) return;
  grid.innerHTML = '';
  productsList.forEach(p => {
    const stock = p.stock ?? 0;
    let stockBadge = '';
    let disableBtn = false;

    if (stock <= 0) {
      stockBadge = '<span style="color:#ef4444; font-weight:bold; font-size:12px;">نفذت الكمية ❌</span>';
      disableBtn = true;
    } else if (stock <= 5) {
      stockBadge = `<span style="color:#f59e0b; font-weight:bold; font-size:12px;">متبقي ${stock} قطع فقط! ⚠️</span>`;
    } else {
      stockBadge = `<span style="color:#10b981; font-size:12px;">متوفر: ${stock}</span>`;
    }

    grid.innerHTML += `
      <div class="card product-card card-hover">
        <img src="${p.image_url}" alt="${p.title}">
        <div style="margin-top:6px;">${stockBadge}</div>
        <h4 style="font-size:16px; margin:4px 0;">${p.title}</h4>
        <div class="product-price">${p.price} ج.م</div>
        <button class="btn-submit" ${disableBtn ? 'disabled style="opacity:0.5;"' : ''} onclick="addToCart('${p.id}')">
          ${disableBtn ? 'غير متوفر' : 'إضافة للسلة'}
        </button>
      </div>
    `;
  });
}

function addToCart(productId) {
  const prod = productsList.find(p => p.id === productId);
  if (!prod) return;

  const inCart = cart.find(c => c.id === productId);
  const currentCartQty = inCart ? inCart.qty : 0;
  const availableStock = prod.stock ?? 0;

  if (currentCartQty + 1 > availableStock) {
    return alert(`عذراً، لا يمكنك إضافة أكثر من ${availableStock} قطع من هذا المنتج (الكمية المتاحة في المخزون).`);
  }

  if (inCart) inCart.qty += 1;
  else cart.push({ ...prod, qty: 1 });
  
  saveCart();
  alert('تمت إضافة المنتج للسلة!');
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  saveCart();
}

function updateCartUI() {
  const countEl = document.getElementById('cart-count');
  const listEl = document.getElementById('cart-items-list');
  const totalEl = document.getElementById('cart-total-price');
  
  if (countEl) countEl.innerText = cart.reduce((a, b) => a + b.qty, 0);
  if (!listEl) return;

  listEl.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;
    listEl.innerHTML += `
      <div class="cart-item" style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div>
          <div style="font-weight:bold; font-size:14px; color:#fff;">${item.title}</div>
          <div style="color:var(--text-muted); font-size:12px;">${item.price} ج.م × ${item.qty}</div>
        </div>
        <button onclick="removeFromCart('${item.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;">حذف</button>
      </div>
    `;
  });

  if (totalEl) totalEl.innerText = total.toFixed(2) + ' ج.م';
  validatePaymentMethods();
}

function toggleCart() {
  document.getElementById('cart-drawer')?.classList.toggle('open');
}

function validatePaymentMethods() {
  const hasCvItem = cart.some(item => item.isCv);
  const codOption = document.getElementById('opt-cod');
  const notice = document.getElementById('cv-payment-notice');
  const paySelect = document.getElementById('payment-method-select');

  if (hasCvItem) {
    if (codOption) codOption.disabled = true;
    if (paySelect) paySelect.value = 'online';
    notice?.classList.remove('hidden');
  } else {
    if (codOption) codOption.disabled = false;
    notice?.classList.add('hidden');
  }
}

// ORDERS & CONTACT PAGE (ITEMIZED DETAILS & MESSAGES)
async function fetchUserOrders() {
  const { data } = await supabaseClient
    .from('orders')
    .select('*, print_jobs(*), cv_submissions(*), order_items(*, products(*)), order_messages(*)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (data) {
    userOrdersList = data;
    Cache.set('m_orders', data);
    renderOrdersUI(document.getElementById('my-orders-container'), data, false);
    updateContactOrderDropdown();
  }
}

function updateContactOrderDropdown() {
  const select = document.getElementById('contact-order-select');
  if (!select) return;

  if (!userOrdersList.length) {
    select.innerHTML = '<option value="">لا توجد طلبات مسجلة</option>';
    return;
  }

  select.innerHTML = '<option value="">-- اختر رقم الطلب --</option>';
  userOrdersList.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = `طلب #${o.id.substring(0, 8)} (${o.service_type}) - ${o.total_amount} ج.م`;
    select.appendChild(opt);
  });
}

function renderOrdersUI(container, orders, isAdmin) {
  if (!container) return;
  container.innerHTML = orders?.length ? '' : '<p style="color:#a8a29e;">لا توجد طلبات مسجلة.</p>';

  orders?.forEach(o => {
    // Render itemized details
    let itemsHTML = '';
    if (o.order_items?.length) {
      itemsHTML = o.order_items.map(i => `
        <div style="font-size:13px; color:#d6d3d1; padding:4px 0; border-bottom:1px dashed #333;">
          📦 ${i.products?.title || 'منتج'} - <strong>${i.quantity} قطعة</strong> (${i.unit_price} ج.م)
        </div>
      `).join('');
    } else if (o.cv_submissions?.length) {
      const cv = o.cv_submissions[0];
      itemsHTML = `
        <div style="font-size:13px; color:#d6d3d1;">
          📄 <strong>سيرة ذاتية:</strong> ${cv.full_name} (${cv.job_title})<br>
          🌐 <strong>النطاق المطلوبة:</strong> ${cv.custom_domain || 'لم يحدد'}
        </div>
      `;
    }

    let chatMessages = o.order_messages?.map(m => `
      <div class="chat-msg ${m.sender_id === currentUser.id ? 'mine' : 'other'}" style="margin:4px 0; padding:6px 10px; border-radius:8px; font-size:12px; background:${m.sender_id === currentUser.id ? '#d97706':'#27272a'}; color:#fff;">
        ${m.message}
      </div>
    `).join('') || '';

    container.innerHTML += `
      <div class="card" style="margin-bottom:16px; background:#1c1917; border:1px solid #292524; padding:16px; border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #292524; padding-bottom:8px;">
          <div>
            <h4 style="margin:0;">طلب #${o.id.substring(0,8)} <span style="font-size:12px; color:#a8a29e;">(${o.service_type})</span></h4>
            <div style="font-size:12px; color:#a8a29e;">التاريخ: ${new Date(o.created_at).toLocaleDateString('ar-EG')}</div>
          </div>
          <span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">${o.status}</span>
        </div>
        
        ${isAdmin ? `<p style="font-size:13px; margin:8px 0; color:#f59e0b;">👤 العميل: ${o.profiles?.full_name || o.profiles?.email || 'N/A'}</p>` : ''}

        <div style="margin:12px 0;">
          <strong style="font-size:13px; color:#f59e0b;">تفاصيل الطلب:</strong>
          ${itemsHTML}
          <div style="margin-top:6px; font-weight:bold; font-size:14px;">الإجمالي: ${o.total_amount} ج.م</div>
        </div>
        
        <div class="chat-box" style="margin-top:12px; max-height:150px; overflow-y:auto; background:#18181b; padding:8px; border-radius:8px;">
          ${chatMessages || '<span style="font-size:12px; color:#71717a;">لا توجد رسائل دعم.</span>'}
        </div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <input type="text" id="input-${o.id}" placeholder="اكتب رسالة لـ Masrawy ..." style="flex:1; padding:8px; border:1px solid #3f3f46; border-radius:6px; background:#27272a; color:#fff; font-size:13px;">
          <button class="btn-submit" style="width:auto; padding:8px 16px; font-size:13px;" onclick="sendMessage('${o.id}')">إرسال</button>
        </div>
      </div>
    `;
  });
}

// CHECKOUT & PAYMENT EXECUTION
async function processCartCheckout() {
  if (!cart.length) return alert('السلة فارغة.');

  const paymentMethod = document.getElementById('payment-method-select')?.value || 'online';
  const hasCvItem = cart.some(item => item.isCv);

  if (hasCvItem && paymentMethod === 'cod') {
    return alert('طلبات السيرة الذاتية والطباعة تتطلب الدفع الإلكتروني فقط.');
  }

  // Double check stock availability before checkout
  for (let item of cart) {
    if (!item.isCv) {
      const prod = productsList.find(p => p.id === item.id);
      if (prod && item.qty > prod.stock) {
        return alert(`الكمية المطلوبة من "${item.title}" تتجاوز المخزون المتاح (${prod.stock}). يرجى تعديل السلة.`);
      }
    }
  }

  const total = cart.reduce((a, b) => a + (b.price * b.qty), 0);

  const orderPayload = {
    userId: currentUser.id,
    serviceType: hasCvItem ? 'cv_website' : 'store',
    totalAmount: total,
    paymentMethod: paymentMethod,
    items: cart.map(item => ({
      id: item.id,
      title: item.title || (item.isCv ? 'تصميم سيرة ذاتية' : 'منتج متجر'),
      price: Number(item.price),
      qty: Number(item.qty),
      isCv: !!item.isCv,
      details: item.details || null
    }))
  };

  if (paymentMethod === 'online') {
    sessionStorage.setItem('pending_stripe_order', JSON.stringify(orderPayload));
    await initiateStripeCheckout(orderPayload.items);
  } else {
    const order = await createOrderInDatabase(orderPayload, 'pending');
    if (order) {
      await deductCartStock(orderPayload.items);
      cart = [];
      saveCart();
      toggleCart();
      alert('تم تسجيل طلبك بنجاح في Masrawy!');
      window.location.href = 'contact.html';
    }
  }
}

async function deductCartStock(items) {
  for (let item of items) {
    if (!item.isCv) {
      await supabaseClient.rpc('decrement_stock', { p_id: item.id, p_qty: item.qty });
    }
  }
}

async function createOrderInDatabase(payload, initialStatus) {
  const { data: order, error } = await supabaseClient
    .from('orders')
    .insert([{
      user_id: payload.userId,
      service_type: payload.serviceType,
      total_amount: payload.totalAmount,
      payment_method: payload.paymentMethod,
      status: initialStatus
    }])
    .select().single();

  if (error) {
    alert('خطأ أثناء تسجيل الطلب: ' + error.message);
    return null;
  }

  for (let item of payload.items) {
    if (item.isCv && item.details) {
      const cv = item.details;
      await supabaseClient.from('cv_submissions').insert([{
        order_id: order.id,
        full_name: cv.full_name || cv.name || currentUserProfile?.full_name || '',
        job_title: cv.job_title || cv.title || '',
        phone: cv.phone || cv.phone_number || currentUserProfile?.phone || '',
        email: cv.email || currentUser?.email || '',
        skills: cv.skills || '',
        primary_color: cv.primary_color || '#d97706',
        bio: cv.bio || '',
        custom_domain: cv.custom_domain || cv.domain || cv.domain_name || null,
        plan_tier: cv.plan_tier || cv.tier || 'normal'
      }]);
    } else if (!item.isCv) {
      await supabaseClient.from('order_items').insert([{
        order_id: order.id,
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price
      }]);
    }
  }

  return order;
}

async function initiateStripeCheckout(items) {
  const returnUrl = `${window.location.origin}${isSubfolder() ? '/pages/contact.html' : '/pages/contact.html'}`;

  const lineItems = items.map(item => ({
    title: item.title,
    price: item.price,
    qty: item.qty
  }));

  try {
    const { data, error } = await supabaseClient.functions.invoke('create-checkout', {
      body: { items: lineItems, orderId: 'pending_' + Date.now(), returnUrl }
    });

    if (error || !data?.url) {
      alert('خطأ أثناء توجيه بوابة الدفع: ' + (error?.message || 'تعذر الحصول على رابط الدفع'));
      sessionStorage.removeItem('pending_stripe_order');
      return;
    }

    window.location.href = data.url;
  } catch (e) {
    alert('خطأ في شبكة الدفع.');
  }
}

async function handleStripeReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');

  if (!status) return;

  const rawPending = sessionStorage.getItem('pending_stripe_order');

  if (status === 'success' && rawPending) {
    const payload = JSON.parse(rawPending);
    const order = await createOrderInDatabase(payload, 'paid');
    
    if (order) {
      await deductCartStock(payload.items);
      sessionStorage.removeItem('pending_stripe_order');
      cart = [];
      saveCart();
      alert('تم دفع الطلب وتسجيله بنجاح!');
    }
  } else if (status === 'cancelled') {
    sessionStorage.removeItem('pending_stripe_order');
    alert('تم إلغاء عملية الدفع ولم يتم تسجيل الطلب.');
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

// MULTI-TAB ADMIN DASHBOARD LOGIC
async function loadAdminDashboard() {
  if (currentUserProfile?.role !== 'admin') return;

  // 1. Load products into memory first
  await loadProducts();

  // 2. Fetch all profiles and orders
  const { data: profiles } = await supabaseClient.from('profiles').select('*');
  const { data: orders } = await supabaseClient
    .from('orders')
    .select('*, profiles(*), cv_submissions(*), order_items(*, products(*)), order_messages(*)')
    .order('created_at', { ascending: false });

  allProfiles = profiles || [];
  allAdminOrders = orders || [];

  // 3. Render all tabs with updated data
  renderAdminAnalytics();
  renderAdminProductsTab();
  renderAdminCVsTab();
  renderAdminOrdersTab();
  renderAdminUsersTab();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.admin-nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
  document.getElementById(`btn-tab-${tabName}`)?.classList.add('active');
}

function renderAdminAnalytics() {
  const totalRevenue = allAdminOrders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const totalOrders = allAdminOrders.length;
  
  // Calculate best selling product
  const productCounts = {};
  allAdminOrders.forEach(o => {
    o.order_items?.forEach(i => {
      const name = i.products?.title || 'منتج غير معروف';
      productCounts[name] = (productCounts[name] || 0) + i.quantity;
    });
  });

  let bestProduct = 'لا يوجد حتى الآن';
  let maxSales = 0;
  for (let [prod, count] of Object.entries(productCounts)) {
    if (count > maxSales) { maxSales = count; bestProduct = `${prod} (${count} مبيعات)`; }
  }

  const revEl = document.getElementById('stat-total-revenue');
  const ordEl = document.getElementById('stat-total-orders');
  const bestEl = document.getElementById('stat-best-product');

  if (revEl) revEl.innerText = `${totalRevenue.toFixed(2)} ج.م`;
  if (ordEl) ordEl.innerText = totalOrders;
  if (bestEl) bestEl.innerText = bestProduct;
}



async function quickEditProduct(id, currentPrice, currentStock) {
  const newPrice = prompt('أدخل السعر الجديد (ج.م):', currentPrice);
  const newStock = prompt('أدخل الكمية المتاحة في المخزون:', currentStock);

  if (newPrice !== null && newStock !== null) {
    const { error } = await supabaseClient.from('products').update({
      price: Number(newPrice),
      stock: Number(newStock)
    }).eq('id', id);

    if (!error) {
      alert('تم تحديث المنتج بنجاح!');
      loadProducts();
      loadAdminDashboard();
    } else {
      alert('خطأ في التحديث: ' + error.message);
    }
  }
}



function renderAdminCVsTab() {
  const container = document.getElementById('admin-cvs-list');
  if (!container) return;

  const cvOrders = allAdminOrders.filter(o => o.cv_submissions?.length);
  if (!cvOrders.length) {
    container.innerHTML = '<p style="color:#a8a29e;">لا توجد طلبات سيرة ذاتية.</p>';
    return;
  }

  container.innerHTML = cvOrders.map(o => {
    const cv = o.cv_submissions[0];
    return `
      <div class="card" style="margin-bottom:12px; background:#1c1917; padding:12px;">
        <div style="display:flex; justify-content:space-between;">
          <strong style="color:#f59e0b;">العميل: ${o.profiles?.full_name || 'N/A'} (${cv.email})</strong>
          <span style="font-size:12px; color:#a8a29e;">طلب #${o.id.substring(0,8)}</span>
        </div>
        <div style="font-size:13px; color:#d6d3d1; margin-top:8px;">
          📌 <strong>الاسم بالكامل:</strong> ${cv.full_name}<br>
          💼 <strong>المسمى الوظيفي:</strong> ${cv.job_title}<br>
          📞 <strong>الهاتف:</strong> ${cv.phone}<br>
          🌐 <strong>النطاق المطلوب:</strong> <span style="color:#60a5fa;">${cv.custom_domain || 'غير محدد'}</span><br>
          🎨 <strong>الباقة:</strong> ${cv.plan_tier}
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminOrdersTab() {
  renderOrdersUI(document.getElementById('admin-orders-container'), allAdminOrders, true);
}

function renderAdminUsersTab() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  container.innerHTML = allProfiles.map(u => {
    const userOrders = allAdminOrders.filter(o => o.user_id === u.id);
    const totalSpent = userOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    return `
      <div class="card" style="margin-bottom:12px; background:#1c1917; padding:12px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#fff;">${u.full_name || 'عميل بدون اسم'}</strong>
            <div style="font-size:12px; color:#a8a29e;">📱 ${u.phone || 'بدون هاتف'} | 🆔 ${u.id.substring(0,8)}</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:12px; color:#10b981; font-weight:bold;">إجمالي الإنفاق: ${totalSpent.toFixed(2)} ج.م</div>
            <div style="font-size:12px; color:#a8a29e;">عدد الطلبات: ${userOrders.length}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function sendMessage(orderId) {
  const input = document.getElementById(`input-${orderId}`);
  if (!input?.value.trim()) return;

  await supabaseClient.from('order_messages').insert([{
    order_id: orderId,
    sender_id: currentUser.id,
    message: input.value
  }]);

  input.value = '';
  if (currentUserProfile?.role === 'admin') loadAdminDashboard();
  else fetchUserOrders();
}

async function handleDirectContact(e) {
  e.preventDefault();
  const orderId = document.getElementById('contact-order-select').value;
  const messageText = document.getElementById('contact-message-body').value;

  if (!orderId || !messageText.trim()) return alert('يرجى اختيار رقم الطلب وإدخال الرسالة.');

  const { error } = await supabaseClient.from('order_messages').insert([{
    order_id: orderId,
    sender_id: currentUser.id,
    message: `[ملاحظات/دعم]: ${messageText}`
  }]);

  if (!error) {
    alert('تم إرسال الرسالة إلى الإدارة بنجاح!');
    document.getElementById('contact-message-body').value = '';
    fetchUserOrders();
  } else {
    alert('خطأ أثناء إرسال الرسالة: ' + error.message);
  }
}

// EXPOSE WINDOW FUNCTIONS
window.toggleAuthMode = toggleAuthMode;
window.executeAuth = executeAuth;
window.logout = logout;
window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.validatePaymentMethods = validatePaymentMethods;
window.processCartCheckout = processCartCheckout;
window.handleDirectContact = handleDirectContact;
window.sendMessage = sendMessage;
window.switchAdminTab = switchAdminTab;
window.quickEditProduct = quickEditProduct;
window.deleteProduct = deleteProduct;
window.createNewProduct = createNewProduct;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.saveProductEdits = saveProductEdits;