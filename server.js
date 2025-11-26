const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory "database" (for demo only)
const users = []; // {id, name, email, password, role}
const patients = []; // {id, userId, fullName, phone, address, reason, status}
const announcements = []; // {id, title, content, createdAt}

// Seed default admin
users.push({
  id: 1,
  name: 'Site Administrator',
  email: 'admin@newhope.com',
  password: 'admin123',
  role: 'admin'
});

let nextUserId = 2;
let nextPatientId = 1;
let nextAnnouncementId = 1;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'change_this_secret_in_production',
    resave: false,
    saveUninitialized: false
  })
);

// Middleware to expose user to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}

function renderPage(res, view, params = {}) {
  res.render('layout', { view, ...params });
}

// Public pages
app.get('/', (req, res) => {
  renderPage(res, 'index', { announcements });
});

app.get('/about', (req, res) => {
  renderPage(res, 'about');
});

app.get('/services', (req, res) => {
  renderPage(res, 'services');
});

app.get('/contact', (req, res) => {
  renderPage(res, 'contact');
});

// Authentication
app.get('/register', (req, res) => {
  renderPage(res, 'register', { error: null });
});

app.post('/register', (req, res) => {
  const { name, email, password, phone, address, reason } = req.body;

  if (!name || !email || !password) {
    return renderPage(res, 'register', { error: 'Name, email and password are required.' });
  }

  const existing = users.find(u => u.email === email);
  if (existing) {
    return renderPage(res, 'register', { error: 'An account with this email already exists.' });
  }

  const user = {
    id: nextUserId++,
    name,
    email,
    password, // NOTE: For real apps, hash passwords!
    role: 'patient'
  };
  users.push(user);

  const patient = {
    id: nextPatientId++,
    userId: user.id,
    fullName: name,
    phone,
    address,
    reason,
    status: 'Pending admission'
  };
  patients.push(patient);

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.redirect('/patient/dashboard');
});

app.get('/login', (req, res) => {
  renderPage(res, 'login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return renderPage(res, 'login', { error: 'Invalid credentials.' });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  if (user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/patient/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Patient dashboard
app.get('/patient/dashboard', requireLogin, requireRole('patient'), (req, res) => {
  const patient = patients.find(p => p.userId === req.session.user.id);
  renderPage(res, 'patient-dashboard', { patient, announcements });
});

// Admin dashboard
app.get('/admin/dashboard', requireLogin, requireRole('admin'), (req, res) => {
  renderPage(res, 'admin-dashboard', { patients, announcements });
});

// Admin: manage announcements
app.post('/admin/announcements', requireLogin, requireRole('admin'), (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.redirect('/admin/dashboard');
  }
  announcements.unshift({
    id: nextAnnouncementId++,
    title,
    content,
    createdAt: new Date()
  });
  res.redirect('/admin/dashboard');
});

app.post('/admin/announcements/:id/delete', requireLogin, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = announcements.findIndex(a => a.id === id);
  if (index !== -1) {
    announcements.splice(index, 1);
  }
  res.redirect('/admin/dashboard');
});

// Admin: manage patients
app.post('/admin/patients/:id/status', requireLogin, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  const patient = patients.find(p => p.id === id);
  if (patient && status) {
    patient.status = status;
  }
  res.redirect('/admin/dashboard');
});

app.post('/admin/patients/:id/delete', requireLogin, requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = patients.findIndex(p => p.id === id);
  if (index !== -1) {
    const patient = patients[index];
    // also remove user account
    const userIndex = users.findIndex(u => u.id === patient.userId);
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
    }
    patients.splice(index, 1);
  }
  res.redirect('/admin/dashboard');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
