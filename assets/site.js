const phone = '919444464674';
const products = {
  Stories: ['The Marriage Magazine', 'The Love Journal', 'Anniversary Edition', 'Personalized Memory Magazine', 'I am not sure yet'],
  Prints: ['Mini Polaroid Prints', 'Classic Polaroid Prints', 'Large Photo Prints', 'Personalized Memory Album', 'I am not sure yet']
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
  const values = products[collectionSelect.value];
  productSelect.replaceChildren();
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
document.querySelectorAll('[data-select-collection]').forEach(link => link.addEventListener('click', () => {
  collectionSelect.value = link.dataset.selectCollection;
  updateProducts();
}));

document.querySelector('#enquiry-form')?.addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const form = new FormData(event.currentTarget);
  const lines = [
    'Hello URAVAI! 🤍 I would love to create a keepsake.',
    '',
    `Collection: URAVAI ${form.get('collection')}`,
    `Keepsake: ${form.get('product')}`
  ];
  const occasion = String(form.get('occasion') || '').trim();
  const note = String(form.get('message') || '').trim();
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
