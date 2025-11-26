// Simple script just to confirm JS is loaded and provide small UX touches
document.addEventListener('DOMContentLoaded', () => {
  const flash = document.querySelector('[data-flash]');
  if (flash) {
    setTimeout(() => {
      flash.style.display = 'none';
    }, 4000);
  }
});
