if (window.top !== window.self) {
  document.body.replaceChildren();
  throw new Error('Account page must be opened directly');
}

const accountApi = window.URAVAI_ACCOUNT_API_URL || '';
const accountForm = document.querySelector('#account-form');
const accountPhone = document.querySelector('#account-phone');
const accountCode = document.querySelector('#account-code');
const accountCodeField = document.querySelector('#account-code-field');
const accountStatus = document.querySelector('#account-status');
const accountSubmit = document.querySelector('.account-submit');
const accountResults = document.querySelector('#account-results');

function showAccountStatus(message) {
  accountStatus.textContent = message;
}

function validInvoiceUrl(value) {
  try {
    const url = new URL(value);
    const service = new URL(accountApi);
    return url.protocol === 'https:' && url.origin === service.origin &&
      url.pathname.startsWith('/storage/v1/object/sign/uravai-bills/') ? url.href : null;
  } catch {
    return null;
  }
}

function invoiceLink(order) {
  const linkUrl = validInvoiceUrl(order.invoiceUrl);
  if (!linkUrl) {
    const unavailable = document.createElement('span');
    unavailable.className = 'bill-unavailable';
    unavailable.textContent = 'Ask us for this bill';
    return unavailable;
  }
  const link = document.createElement('a');
  link.href = linkUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Download PDF ↗';
  link.setAttribute('aria-label', `Download bill ${order.orderNumber || ''} as PDF`);
  return link;
}

function displayAccount(data) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  document.querySelector('#points-balance').textContent = String(Number(data.pointsBalance) || 0);
  const latest = document.querySelector('#latest-bill');
  const history = document.querySelector('#bill-history');
  latest.replaceChildren();
  history.replaceChildren();

  if (orders.length) {
    const first = orders[0];
    const title = document.createElement('h3');
    title.textContent = first.product || 'Your latest order';
    const date = document.createElement('p');
    date.textContent = `${first.orderNumber || 'Order'} · ${first.date || ''}`;
    latest.append(title, date, invoiceLink(first));
    orders.forEach(order => {
      const row = document.createElement('div');
      row.className = 'bill-row';
      const product = document.createElement('strong');
      product.textContent = order.product || 'URAVAI keepsake';
      const orderDate = document.createElement('span');
      orderDate.textContent = `${order.orderNumber || 'Order'} · ${order.date || ''}`;
      row.append(product, orderDate, invoiceLink(order));
      history.append(row);
    });
  } else {
    const empty = document.createElement('p');
    empty.textContent = 'No orders are linked to this number yet. Contact us if an order is missing.';
    latest.append(empty);
  }
  accountResults.hidden = false;
  accountResults.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function clearAccountResults() {
  accountResults.hidden = true;
  document.querySelector('#latest-bill').replaceChildren();
  document.querySelector('#bill-history').replaceChildren();
  document.querySelector('#points-balance').textContent = '0';
}

if (!accountApi) {
  accountCodeField.hidden = true;
  accountCode.required = false;
  document.querySelector('.account-intro>p').textContent = 'Request your current points and copies of your latest and past bills using the mobile number from your order.';
  document.querySelector('.account-login-card>p').textContent = 'Enter the mobile number from your order. Your request will open WhatsApp, where we can verify you and help with your records.';
  accountSubmit.firstChild.textContent = 'Request my points & bills ';
  document.querySelector('#account-privacy').textContent = 'This opens WhatsApp with your number ready to send. We will verify you before sharing points or bills. Online account access is being prepared.';
}

accountForm?.addEventListener('submit', async event => {
  event.preventDefault();
  showAccountStatus('');
  clearAccountResults();
  if (!accountForm.reportValidity()) return;
  const phone = accountPhone.value.replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    showAccountStatus('Enter a valid 10-digit Indian mobile number.');
    accountPhone.focus();
    return;
  }

  if (!accountApi) {
    const message = `Hello URAVAI! I would like to check my loyalty points and request my latest and previous bills. My order mobile number is +91 ${phone}. Please verify me before sharing my details.`;
    window.location.href = `https://wa.me/919444464674?text=${encodeURIComponent(message)}`;
    return;
  }

  accountSubmit.disabled = true;
  showAccountStatus('Finding your account…');
  try {
    const response = await fetch(accountApi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.URAVAI_PUBLISHABLE_KEY
      },
      body: JSON.stringify({action: 'lookup', phone: `+91${phone}`, code: accountCode.value.trim()}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer'
    });
    if (!response.ok) {
      const error = new Error('Account unavailable');
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    displayAccount(data);
    accountCode.value = '';
    showAccountStatus('');
  } catch (error) {
    showAccountStatus(error.status === 429
      ? 'Too many attempts. Please try again in 15 minutes or chat with us for help.'
      : error.status === 401
        ? 'We could not verify this account. Check your number and code, or chat with us for help.'
        : 'The account service is temporarily unavailable. Please try again or chat with us for help.');
  } finally {
    accountSubmit.disabled = false;
  }
});

document.querySelector('#account-signout')?.addEventListener('click', () => {
  clearAccountResults();
  accountForm.reset();
  accountPhone.focus();
  window.scrollTo({top: 0, behavior: 'smooth'});
});

window.addEventListener('pagehide', () => {
  clearAccountResults();
  accountForm.reset();
});
