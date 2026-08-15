document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');

  menuToggle?.addEventListener('click', () => {
    nav?.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', nav?.classList.contains('open') ? 'true' : 'false');
  });

  document.querySelectorAll('.nav-item.has-dropdown > .nav-link').forEach(link => {
    link.addEventListener('click', event => {
      if (window.innerWidth <= 820) {
        event.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('[data-category]').forEach(card => {
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });
});
