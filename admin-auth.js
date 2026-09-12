(async function () {
  try {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = '/admin-login.html';
      return;
    }
  } catch (_) {
    window.location.href = '/admin-login.html';
    return;
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      window.location.href = '/admin-login.html';
    });
  }
})();
