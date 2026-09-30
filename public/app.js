document.addEventListener('DOMContentLoaded', () => {
  // 1. SELECTORES DE ELEMENTOS
  const authForm = document.querySelector('form') || document.getElementById('login-form');
  const googleBtn = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.toLowerCase().includes('google')
  ) || document.getElementById('google-btn');

  // 2. CONTROL DE INICIO DE SESIÓN (ENTRAR EN NORA)
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = authForm.querySelector('input[type="email"]');
      const passwordInput = authForm.querySelector('input[type="password"]');
      const submitBtn = authForm.querySelector('button[type="submit"]');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        alert('Por favor, introduzca su correo y contraseña.');
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

        if (res.ok) {
          // Recargar la ventana para actualizar la sesión y cargar el Dashboard
          window.location.reload();
        } else {
          alert(data.error || 'Credenciales no válidas. Compruebe usuario y contraseña.');
        }
      } catch (err) {
        console.error('Error durante la autenticación:', err);
        alert('Error de conexión con el servidor.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || 'Entrar en Nora →';
        }
      }
    });
  }

  // 3. BOTÓN CONTINUAR CON GOOGLE
  if (googleBtn) {
    googleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/auth/google');
        const data = await res.json();
        
        if (data.error) {
          alert(data.error);
        } else {
          window.location.href = '/api/auth/google';
        }
      } catch (err) {
        console.error('Error al conectar con Google:', err);
        alert('No se pudo iniciar la autenticación con Google.');
      }
    });
  }

  // 4. VERIFICACIÓN Y CARGA DE SESIÓN
  checkSession();
});

// Comprobar estado de autenticación al cargar la página
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        loadDashboard(data.user);
      }
    }
  } catch (err) {
    console.error('Error comprobando sesión activa:', err);
  }
}

// Cargar panel empresarial tras iniciar sesión
async function loadDashboard(user) {
  try {
    const res = await fetch('/api/business/dashboard');
    if (res.ok) {
      const dashboardData = await res.json();
      console.log('Datos de Nora Business cargados:', dashboardData);
      
      // Si la SPA oculta o muestra contenedores principales:
      const authSection = document.getElementById('auth-section') || document.querySelector('.auth-container');
      const appSection = document.getElementById('app-section') || document.querySelector('.app-container');

      if (authSection) authSection.style.display = 'none';
      if (appSection) appSection.style.display = 'block';
    }
  } catch (err) {
    console.error('Error al cargar datos del workspace:', err);
  }
}