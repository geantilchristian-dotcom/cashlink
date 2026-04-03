/**
 * ==========================================================================
 * CASH LINK - MOTEUR DE GESTION FINANCIÈRE v5.8 (FULL STACK)
 * ARCHITECTURE : NODE.JS | EXPRESS | EJS | EXPRESS-SESSION
 * RÉGION : RÉPUBLIQUE DÉMOCRATIQUE DU CONGO (RDC)
 * LOGIQUE : MINAGE AUTO 24H, RETRAITS (3J/24H), SÉCURITÉ 9 CHIFFRES
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

/**
 * --------------------------------------------------------------------------
 * CONFIGURATION DU MOTEUR ET DES MIDDLEWARES
 * --------------------------------------------------------------------------
 */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CONFIGURATION DES SESSIONS (Persistance 7 jours pour Auto-Login)
app.use(session({
    secret: 'cashlink_titan_ultra_secure_alpha_2026_master_key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Jours
        secure: false // Passer à true en HTTPS
    }
}));

/* ==========================================================================
   SECTION 1 : BASE DE DONNÉES ET CONFIGURATION DU SYSTÈME
   ========================================================================== */

// CONTENU PILOTÉ PAR L'ADMIN (MODIFIABLE VIA L'INTERFACE ADMIN)
let siteContent = {
    brand_name: "CASH LINK",
    titre_principal: "MINAGE AUTO",
    description: "Changez de vie aujourd'hui. Laissez nos serveurs travailler pour vous et encaissez vos profits chaque jour sans effort.",
    puissance_hash: "98.2 TH/s",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    footer_text: "© 2026 CASH LINK - TOUS DROITS RÉSERVÉS"
};

// STOCKAGE DES UTILISATEURS (INITIALISÉ AVEC L'ADMIN)
let users = [
    {
        id: "ADMIN_MASTER_001",
        username: "Admin",
        password: "999",
        role: "ADMIN",
        phone: "000000000"
    }
];

// FILES D'ATTENTE POUR LES OPÉRATIONS FINANCIÈRES
let pendingTID = [];      // File des dépôts (TID)
let withdrawalQueue = []; // File des retraits (Paiements)
let systemLogs = [];      // Historique des activités pour l'admin

/* ==========================================================================
   SECTION 2 : MIDDLEWARES DE SÉCURITÉ ET VALIDATION
   ========================================================================== */

// Middleware pour protéger les routes clients
const isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role === "USER") {
        return next();
    }
    res.redirect('/');
};

// Middleware pour protéger le terminal Admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === "ADMIN") {
        return next();
    }
    res.redirect('/master-control');
};

/* ==========================================================================
   SECTION 3 : LOGIQUE MÉTIER (CALCULS ET RESTRICTIONS)
   ========================================================================== */

/**
 * MOTEUR DE PROGRESSION : Calcule le % de gain sur 24h
 */
function calculateMiningProgress(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const now = new Date();
    const start = new Date(user.investDate);
    const diffMs = now - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    let percentage = Math.floor((diffHours / 24) * 100);
    return percentage > 100 ? 100 : percentage;
}

/**
 * FILTRE DE RETRAIT : 3 jours pour Standard / 24h pour Certifié
 */
function isWithdrawalAuthorized(user) {
    if (!user.lastWithdrawal) return true;
    const now = new Date();
    const last = new Date(user.lastWithdrawal);
    const diffHours = (now - last) / (1000 * 60 * 60);
    const requiredHours = user.certified ? 24 : 72; // 24h vs 72h
    return diffHours >= requiredHours;
}

/* ==========================================================================
   SECTION 4 : ROUTES D'AUTHENTIFICATION (CLIENTS)
   ========================================================================== */

// Page d'accueil : Login Client
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.render('login'); 
});

/**
 * INSCRIPTION : Sécurité 9 chiffres + Questions secrètes
 */
app.post('/register', (req, res) => {
    const { username, phone, password, q_naissance, q_pere } = req.body;
    
    // VALIDATION STRICTE DU NUMÉRO RDC
    if (!/^[0-9]{9}$/.test(phone)) {
        return res.send("<script>alert('Le numéro doit avoir exactement 9 chiffres.'); window.history.back();</script>");
    }

    // VALIDATION DU MOT DE PASSE (MIN 4 CHIFFRES)
    if (password.length < 4 || isNaN(password)) {
        return res.send("<script>alert('Le mot de passe doit être composé d'au moins 4 chiffres.'); window.history.back();</script>");
    }

    // VÉRIFICATION DOUBLON
    if (users.find(u => u.phone === phone)) {
        return res.send("<script>alert('Ce numéro est déjà enregistré.'); window.history.back();</script>");
    }

    const newUser = {
        id: "U" + Date.now(),
        username,
        phone,
        password,
        q_naissance: q_naissance.toLowerCase().trim(),
        q_pere: q_pere.toLowerCase().trim(),
        solde: 0,
        bonus: 0,
        pack: "Aucun",
        certified: false,
        investDate: null,
        lastWithdrawal: null,
        role: "USER"
    };

    users.push(newUser);
    req.session.user = newUser; // AUTO-LOGIN : S'inscrit et rentre directement
    console.log(`[AUTH] Nouveau compte : ${username} | Session démarrée.`);
    res.redirect('/dashboard?welcome=true');
});

// CONNEXION CLIENT ET ADMIN
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        if (user.role === "ADMIN") {
            return res.redirect('/admin');
        } else {
            return res.redirect('/dashboard');
        }
    } else {
        res.send("<script>alert('Identifiants incorrects.'); window.history.back();</script>");
    }
});

// RÉCUPÉRATION DE MOT DE PASSE
app.post('/recovery', (req, res) => {
    const { phone, q_naissance, q_pere } = req.body;
    const user = users.find(u => u.phone === phone);

    if (user && user.q_naissance === q_naissance.toLowerCase().trim() && user.q_pere === q_pere.toLowerCase().trim()) {
        res.send(`Votre mot de passe est : <strong>${user.password}</strong>. <a href="/">Retour au login</a>`);
    } else {
        res.send("<script>alert('Réponses incorrectes.'); window.history.back();</script>");
    }
});

/* ==========================================================================
   SECTION 5 : ROUTES CLIENT (DASHBOARD)
   ========================================================================== */

app.get('/dashboard', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const progress = calculateMiningProgress(user);
    
    res.render('dashboard', {
        user: user,
        content: siteContent,
        p: progress,
        welcome: req.query.welcome === 'true'
    });
});

// SOUMISSION TID
app.post('/souscrire-pack', isClient, (req, res) => {
    const { packName, prix, reference } = req.body;
    
    pendingTID.push({
        id: Date.now(),
        username: req.session.user.username,
        phone: req.session.user.phone,
        pack: packName,
        montant: parseInt(prix),
        tid: reference,
        status: "En attente",
        date: new Date().toLocaleString()
    });

    console.log(`[PAIEMENT] TID ${reference} soumis par ${req.session.user.username}`);
    res.redirect('/dashboard?msg=TID_SEND');
});

// GESTION DES RETRAITS
app.post('/retrait', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const montant = parseInt(req.body.montant);

    if (user.bonus < montant) return res.send("Bonus insuffisant.");
    if (!isWithdrawalAuthorized(user)) return res.send("Délai de retrait non atteint (Standard: 3j, Certifié: 24h).");

    user.bonus -= montant;
    user.lastWithdrawal = new Date();
    
    withdrawalQueue.push({
        id: Date.now(),
        username: user.username,
        phone: user.phone,
        montant: montant,
        certified: user.certified,
        date: new Date().toLocaleString()
    });

    res.redirect('/dashboard?msg=SUCCESS');
});

/* ==========================================================================
   SECTION 6 : TERMINAL DE CONTRÔLE (ADMINISTRATEUR)
   ========================================================================== */

// PORTE SECRÈTE ADMIN
app.get('/master-control', (req, res) => {
    if (req.session.user && req.session.user.role === "ADMIN") return res.redirect('/admin');
    res.render('admin-login'); 
});

// DASHBOARD ADMIN
app.get('/admin', isAdmin, (req, res) => {
    const stats = {
        totalUsers: users.filter(u => u.role === "USER").length,
        enAttente: pendingTID.length,
        soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0)
    };

    res.render('admin', {
        stats: stats,
        transactions: pendingTID,
        retraits: withdrawalQueue,
        users: users.filter(u => u.role === "USER"),
        site: siteContent
    });
});

// MODIFICATION ADMIN (PROFIL)
app.post('/admin/update-self', isAdmin, (req, res) => {
    const { new_username, new_password } = req.body;
    const admin = users.find(u => u.role === "ADMIN");

    if (new_username) admin.username = new_username;
    if (new_password && new_password.length >= 4) admin.password = new_password;

    res.redirect('/admin?msg=ADMIN_UPDATED');
});

// APPROBATION TID
app.post('/admin/approve-tx', isAdmin, (req, res) => {
    const { txId } = req.body;
    const tx = pendingTID.find(t => t.id == txId);
    
    if (tx) {
        const user = users.find(u => u.username === tx.username);
        if (tx.pack === "CERTIFICATION") {
            user.certified = true;
        } else {
            user.pack = tx.pack;
            user.solde += tx.montant;
            user.investDate = new Date(); // DÉCLENCHE LE MINAGE AUTO
            
            // BONUS DE BIENVENUE PACK
            const bonusMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            user.bonus += bonusMap[tx.pack] || 0;
        }
        pendingTID = pendingTID.filter(t => t.id != txId);
        console.log(`[APPROBATION] Admin a validé le dépôt de ${user.username}`);
    }
    res.redirect('/admin');
});

// PILOTAGE DASHBOARD
app.post('/admin/update-content', isAdmin, (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin?msg=CONTENT_UPDATED');
});

/* ==========================================================================
   SECTION 7 : MOTEUR CRON (GAIN AUTOMATIQUE 24H)
   ========================================================================== */

/**
 * Ce script vérifie toutes les 30 minutes qui doit être payé.
 */
setInterval(() => {
    console.log("[SYSTEM] Analyse des cycles de gains...");
    users.forEach(user => {
        if (user.pack !== "Aucun" && user.investDate) {
            const now = new Date();
            const start = new Date(user.investDate);
            const diffHours = (now - start) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                // DISTRIBUTION SELON LES PACKS RDC
                const dailyIncome = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                const gain = dailyIncome[user.pack] || 0;
                
                user.bonus += gain;
                user.investDate = new Date(); // RESET CYCLE 24H
                console.log(`[GAIN AUTO] +${gain} FC crédités à ${user.username}`);
            }
        }
    });
}, 1000 * 60 * 30); // 30 minutes

/* ==========================================================================
   SECTION 8 : INITIALISATION DU SERVEUR
   ========================================================================== */

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// LANCEMENT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ============================================================
    CASH LINK TERMINAL v5.8 OPÉRATIONNEL (RDC 2026)
    ACCÈS CLIENT : http://localhost:${PORT}/
    ACCÈS ADMIN : http://localhost:${PORT}/master-control
    ============================================================
    `);
});

/**
 * FIN DU FICHIER APP.JS
 * TOTAL ESTIMÉ : 500 LIGNES DE CODE INDUSTRIEL
 * ============================================================
 */
