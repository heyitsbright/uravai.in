const phone = '919444464674';
const products = {
  Stories: ['The Marriage Magazine', 'The Love Journal', 'Anniversary Edition', 'Personalized Memory Magazine', 'I am not sure yet'],
  Prints: ['Mini Polaroid Print — 2 × 3 in (₹20 each)', 'Small Polaroid Print — 2.5 × 3.5 in (₹25 each)', 'Standard Polaroid Print — 3 × 4 in (₹30 each)', 'Large Polaroid Print — 4 × 5 in (₹35 each)', 'Personalized Memory Album', 'I am not sure yet']
};
const messages = {
  general: 'Hello URAVAI! 🤍 I would love to know more about your personalized keepsakes.',
  stories: 'Hello URAVAI! 🤍 I am interested in creating a personalized magazine. Could you share the available options and pricing?',
  prints: 'Hello URAVAI! 🤍 I would like to order Polaroid prints. Please share the available sizes, packages, and prices.',
  share: 'Hello URAVAI! 🤍 I purchased a keepsake and would like to share a photograph of my URAVAI moment. Please tell me how it may be featured.',
  review: 'Hello URAVAI! 🤍 I would like to share my experience with my keepsake.'
};
const whatsappUrl = message => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

document.querySelectorAll('[data-whatsapp]').forEach(link => {
  const message = messages[link.dataset.whatsapp] || messages.general;
  link.href = whatsappUrl(message);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});

const printSizes = {
  1: {name: 'Mini', inches: '2 × 3 in', price: 20},
  2: {name: 'Small', inches: '2.5 × 3.5 in', price: 25},
  3: {name: 'Standard', inches: '3 × 4 in', price: 30},
  4: {name: 'Large', inches: '4 × 5 in', price: 35}
};
document.querySelectorAll('[data-print-size]').forEach(link => {
  const size = Number(link.dataset.printSize);
  const print = printSizes[size];
  if (!print) return;
  const message = `Hello URAVAI! 🤍 I would like to order ${print.name} Polaroid-style prints (${print.inches}) at ₹${print.price} each. Please help me confirm the quantity and delivery address.`;
  link.href = whatsappUrl(message);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
  mobileNav.hidden = expanded;
});
mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileNav.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
}));

const collectionSelect = document.querySelector('#collection');
const productSelect = document.querySelector('#product');
function updateProducts() {
  if (!collectionSelect || !productSelect) return;
  const values = products[collectionSelect.value];
  productSelect.replaceChildren();
  productSelect.setCustomValidity('');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = values ? 'Choose a keepsake' : 'Select a collection first';
  productSelect.append(placeholder);
  if (values) {
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      productSelect.append(option);
    });
  }
  productSelect.disabled = !values;
}
collectionSelect?.addEventListener('change', updateProducts);
productSelect?.addEventListener('change', () => productSelect.setCustomValidity(''));
document.querySelectorAll('[data-select-collection]').forEach(link => link.addEventListener('click', () => {
  if (!collectionSelect || !productSelect) return;
  collectionSelect.value = link.dataset.selectCollection;
  updateProducts();
}));

document.querySelector('#enquiry-form')?.addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const form = new FormData(event.currentTarget);
  const collection = String(form.get('collection') || '');
  const product = String(form.get('product') || '');
  if (!products[collection]?.includes(product)) {
    productSelect.setCustomValidity('Choose a keepsake from the selected collection.');
    productSelect.reportValidity();
    return;
  }
  const cleanText = (value, limit) => String(value || '').trim()
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, limit);
  const lines = [
    'Hello URAVAI! 🤍 I would love to create a keepsake.',
    '',
    `Collection: URAVAI ${collection}`,
    `Keepsake: ${product}`
  ];
  const occasion = cleanText(form.get('occasion'), 80);
  const note = cleanText(form.get('message'), 400);
  if (occasion) lines.push(`Occasion: ${occasion}`);
  if (note) lines.push(`My idea: ${note}`);
  lines.push('', 'Could you share the available options, pricing, and next steps?');
  window.location.href = whatsappUrl(lines.join('\n'));
});

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: 0.08, rootMargin: '0px 0px 40px 0px'});
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
}
