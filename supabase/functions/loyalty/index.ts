import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();
const productionOrigin = 'https://heyitsbright.github.io';
const bucket = 'uravai-bills';

function reply(data: unknown, status = 200, origin = '') {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(origin: string) {
  return origin === productionOrigin ||
    (origin === Deno.env.get('LOCAL_PREVIEW_ORIGIN') && Boolean(origin));
}

function serverKey() {
  const keySet = Deno.env.get('SUPABASE_SECRET_KEYS');
  const key = keySet ? JSON.parse(keySet).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || key.length < 32) throw new Error('Server key is not configured');
  return key;
}

function database() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = serverKey();
  if (!url || !key) throw new Error('Database service is not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function sessionToken() {
  const secret = Deno.env.get('ADMIN_SESSION_SECRET') || serverKey();
  if (secret.length < 32) throw new Error('Admin session secret is not configured');
  const payload = base64url(encoder.encode(JSON.stringify({ role: 'admin', exp: Date.now() + 60 * 60 * 1000 })));
  return `${payload}.${base64url(await hmac(`admin-session:${secret}`, payload))}`;
}

async function validSession(req: Request) {
  const secret = Deno.env.get('ADMIN_SESSION_SECRET') || serverKey();
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const actual = base64url(await hmac(`admin-session:${secret}`, payload));
    if (!equalHex(signature, actual)) return false;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64url(payload)));
    return parsed.role === 'admin' && Number.isFinite(parsed.exp) && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

async function rateAllowed(db: ReturnType<typeof database>, key: string, max: number, seconds: number) {
  const { data, error } = await db.rpc('loyalty_allow_attempt', {
    p_key: key,
    p_max: max,
    p_window_seconds: seconds
  });
  if (error) throw error;
  return data === true;
}

function normalizedPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  const phone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(phone) ? `+91${phone}` : '';
}

function normalizedCode(value: unknown) {
  return String(value || '').toUpperCase().replace(/[\s-]/g, '');
}

async function codeHash(phone: string, code: string) {
  const pepper = Deno.env.get('ACCESS_PEPPER') || serverKey();
  if (pepper.length < 32) throw new Error('Customer access secret is not configured');
  return hex(await hmac(`customer-access:${pepper}`, `${phone}:${normalizedCode(code)}`));
}

function newCode() {
  const code = hex(crypto.getRandomValues(new Uint8Array(12))).toUpperCase();
  return code.match(/.{1,6}/g)!.join('-');
}

function remoteKey(req: Request, scope: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') || 'unknown';
  return sha256(`${scope}:${ip}`);
}

async function handleLogin(req: Request, body: Record<string, unknown>, origin: string) {
  const db = database();
  const attempt = await remoteKey(req, 'admin');
  const allowedFromAddress = await rateAllowed(db, attempt, 8, 15 * 60);
  const allowedOverall = await rateAllowed(db, await sha256('admin:all-addresses'), 30, 15 * 60);
  if (!allowedFromAddress || !allowedOverall) return reply({ error: 'Try again later' }, 429, origin);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const expectedUser = Deno.env.get('ADMIN_USER') || 'uravaiadmin';
  const expectedPassword = Deno.env.get('ADMIN_PASSWORD');
  if (!expectedPassword || password.length > 200) return reply({ error: 'Sign-in unavailable' }, 503, origin);
  const actualHash = await sha256(password);
  const expectedHash = await sha256(expectedPassword);
  if (username !== expectedUser || !equalHex(actualHash, expectedHash)) {
    return reply({ error: 'Invalid credentials' }, 401, origin);
  }
  const rupeesPerPoint = Number(Deno.env.get('RUPEES_PER_POINT') || '10');
  if (!Number.isSafeInteger(rupeesPerPoint) || rupeesPerPoint < 1) {
    return reply({ error: 'Rewards rule is not configured' }, 503, origin);
  }
  return reply({ token: await sessionToken(), rupeesPerPoint }, 200, origin);
}

async function handleLookup(req: Request, body: Record<string, unknown>, origin: string) {
  const phone = normalizedPhone(body.phone);
  const code = normalizedCode(body.code);
  if (!phone || !/^[A-F0-9]{24}$/.test(code)) return reply({ error: 'Unable to verify account' }, 401, origin);
  const db = database();
  const attempt = await remoteKey(req, `customer:${phone}`);
  if (!await rateAllowed(db, attempt, 12, 15 * 60)) return reply({ error: 'Try again later' }, 429, origin);
  const { data: customer, error: customerError } = await db.from('loyalty_customers')
    .select('id, access_hash').eq('phone', phone).maybeSingle();
  if (customerError) throw customerError;
  const providedHash = await codeHash(phone, code);
  if (!customer || !equalHex(providedHash, customer.access_hash)) {
    return reply({ error: 'Unable to verify account' }, 401, origin);
  }
  const { data: rows, error: ordersError } = await db.from('loyalty_orders')
    .select('order_number,order_date,product,points,invoice_path')
    .eq('customer_id', customer.id).order('order_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (ordersError) throw ordersError;
  const orders = await Promise.all((rows || []).map(async row => {
    let invoiceUrl: string | null = null;
    if (row.invoice_path) {
      const { data } = await db.storage.from(bucket).createSignedUrl(row.invoice_path, 300, {
        download: `URAVAI-${row.order_number}.pdf`
      });
      invoiceUrl = data?.signedUrl || null;
    }
    return {
      orderNumber: row.order_number,
      date: row.order_date,
      product: row.product,
      points: row.points,
      invoiceUrl
    };
  }));
  return reply({ pointsBalance: orders.reduce((sum, order) => sum + order.points, 0), orders }, 200, origin);
}

async function handleRecent(origin: string) {
  const db = database();
  const { data, error } = await db.from('loyalty_orders')
    .select('order_number,order_date,points,loyalty_customers(customer_name)')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const orders = (data || []).map((row: any) => ({
    orderNumber: row.order_number,
    date: row.order_date,
    points: row.points,
    customerName: row.loyalty_customers?.customer_name || 'Customer'
  }));
  return reply({ orders }, 200, origin);
}

async function handleCreate(form: FormData, origin: string) {
  const phone = normalizedPhone(form.get('phone'));
  const name = String(form.get('name') || '').trim();
  const orderNumber = String(form.get('orderNumber') || '').trim();
  const date = String(form.get('date') || '');
  const product = String(form.get('product') || '').trim();
  const amountText = String(form.get('amount') || '');
  const amount = Number(amountText);
  const invoice = form.get('invoice');
  if (!phone || !name || name.length > 80 || !orderNumber || orderNumber.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !product || product.length > 80 ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(amountText) ||
      !Number.isFinite(amount) || amount < 0 || amount > 10000000) {
    return reply({ error: 'Check the order details' }, 400, origin);
  }
  const pdf = invoice instanceof File && invoice.size ? invoice : null;
  if (pdf) {
    if (pdf.size > 6291456 || pdf.type !== 'application/pdf' ||
        new TextDecoder().decode((await pdf.slice(0, 5).arrayBuffer())) !== '%PDF-') {
      return reply({ error: 'Bill must be a PDF under 6 MB' }, 400, origin);
    }
  }
  const rupeesPerPoint = Number(Deno.env.get('RUPEES_PER_POINT') || '10');
  if (!Number.isSafeInteger(rupeesPerPoint) || rupeesPerPoint < 1) {
    return reply({ error: 'Rewards rule is not configured' }, 503, origin);
  }
  const amountPaise = Math.round(amount * 100);
  const points = Math.floor(amountPaise / (rupeesPerPoint * 100));
  const db = database();
  const { data: duplicate } = await db.from('loyalty_orders').select('id')
    .eq('order_number', orderNumber).maybeSingle();
  if (duplicate) return reply({ error: 'This order number already exists' }, 409, origin);

  let customerId = '';
  let accessCode = '';
  let createdCustomer = false;
  let invoicePath = '';
  try {
    const { data: existing, error: findError } = await db.from('loyalty_customers')
      .select('id').eq('phone', phone).maybeSingle();
    if (findError) throw findError;
    if (existing) {
      customerId = existing.id;
    } else {
      accessCode = newCode();
      const { data: created, error: createError } = await db.from('loyalty_customers')
        .insert({ phone, customer_name: name, access_hash: await codeHash(phone, accessCode) })
        .select('id').single();
      if (createError) throw createError;
      customerId = created.id;
      createdCustomer = true;
    }
    if (pdf) {
      invoicePath = `${customerId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await db.storage.from(bucket).upload(invoicePath, pdf, {
        contentType: 'application/pdf', upsert: false
      });
      if (uploadError) throw uploadError;
    }
    const { error: orderError } = await db.from('loyalty_orders').insert({
      customer_id: customerId,
      order_number: orderNumber,
      order_date: date,
      product,
      amount_paise: amountPaise,
      points,
      invoice_path: invoicePath || null
    });
    if (orderError) throw orderError;
    return reply({ ok: true, points, accessCode: accessCode || null }, 200, origin);
  } catch (error) {
    if (invoicePath) await db.storage.from(bucket).remove([invoicePath]);
    if (createdCustomer && customerId) await db.from('loyalty_customers').delete().eq('id', customerId);
    console.error('Order save failed', error);
    return reply({ error: 'Could not save order' }, 500, origin);
  }
}

async function handleReset(body: Record<string, unknown>, origin: string) {
  const phone = normalizedPhone(body.phone);
  if (!phone) return reply({ error: 'Enter a valid phone number' }, 400, origin);
  const db = database();
  const code = newCode();
  const { data, error } = await db.from('loyalty_customers')
    .update({ access_hash: await codeHash(phone, code) }).eq('phone', phone).select('id').maybeSingle();
  if (error) throw error;
  if (!data) return reply({ error: 'Customer not found' }, 404, origin);
  return reply({ accessCode: code }, 200, origin);
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const allowed = !origin || allowedOrigin(origin);
  if (req.method === 'OPTIONS') {
    if (!allowed) return reply({ error: 'Origin not allowed' }, 403);
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
        'Vary': 'Origin'
      }
    });
  }
  if (!allowed) return reply({ error: 'Origin not allowed' }, 403);
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  if (Number(req.headers.get('content-length')) > 7 * 1024 * 1024) {
    return reply({ error: 'Request too large' }, 413, origin);
  }
  try {
    const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
    const body = multipart ? await req.formData() : await req.json();
    const action = multipart ? String(body.get('action') || '') : String(body.action || '');
    if (action === 'adminLogin' && !multipart) return await handleLogin(req, body, origin);
    if (action === 'lookup' && !multipart) return await handleLookup(req, body, origin);
    if (!await validSession(req)) return reply({ error: 'Sign-in required' }, 401, origin);
    if (action === 'listOrders' && !multipart) return await handleRecent(origin);
    if (action === 'createOrder' && multipart) return await handleCreate(body, origin);
    if (action === 'resetCode' && !multipart) return await handleReset(body, origin);
    return reply({ error: 'Unknown request' }, 400, origin);
  } catch (error) {
    console.error('Loyalty request failed', error);
    return reply({ error: 'Service unavailable' }, 500, origin);
  }
});
