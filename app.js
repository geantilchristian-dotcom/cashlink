/**
 * ==========================================================================
 * CASH LINK GLOBAL - CORE ENGINE v10.0 (ÉDITION INDUSTRIELLE)
 * DÉVELOPPÉ POUR : ANASH MASTER (RDC 2026)
 * SÉCURITÉ : ISOLEMENT ADMIN / CLIENTS / SYSTÈME DE PARRAINAGE 10%
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

/**
 * --------------------------------------------------------------------------
 * CONFIGURATION DU SERVEUR ET DES MOTEURS
 * --------------------------------------------------------------------------
 */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- SESSIONS PERSISTANTES (Gère l'auto-connexion pendant 7 jours) ---
app.use(session({
    secret: 'titan_rdc_ultra_secret_2026_master_key_anash',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Jours de session
        secure: false 
    }
}));

/* ==========================================================================
   SECTION 1 : BASE DE DONNÉES ET ÉTATS DU SYSTÈME (SIMULATION)
   ========================================================================== */

// Contenu modifiable dynamiquement par l'Admin
let siteContent = {
    brand_name: "CASH LINK",
    titre_principal: "MINAGE AUTO",
    description: "Laissez nos serveurs générer vos profits pendant que vous dormez. Technologie de pointe accessible partout en RDC.",
    puissance_hash: "104.2 TH/s",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    about_text: "CashLink est le leader du minage numérique décentralisé en RDC, offrant des solutions de revenus passifs sécurisés.",
    rules_text: "1. Un seul pack par utilisateur.\n2. Le parrainage rapporte 10% de commission immédiate.\n3. Retraits : 72h (Standard) ou 24h (Elite Certifié)."
};

// Liste des utilisateurs (Initialisée avec l'Admin Maître)
let users = [
    { 
        id: "ADMIN_ROOT_2026", 
        username: "Admin", 
        password: "999", 
        role: "ADMIN", 
        phone: "000000000" 
    }
];

// Files d'attente pour la gestion administrative
let pendingTID = [];      // Liste des TID à valider
let withdrawalQueue = []; // Liste des paiements à effectuer
let globalLogs = [];      // Historique des activités

/* ==========================================================================
   SECTION 2 : MIDDLEWARES DE PROTECTION ET SÉCURITÉ
   ========================================================================== */

/**
 * Bloque l'accès aux pages Admin si l'utilisateur n'a pas le rôle 'ADMIN'
 */
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === "ADMIN") {
        return next();
    }
    res.status(403).render('error', { message: "ACCÈS REFUSÉ : Réservé à l'Administration." });
};

/**
 * Bloque l'accès au Dashboard si l'utilisateur n'est pas connecté
 */
const isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role === "USER") {
        return next();
    }
    res.redirect('/');
};

/* ==========================================================================
   SECTION 3 : LOGIQUE MÉTIER (CALCULS DE TEMPS ET PROFITS)
   ========================================================================== */

/**
 * Calcule le temps restant en millisecondes pour le cycle de 24h
 */
function getRemainingMs(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const now = new Date().getTime();
    const startTime = new Date(user.investDate).getTime();
    const nextCreditTime = startTime + (24 * 60 * 60 * 1000); // +24 Heures
    const diff = nextCreditTime - now;
    return diff > 0 ? diff : 0;
}

/**
 * Calcule la progression en pourcentage (0-100%)
 */
function getProgress(user) {
    const remaining = getRemainingMs(user);
    if (user.pack === "Aucun") return 0;
    if (remaining === 0) return 100;
    const totalCycle = 24 * 60 * 60 * 1000;
    const elapsed = totalCycle - remaining;
    return Math.floor((elapsed / totalCycle) * 100);
}

/* ==========================================================================
   SECTION 4 : ROUTES D'ACCÈS ET AUTHENTIFICATION
   ========================================================================== */

// --- ACCUEIL (LOGIN CLIENT) ---
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.render('login'); 
});

// --- PORTE DÉROBÉE ADMIN (SECRET) ---
app.get('/master-portal-2026', (req, res) => {
    if (req.session.user && req.session.user.role === "ADMIN") return res.redirect('/admin');
    res.render('admin-login'); 
});

// --- INSCRIPTION AVEC PARRAINAGE (10%) ---
app.post('/register', (req, res) => {
    const { username, phone, password, q_naissance, q_pere, ref } = req.body;

    // Validation stricte RDC
    if (!/^[0-9]{9}$/.test(phone)) return res.send("Erreur : Numéro invalide (9 chiffres).");
    if (users.find(u => u.phone === phone)) return res.send("Erreur : Ce numéro est déjà utilisé.");

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
        referredBy: ref || null, // Capture l'ID du parrain
        role: "USER"
    };

    users.push(newUser);
    req.session.user = newUser; // Connexion automatique immédiate
    console.log(`[AUTH] Nouveau client : ${username} (Ref: ${ref || 'Aucun'})`);
    res.redirect('/dashboard?welcome=true');
});

// --- CONNEXION UNIQUE ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        console.log(`[LOGIN] ${user.username} s'est connecté.`);
        return res.redirect(user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.send("<script>alert('Identifiants incorrects'); window.history.back();</script>");
});

/* ==========================================================================
   SECTION 5 : ESPACE CLIENT (DASHBOARD)
   ========================================================================== */

app.get('/dashboard', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    res.render('dashboard', { 
        user, 
        content: siteContent, 
        p: getProgress(user),
        msRemaining: getRemainingMs(user)
    });
});

// Soumission d'un dépôt (TID)
app.post('/souscrire-pack', isClient, (req, res) => {
    const { packName, prix, reference } = req.body;
    pendingTID.push({
        id: Date.now(),
        username: req.session.user.username,
        phone: req.session.user.phone,
        pack: packName,
        montant: parseInt(prix),
        tid: reference,
        date: new Date().toLocaleString()
    });
    console.log(`[TRANSACTION] TID reçu : ${reference} de ${req.session.user.username}`);
    res.redirect('/dashboard?msg=TID_SEND');
});

// Demande de Retrait (Logique 3j / 24h)
app.post('/retrait', isClient, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const amount = parseInt(req.body.montant);

    if (user.bonus < amount) return res.send("Erreur : Solde bonus insuffisant.");

    if (user.lastWithdrawal) {
        const diffHours = (new Date() - new Date(user.lastWithdrawal)) / (1000 * 60 * 60);
        const limit = user.certified ? 24 : 72;
        if (diffHours < limit) return res.send(`Veuillez attendre ${limit}h entre chaque retrait.`);
    }

    user.bonus -= amount;
    user.lastWithdrawal = new Date();
    withdrawalQueue.push({ id: Date.now(), username: user.username, phone: user.phone, montant: amount, date: new Date().toLocaleString() });
    res.redirect('/dashboard?msg=WITHDRAW_SUCCESS');
});

/* ==========================================================================
   SECTION 6 : ESPACE ADMINISTRATEUR (TERMINAL)
   ========================================================================== */

app.get('/admin', isAdmin, (req, res) => {
    const stats = {
        totalUsers: users.filter(u => u.role === "USER").length,
        enAttente: pendingTID.length,
        soldeGlobal: users.reduce((acc, u) => acc + (u.solde || 0), 0)
    };
    res.render('admin', { stats, transactions: pendingTID, retraits: withdrawalQueue, users, site: siteContent });
});

// APPROBATION TID + LOGIQUE PARRAINAGE 10%
app.post('/admin/approve-tx', isAdmin, (req, res) => {
    const tx = pendingTID.find(t => t.id == req.body.txId);
    if (tx) {
        const u = users.find(user => user.username === tx.username);
        if (tx.pack === "CERTIFICATION") {
            u.certified = true;
        } else {
            u.pack = tx.pack;
            u.solde += tx.montant;
            u.investDate = new Date();
            
            // 1. Bonus activation immédiat
            const bonusMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            u.bonus += bonusMap[tx.pack] || 0;

            // 2. PARRAINAGE 10% (Crédite le parrain immédiatement)
            if (u.referredBy) {
                const parrain = users.find(p => p.id === u.referredBy);
                if (parrain) {
                    const commission = tx.montant * 0.10;
                    parrain.bonus += commission;
                    console.log(`[PARRAINAGE] Commission de ${commission} FC pour ${parrain.username}`);
                }
            }
        }
        pendingTID = pendingTID.filter(t => t.id != req.body.txId);
    }
    res.redirect('/admin');
});

// Mise à jour des contenus du site
app.post('/admin/update-content', isAdmin, (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin?msg=UPDATED');
});

/* ==========================================================================
   SECTION 7 : MOTEUR DE GAINS AUTOMATIQUES (CRON SIMULÉ)
   ========================================================================== */

setInterval(() => {
    console.log("[SYSTEM] Vérification des cycles de minage...");
    users.forEach(u => {
        if (u.pack !== "Aucun" && u.investDate) {
            const timePassed = new Date() - new Date(u.investDate);
            if (timePassed >= (24 * 60 * 60 * 1000)) {
                const dailyIncomes = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                const profit = dailyIncomes[u.pack];
                u.bonus += profit;
                u.investDate = new Date(); // Redémarre le cycle de 24h
                console.log(`[GAIN AUTO] +${profit} FC versés à ${u.username}`);
            }
        }
    });
}, 1000 * 60 * 30); // Vérification toutes les 30 minutes

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// LANCEMENT DU SERVEUR TITAN
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ============================================================
    CASH LINK CORE v10.0 ACTIF
    PORT : ${PORT}
    ADMIN PORTAL : /master-portal-2026
    ============================================================
    `);
});
