const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');

async function checkExistingSession() {
  try {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
    if (res.ok) window.location.href = '/admin.html';
  } catch (_) {}
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = 'Signing in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    window.location.href = '/admin.html';
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Sign in';
  }
});

checkExistingSession();
