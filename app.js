const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const util = require('util');

// --- 🛠 CORRECTIF DE COMPATIBILITÉ (Node.js v25+) ---
if (typeof util.isDate !== 'function') {
    util.isDate = (obj) => Object.prototype.toString.call(obj) === '[object Date]';
}
if (typeof util.isArray !== 'function') {
    util.isArray = Array.isArray;
}

const app = express();

// --- 1. BASES DE DONNÉES ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = {
    users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbDir, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbDir, 'config.db'), autoload: true })
};

// Optimisation pour les gros volumes de données
db.users.persistence.setAutocompactionInterval(60000); 

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'loma_tombola_ultra_secure_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Session de 24h
}));

// --- 3. ROUTES CLIENTS ---

// Accueil & Login
app.get('/', (req, res) => res.render('login', { msg: req.query.msg || null }));

// Inscription
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const phone = req.body.phone ? req.body.phone.trim() : "";

    db.users.findOne({ phone }, (err, exists) => {
        if (exists) return res.redirect('/?msg=Numéro déjà utilisé');
        
        const newUser = { 
            username, phone, password, 
            solde: 0, bonus: 0, pack: "Aucun", 
            certified: false, investDate: null, 
            createdAt: new Date().toISOString() 
        };

        db.users.insert(newUser, (err) => {
            if (err) return res.redirect('/?msg=Erreur serveur');
            db.users.persistence.compactDatafile(); // Sauvegarde forcée
            res.redirect('/?msg=Inscription réussie ! Connectez-vous.');
        });
    });
});

// Connexion
app.post('/login', (req, res) => {
    const phone = req.body.phone ? req.body.phone.trim() : "";
    const password = req.body.password;

    db.users.loadDatabase(() => {
        db.users.findOne({ phone, password }, (err, user) => {
            if (user) {
                req.session.userId = user._id;
                res.redirect('/dashboard');
            } else {
                res.redirect('/?msg=Identifiants incorrects');
            }
        });
    });
});

// Dashboard (Interface Client)
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        db.config.findOne({ type: 'content' }, (errC, content) => {
            if (!user) return res.redirect('/');

            // Calcul progression (p)
            let p = 0;
            if (user.investDate) {
                let diff = (new Date() - new Date(user.investDate)) / 86400000;
                p = Math.min((diff / 30) * 100, 100);
            }

            res.render('dashboard', { 
                user, 
                content: content || { brand_name: "LOMA TOMBOLA", admin_voda: "0894407183" }, 
                p: p.toFixed(0), 
                msg: req.query.msg || null 
            });
        });
    });
});

// --- 4. ROUTES ACTIONS (Dépôt / Retrait) ---

app.post('/valider-depot', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const { amount, reseau, transaction_id } = req.body;

    const newTx = {
        userId: req.session.userId,
        type: 'Dépôt',
        montant: Number(amount),
        reseau,
        transaction_id,
        statut: 'En attente',
        createdAt: new Date().toISOString()
    };

    db.tx.insert(newTx, () => res.redirect('/dashboard?msg=Dépôt en attente de validation'));
});

app.post('/valider-retrait', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const { amount, phone, reseau } = req.body;

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (user.solde < Number(amount)) return res.redirect('/dashboard?msg=Solde insuffisant');

        const newTx = {
            userId: req.session.userId,
            type: 'Retrait',
            montant: Number(amount),
            phone,
            reseau,
            statut: 'En attente',
            createdAt: new Date().toISOString()
        };

        db.tx.insert(newTx, () => res.redirect('/dashboard?msg=Demande de retrait envoyée'));
    });
});

// --- 5. ROUTES ADMIN ---

app.get('/admin/login', (req, res) => res.render('admin_login', { msg: req.query.msg || null, content: {} }));

app.post('/admin/login', (req, res) => {
    if (req.body.admin_user === "ADMIN" && req.body.admin_pass === "MASTER2026") {
        req.session.adminAuth = true;
        res.redirect('/admin');
    } else res.redirect('/admin/login?msg=Refusé');
});

app.get('/admin', (req, res) => {
    if (!req.session.adminAuth) return res.redirect('/admin/login');

    db.users.find({}, (errU, users) => {
        db.tx.find({}).sort({ createdAt: -1 }).exec((errT, txs) => {
            const u = users || [];
            const t = txs || [];
            
            // Stats sécurisées (évite toLocaleString error)
            const stats = {
                totalUsers: u.length,
                soldeTotalUsers: u.reduce((a, b) => a + (Number(b.solde) || 0), 0) || 0,
                enAttente: t.filter(x => x.statut === 'En attente').length,
                packsToday: 0, packsMonth: 0, packsYear: 0, totalGagne: 0, usersToday: 0
            };

            res.render('admin', { users: u, transactions: t, stats, content: {}, messages: [] });
        });
    });
});

// --- 6. UTILITAIRES ---
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// Route Secrète pour générer les 100k membres sur le vrai serveur
app.get('/admin/setup-production', (req, res) => {
    if (!req.session.adminAuth) return res.send("Interdit");
    // Logique de génération massive ici...
    res.send("Générateur prêt.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SERVEUR LOMA PRÊT POUR PROD SUR PORT ${PORT}`));