document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const showLoginBtn = document.getElementById('showLogin');
  const showRegisterBtn = document.getElementById('showRegister');
  const authMessage = document.getElementById('authMessage');
  const googleBtn = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent && btn.textContent.toLowerCase().includes('google')
  ) || document.getElementById('googleLoginBtn');

  const setAuthView = (view) => {
    const isLoginView = view === 'login';
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');

    if (showLoginBtn) showLoginBtn.classList.toggle('active', isLoginView);
    if (showRegisterBtn) showRegisterBtn.classList.toggle('active', !isLoginView);
    if (loginForm) loginForm.classList.toggle('hidden', !isLoginView);
    if (signupForm) signupForm.classList.toggle('hidden', isLoginView);

    if (authTitle) {
      authTitle.textContent = isLoginView ? 'Bienvenido de nuevo' : 'Cree su espacio empresarial';
    }

    if (authSubtitle) {
      authSubtitle.textContent = isLoginView
        ? 'Acceda al espacio inteligente de su empresa.'
        : 'Configure su empresa y empiece a trabajar con Nora.';
    }

    if (authMessage) authMessage.textContent = '';
  };

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (event) => {
      event.preventDefault();
      setAuthView('login');
    });
  }

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', (event) => {
      event.preventDefault();
      setAuthView('register');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('loginEmail')?.value.trim() || '';
      const password = document.getElementById('loginPassword')?.value || '';
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        setAuthMessage('Introduzca su correo y contraseña.', true);
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = 'Autenticando...';
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Credenciales no válidas.');
        }

        await loadDashboard(data.user || {});
      } catch (error) {
        console.error('Error de autenticación:', error);
        setAuthMessage(error.message || 'No se pudo iniciar sesión.', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || 'Entrar en Nora →';
        }
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const name = document.getElementById('signupName')?.value.trim() || '';
      const companyName = document.getElementById('signupCompanyName')?.value.trim() || '';
      const email = document.getElementById('signupEmail')?.value.trim() || '';
      const password = document.getElementById('signupPassword')?.value || '';
      const consent = document.getElementById('privacyConsent');
      const submitBtn = signupForm.querySelector('button[type="submit"]');

      if (!name || !companyName || !email || !password) {
        setAuthMessage('Complete nombre, empresa, correo y contraseña para crear la cuenta.', true);
        return;
      }

      if (!consent?.checked) {
        setAuthMessage('Debe aceptar la política de privacidad y los términos.', true);
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = 'Creando cuenta...';
        }

        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, companyName, email, password, consentAccepted: true })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo crear la cuenta.');
        }

        await loadDashboard(data.user || {});
      } catch (error) {
        console.error('Error al crear la cuenta:', error);
        setAuthMessage(error.message || 'No se pudo crear la cuenta.', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || 'Crear espacio empresarial →';
        }
      }
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const res = await fetch('/api/auth/google');
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        window.location.href = '/api/auth/google';
      } catch (error) {
        console.error('Error al conectar con Google:', error);
        setAuthMessage(error.message || 'No se pudo iniciar la autenticación con Google.', true);
      }
    });
  }

  setAuthView('login');
  checkSession();
});

function setAuthMessage(message, isError = false) {
  const authMessage = document.getElementById('authMessage');
  if (!authMessage) return;
  authMessage.textContent = message || '';
  authMessage.classList.toggle('error', Boolean(isError));
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;

    const data = await res.json();
    if (data.user) {
      await loadDashboard(data.user);
    }
  } catch (error) {
    console.error('Error comprobando sesión activa:', error);
  }
}

async function loadDashboard(user) {
  try {
    const res = await fetch('/api/business/dashboard');
    if (!res.ok) {
      throw new Error('No se pudo cargar el panel empresarial.');
    }

    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');

    const dashboardData = await res.json();
    const companyNameValue = dashboardData.companyName || user.companyName || 'Mi empresa';
    const companyNameSide = document.getElementById('companyNameSide');
    const companyNameHero = document.getElementById('companyNameHero');
    const companySectorSide = document.getElementById('companySectorSide');

    if (companyNameSide) companyNameSide.textContent = companyNameValue;
    if (companyNameHero) companyNameHero.textContent = companyNameValue;
    if (companySectorSide) companySectorSide.textContent = dashboardData.companySector || 'Servicios profesionales';

    const userNameValue = user.name || user.email || 'Usuario';
    const userNameTop = document.getElementById('userNameTop');
    const userAvatar = document.getElementById('userAvatar');

    if (userNameTop) userNameTop.textContent = userNameValue;
    if (userAvatar) userAvatar.textContent = userNameValue.trim().charAt(0).toUpperCase();

    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');

    window.dispatchEvent(new CustomEvent('nora:dashboard-loaded', {
      detail: { user, dashboard: dashboardData }
    }));

    console.log('Datos de Nora Business cargados:', dashboardData);
  } catch (error) {
    console.error('Error al cargar datos del workspace:', error);
    if (user && !!user.email) {
      setAuthMessage('La sesión está lista, pero el panel aún no pudo cargarse.', true);
    }
  }
}