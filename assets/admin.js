const adminApi = window.URAVAI_ADMIN_API_URL || '';
const loginForm = document.querySelector('#admin-login-form');
const orderForm = document.querySelector('#admin-order-form');
const loginStatus = document.querySelector('#admin-login-status');
const orderStatus = document.querySelector('#admin-order-status');
const recentList = document.querySelector('#admin-recent-list');
let adminSession = '';
let rupeesPerPoint = 100;

function updatePointsPreview() {
  const amount = Number(document.querySelector('#order-amount').value);
  document.querySelector('#order-points').value = String(
    Number.isFinite(amount) && amount > 0 ? Math.floor(amount / rupeesPerPoint) : 0
  );
}
document.querySelector('#order-amount')?.addEventListener('input', updatePointsPreview);

async function adminRequest(action, data, isMultipart = false) {
  const body = isMultipart ? data : JSON.stringify({action, ...data});
  if (isMultipart) body.append('action', action);
  const response = await fetch(adminApi, {
    method: 'POST',
    headers: {
      ...(isMultipart ? {} : {'Content-Type': 'application/json'}),
      ...(adminSession ? {'Authorization': `Bearer ${adminSession}`} : {})
    },
    body,
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

function showRecentOrders(orders) {
  recentList.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No purchases have been recorded yet.';
    recentList.append(empty);
    return;
  }
  orders.forEach(order => {
    const row = document.createElement('div');
    row.className = 'admin-order-row';
    const number = document.createElement('strong');
    number.textContent = order.orderNumber || 'Order';
    const customer = document.createElement('span');
    customer.textContent = order.customerName || 'Customer';
    const date = document.createElement('span');
    date.textContent = order.date || '';
    const points = document.createElement('b');
    points.textContent = `${Number(order.points) || 0} pts`;
    row.append(number, customer, date, points);
    recentList.append(row);
  });
}

async function refreshOrders() {
  const result = await adminRequest('listOrders', {});
  showRecentOrders(Array.isArray(result.orders) ? result.orders : []);
}

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  loginStatus.textContent = '';
  if (!loginForm.reportValidity()) return;
  if (!adminApi) {
    loginStatus.textContent = 'The private order service is being connected. No login details were sent.';
    return;
  }
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginStatus.textContent = 'Signing in…';
  try {
    const result = await adminRequest('adminLogin', {
      username: document.querySelector('#admin-username').value.trim(),
      password: document.querySelector('#admin-password').value
    });
    if (!result.token) throw new Error('Missing session');
    adminSession = result.token;
    rupeesPerPoint = Number(result.rupeesPerPoint) || 100;
    document.querySelector('#points-rule-note').textContent = `Automatically calculated: 1 point per ₹${rupeesPerPoint} spent.`;
    document.querySelector('#admin-password').value = '';
    document.querySelector('#admin-login').hidden = true;
    document.querySelector('#admin-dashboard').hidden = false;
    document.querySelector('#order-date').valueAsDate = new Date();
    loginStatus.textContent = '';
    await refreshOrders();
  } catch {
    loginStatus.textContent = 'Unable to sign in. Check your details or try again later.';
  } finally {
    button.disabled = false;
  }
});

orderForm?.addEventListener('submit', async event => {
  event.preventDefault();
  orderStatus.textContent = '';
  if (!orderForm.reportValidity()) return;
  const phone = document.querySelector('#order-phone').value.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    orderStatus.textContent = 'Enter a valid 10-digit Indian mobile number.';
    return;
  }
  const pdf = document.querySelector('#order-invoice').files[0];
  if (pdf && (pdf.type !== 'application/pdf' || pdf.size > 10 * 1024 * 1024)) {
    orderStatus.textContent = 'Choose a PDF smaller than 10 MB.';
    return;
  }
  const button = orderForm.querySelector('button[type="submit"]');
  button.disabled = true;
  orderStatus.textContent = 'Saving this order…';
  try {
    const data = new FormData(orderForm);
    data.set('phone', `+91${phone}`);
    const result = await adminRequest('createOrder', data, true);
    orderStatus.textContent = 'Order saved. Points and bill are now linked to this customer.';
    const codePanel = document.querySelector('#admin-access-code');
    codePanel.hidden = !result.accessCode;
    document.querySelector('#new-access-code').textContent = result.accessCode || '';
    orderForm.reset();
    document.querySelector('#order-date').valueAsDate = new Date();
    updatePointsPreview();
    await refreshOrders();
  } catch {
    orderStatus.textContent = 'The order could not be saved. Check the details and try again.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#admin-reset-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const status = document.querySelector('#admin-reset-status');
  const phone = document.querySelector('#reset-phone').value.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    status.textContent = 'Enter a valid 10-digit Indian mobile number.';
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Creating a new code…';
  try {
    const result = await adminRequest('resetCode', {phone: `+91${phone}`});
    document.querySelector('#new-access-code').textContent = result.accessCode;
    document.querySelector('#admin-access-code').hidden = false;
    status.textContent = 'New code created. The old code no longer works.';
    form.reset();
  } catch {
    status.textContent = 'Could not create a new code. Check the number and try again.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#admin-signout')?.addEventListener('click', () => {
  adminSession = '';
  document.querySelector('#admin-dashboard').hidden = true;
  document.querySelector('#admin-login').hidden = false;
  document.querySelector('#admin-access-code').hidden = true;
  document.querySelector('#new-access-code').textContent = '';
  loginForm.reset();
});
document.querySelector('#admin-refresh')?.addEventListener('click', () => refreshOrders().catch(() => {
  recentList.textContent = 'Could not load recent purchases. Please try again.';
}));
document.querySelector('#copy-access-code')?.addEventListener('click', async () => {
  const code = document.querySelector('#new-access-code').textContent;
  if (code) await navigator.clipboard.writeText(code);
});
