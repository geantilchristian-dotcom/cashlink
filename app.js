/**
 * ==========================================================================
 * CASH LINK - CORE ENGINE v18.0 (ACCÈS RAPIDE ADMIN)
 * SÉCURITÉ ADMIN : DÉSACTIVÉE TEMPORAIREMENT
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'cashlink_secret_key_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

/* --- DONNÉES DU SYSTÈME --- */
let siteContent = {
    brand_name: "CASH LINK",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    about_text: "Leader du minage en RDC.",
    rules_text: "1. Retrait 24h/72h. 2. Parrainage 10%."
};

let users = [
    { id: "ADMIN_1", username: "Admin", password: "999", role: "ADMIN", phone: "000" }
];

let pendingTID = [];      
let withdrawalQueue = []; 

/* --- MIDDLEWARES --- */

// Middleware Client (Toujours actif pour la sécurité des utilisateurs)
const isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role === "USER") return next();
    res.redirect('/');
};

/* --- ROUTES AUTHENTIFICATION --- */

app.get('/', (req, res) => {
    res.render('login'); 
});

app.post('/register', (req, res) => {
    const { username, phone, password, ref } = req.body;
    const newUser = {
        id: "U" + Date.now(),
        username, phone, password,
        solde: 0, bonus: 0, pack: "Aucun",
        referredBy: ref || null,
        role: "USER", investDate: null
    };
    users.push(newUser);
    req.session.user = newUser;
    res.redirect('/dashboard');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user;
        return res.redirect(user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.send("Erreur de connexion.");
});

/* --- ESPACE CLIENT --- */

app.get('/dashboard', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    // Calcul de progression simplifié pour le test
    res.render('dashboard', { user, content: siteContent, p: 45, msRemaining: 500000 });
});

app.post('/souscrire-pack', isClient, (req, res) => {
    pendingTID.push({ 
        id: Date.now(), 
        username: req.session.user.username, 
        pack: req.body.packName, 
        montant: parseInt(req.body.prix), 
        tid: req.body.reference 
    });
    res.redirect('/dashboard?msg=TID_OK');
});

/* ==========================================================================
   SECTION ADMIN : PORTE OUVERTE (LOGIN DÉSACTIVÉ)
   ========================================================================== */

// Tu peux entrer ici directement sans te connecter
app.get('/admin', (req, res) => {
    const stats = {
        totalUsers: users.filter(u => u.role === "USER").length,
        enAttente: pendingTID.length,
        soldeGlobal: users.reduce((acc, u) => acc + (u.solde || 0), 0)
    };
    // On passe les données à la vue admin.ejs
    res.render('admin', { 
        stats, 
        transactions: pendingTID, 
        retraits: withdrawalQueue, 
        users: users.filter(u => u.role === "USER"), 
        site: siteContent 
    });
});

// Approbation des paiements + Bonus Parrainage 10%
app.post('/admin/approve-tx', (req, res) => {
    const tx = pendingTID.find(t => t.id == req.body.txId);
    if (tx) {
        const u = users.find(user => user.username === tx.username);
        u.pack = tx.pack;
        u.solde += tx.montant;
        u.investDate = new Date();
        
        // Bonus parrainage 10% auto
        if (u.referredBy) {
            const parrain = users.find(p => p.id === u.referredBy);
            if (parrain) parrain.bonus += (tx.montant * 0.10);
        }
        pendingTID = pendingTID.filter(t => t.id != req.body.txId);
    }
    res.redirect('/admin');
});

// Modification du contenu (Voda, Airtel, Orange, etc.)
app.post('/admin/update-content', (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin');
});

/* ========================================================================== */

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => console.log("TERMINAL CASHLINK : PORT 3000 | ADMIN LIBRE"));
