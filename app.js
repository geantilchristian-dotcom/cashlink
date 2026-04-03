/**
 * ==========================================================================
 * CASH LINK GLOBAL - CORE ENGINE v10.0 
 * DÉVELOPPÉ POUR : ANASH MASTER (RDC 2026)
 * SÉCURITÉ : ISOLEMENT ADMIN / CLIENTS / PARRAINAGE 10%
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// --- CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- SESSIONS PERSISTANTES (7 JOURS) ---
app.use(session({
    secret: 'titan_rdc_ultra_secret_2026_master',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

/* ==========================================================================
   BASE DE DONNÉES & CONFIGURATION
   ========================================================================== */

let siteContent = {
    brand_name: "CASH LINK",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    about_text: "CashLink est le leader du minage numérique décentralisé en RDC.",
    rules_text: "1. Un seul pack par personne.\n2. Parrainage : 10% de commission.\n3. Retrait 3j (Standard) / 24h (Elite)."
};

let users = [
    { id: "ADMIN_MASTER", username: "Admin", password: "999", role: "ADMIN", phone: "000000000" }
];

let pendingTID = [];      
let withdrawalQueue = []; 

/* ==========================================================================
   MIDDLEWARES & LOGIQUE TECHNIQUE
   ========================================================================== */

const isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role === "USER") return next();
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === "ADMIN") return next();
    res.status(403).send("ACCÈS REFUSÉ.");
};

function getRemainingMs(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const nextCredit = new Date(user.investDate).getTime() + (24 * 60 * 60 * 1000);
    const diff = nextCredit - new Date().getTime();
    return diff > 0 ? diff : 0;
}

function getProgress(user) {
    const ms = getRemainingMs(user);
    if (ms === 0 && user.pack !== "Aucun") return 100;
    if (user.pack === "Aucun") return 0;
    return Math.floor(((24 * 60 * 60 * 1000 - ms) / (24 * 60 * 60 * 1000)) * 100);
}

/* ==========================================================================
   ROUTES AUTHENTIFICATION
   ========================================================================== */

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect(req.session.user.role === "ADMIN" ? '/admin' : '/dashboard');
    res.render('login'); 
});

app.get('/master-portal-2026', (req, res) => {
    res.render('admin-login'); 
});

app.post('/register', (req, res) => {
    const { username, phone, password, q_naissance, q_pere, ref } = req.body;
    if (!/^[0-9]{9}$/.test(phone)) return res.send("9 chiffres requis.");
    
    const newUser = {
        id: "U" + Date.now(),
        username, phone, password,
        q_naissance: q_naissance.toLowerCase().trim(),
        q_pere: q_pere.toLowerCase().trim(),
        solde: 0, bonus: 0, pack: "Aucun", certified: false,
        investDate: null, lastWithdrawal: null,
        referredBy: ref || null,
        role: "USER"
    };
    users.push(newUser);
    req.session.user = newUser;
    res.redirect('/dashboard?welcome=true');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user;
        return res.redirect(user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.send("Identifiants incorrects.");
});

/* ==========================================================================
   ROUTES CLIENT & ADMIN
   ========================================================================== */

app.get('/dashboard', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    res.render('dashboard', { user, content: siteContent, p: getProgress(user), msRemaining: getRemainingMs(user) });
});

app.post('/souscrire-pack', isClient, (req, res) => {
    pendingTID.push({ id: Date.now(), username: req.session.user.username, pack: req.body.packName, montant: parseInt(req.body.prix), tid: req.body.reference, date: new Date().toLocaleString() });
    res.redirect('/dashboard?msg=TID_SEND');
});

app.post('/admin/approve-tx', isAdmin, (req, res) => {
    const tx = pendingTID.find(t => t.id == req.body.txId);
    if (tx) {
        const u = users.find(user => user.username === tx.username);
        if (tx.pack === "CERTIFICATION") { u.certified = true; } 
        else {
            u.pack = tx.pack; u.solde += tx.montant; u.investDate = new Date();
            const bMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            u.bonus += bMap[tx.pack] || 0;
            // PARRAINAGE 10%
            if (u.referredBy) {
                const parrain = users.find(p => p.id === u.referredBy);
                if (parrain) parrain.bonus += (tx.montant * 0.10);
            }
        }
        pendingTID = pendingTID.filter(t => t.id != req.body.txId);
    }
    res.redirect('/admin');
});

// CRON GAINS 24H
setInterval(() => {
    users.forEach(u => {
        if (u.pack !== "Aucun" && u.investDate) {
            if ((new Date() - new Date(u.investDate)) >= (24 * 60 * 60 * 1000)) {
                const g = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                u.bonus += g[u.pack]; u.investDate = new Date();
            }
        }
    });
}, 1000 * 60 * 30);

app.listen(3000, () => console.log("CASH LINK v10.0 DEMARRÉ SUR PORT 3000"));
