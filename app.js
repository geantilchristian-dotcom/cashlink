const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');

const app = express();

// 1. CONFIGURATION DES DOSSIERS (Anglais obligatoire pour le code)
const db = {
    users: new Datastore({ filename: path.join(__dirname, 'database', 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(__dirname, 'database', 'tx.db'), autoload: true })
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'cashlink_secret_key',
    resave: false,
    saveUninitialized: true
}));

// 2. ROUTES CLIENTS
app.get('/', (req, res) => res.render('login', { msg: req.query.msg || null }));

app.post('/register', (req, res) => {
    const { username, phone, password } = req.body;
    db.users.findOne({ phone }, (err, user) => {
        if (user) return res.redirect('/?msg=Numéro déjà utilisé');
        db.users.insert({ username, phone, password, solde: 0 }, () => {
            res.redirect('/?msg=Inscription réussie ! Connectez-vous.');
        });
    });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    db.users.findOne({ phone, password }, (err, user) => {
        if (user) {
            req.session.userId = user._id;
            res.redirect('/dashboard');
        } else {
            res.redirect('/?msg=Identifiants incorrects');
        }
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        // Attention : vérifie que ton fichier s'appelle dashboard.ejs ou tableau de bord.ejs
        res.render('dashboard', { user, content: { brand_name: "CASHLINK" } });
    });
});

// 3. ROUTES ADMIN
app.get('/admin/login', (req, res) => res.render('admin_login', { msg: null }));

app.post('/admin/login', (req, res) => {
    if (req.body.admin_user === "ADMIN" && req.body.admin_pass === "MASTER2026") {
        req.session.adminAuth = true;
        res.redirect('/admin');
    } else {
        res.redirect('/admin/login?msg=Erreur');
    }
});

app.get('/admin', (req, res) => {
    if (!req.session.adminAuth) return res.redirect('/admin/login');
    db.users.find({}, (err, users) => {
        res.render('admin', { users, stats: { totalUsers: users.length } });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur CashLink actif sur le port ${PORT}`));
