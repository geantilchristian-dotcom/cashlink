/**
 * ==========================================================================
 * CASHLINK GLOBAL CORE v18.0 - CONFIGURATION INDUSTRIELLE
 * DÉVELOPPÉ POUR : ANASH MASTER (RDC 2026)
 * FONCTIONS : PARRAINAGE 10%, MINAGE 24H, ACCÈS ADMIN DIRECT
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// --- CONFIGURATION SYSTÈME ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- GESTION DES SESSIONS (7 JOURS) ---
app.use(session({
    secret: 'cashlink_titan_ultra_secret_2026_anash_master',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

/* ==========================================================================
   SECTION 1 : BASE DE DONNÉES ET CONFIGURATION ÉDITABLE
   ========================================================================== */

let siteContent = {
    brand_name: "CASH LINK",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    puissance_hash: "104.2 TH/s",
    about_text: "CashLink est le leader du minage numérique décentralisé en RDC.",
    rules_text: "1. Un seul pack par utilisateur. 2. Parrainage 10% cash. 3. Retraits 1.000 FC min."
};

// Stockage en mémoire (Redémarre à vide si le serveur coupe)
let users = [];
let pendingTID = [];
let withdrawalQueue = [];

/* ==========================================================================
   SECTION 2 : LOGIQUE DE CALCULS (MINAGE & TEMPS)
   ========================================================================== */

/**
 * Calcule les millisecondes restantes avant le prochain gain de 24h
 */
function getRemainingMs(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const nextCredit = new Date(user.investDate).getTime() + (24 * 60 * 60 * 1000);
    const diff = nextCredit - new Date().getTime();
    return diff > 0 ? diff : 0;
}

/**
 * Calcule le pourcentage de progression (0-100%)
 */
function getProgress(user) {
    const ms = getRemainingMs(user);
    if (user.pack === "Aucun") return 0;
    if (ms === 0) return 100;
    const total = 24 * 60 * 60 * 1000;
    return Math.floor(((total - ms) / total) * 100);
}

/* ==========================================================================
   SECTION 3 : ROUTES CLIENTS (DASHBOARD & ACTIONS)
   ========================================================================== */

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login'); 
});

// Inscription avec gestion du parrain (ID du parrain passé en URL ?ref=...)
app.post('/register', (req, res) => {
    const { username, phone, password, ref } = req.body;
    
    const newUser = {
        id: "U" + Date.now(),
        username, phone, password,
        solde: 0, bonus: 0, pack: "Aucun",
        referredBy: ref || null, // Capture du parrain
        investDate: null,
        role: "USER"
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
        return res.redirect('/dashboard');
    }
    res.send("<script>alert('Échec'); window.history.back();</script>");
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const user = users.find(u => u.id === req.session.user.id);
    
    res.render('dashboard', { 
        user, 
        content: siteContent, 
        p: getProgress(user), 
        msRemaining: getRemainingMs(user) 
    });
});

// Envoi du TID pour achat de pack
app.post('/souscrire-pack', (req, res) => {
    if (!req.session.user) return res.sendStatus(403);
    
    pendingTID.push({
        id: Date.now(),
        username: req.session.user.username,
        phone: req.session.user.phone,
        pack: req.body.packName,
        montant: parseInt(req.body.prix),
        tid: req.body.reference,
        date: new Date().toLocaleString()
    });
    res.redirect('/dashboard?msg=TID_SENT');
});

// Demande de retrait
app.post('/retrait', (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const m = parseInt(req.body.montant);

    if (user.bonus >= m && m >= 1000) {
        user.bonus -= m;
        withdrawalQueue.push({ id: Date.now(), username: user.username, phone: user.phone, montant: m });
        res.redirect('/dashboard?msg=RETRAIT_OK');
    } else {
        res.send("Solde insuffisant ou montant trop bas.");
    }
});

/* ==========================================================================
   SECTION 4 : PANNEAU ADMIN (LIGNE DIRECTE - SÉCURITÉ PASSÉE)
   ========================================================================== */

// Accès direct sans vérification de session pour tes tests
app.get('/admin', (req, res) => {
    const stats = {
        totalUsers: users.length,
        enAttente: pendingTID.length,
        soldeGlobal: users.reduce((acc, u) => acc + (u.solde || 0), 0)
    };
    
    res.render('admin', { 
        stats, 
        transactions: pendingTID, 
        retraits: withdrawalQueue, 
        users: users, 
        site: siteContent 
    });
});

/**
 * APPROBATION ADMIN : Fait communiquer les comptes et calcule le parrainage
 */
app.post('/admin/approve-tx', (req, res) => {
    const tx = pendingTID.find(t => t.id == req.body.txId);
    
    if (tx) {
        const user = users.find(u => u.username === tx.username);
        user.pack = tx.pack;
        user.solde += tx.montant;
        user.investDate = new Date(); // Démarre le cycle de 24h
        
        // 1. Bonus d'activation client
        const bonuses = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
        user.bonus += bonuses[tx.pack] || 0;

        // 2. LOGIQUE PARRAINAGE 10% (Communication entre comptes)
        if (user.referredBy) {
            const parrain = users.find(p => p.id === user.referredBy);
            if (parrain) {
                const commission = tx.montant * 0.10;
                parrain.bonus += commission;
                console.log(`[REF] ${commission} FC versés au parrain ${parrain.username}`);
            }
        }

        // Nettoyage de la file d'attente
        pendingTID = pendingTID.filter(t => t.id != req.body.txId);
    }
    res.redirect('/admin');
});

// Mise à jour des numéros de téléphone Admin
app.post('/admin/update-content', (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin');
});

/* ==========================================================================
   SECTION 5 : MOTEUR AUTOMATIQUE (CRON)
   ========================================================================== */

// Vérifie les gains toutes les 30 minutes
setInterval(() => {
    users.forEach(u => {
        if (u.pack !== "Aucun" && u.investDate) {
            const now = new Date().getTime();
            const last = new Date(u.investDate).getTime();
            
            if (now - last >= (24 * 60 * 60 * 1000)) {
                const daily = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                u.bonus += daily[u.pack];
                u.investDate = new Date(); // Relance pour 24h
                console.log(`[AUTO] Gain versé pour ${u.username}`);
            }
        }
    });
}, 1000 * 60 * 30);

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// LANCEMENT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[MASTER] CASH LINK v18.0 sur le port ${PORT}`));
