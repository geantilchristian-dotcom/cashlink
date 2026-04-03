/**
 * ==========================================================================
 * NOM DU PROJET : CASH LINK - MOTEUR BACKEND v5.0
 * ARCHITECTURE : NODE.JS | EXPRESS | EJS
 * LOCALISATION : RÉPUBLIQUE DÉMOCRATIQUE DU CONGO (RDC)
 * LOGIQUE : GESTION DES FLUX DE MINAGE ET VALIDATION DES PAIEMENTS
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- GESTION DES SESSIONS SÉCURISÉES ---
app.use(session({
    secret: 'cashlink_titan_secret_key_2026_rdc',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // Session de 24h
        secure: false // Mettre à true si HTTPS
    }
}));

/* ==========================================================================
   BASE DE DONNÉES ET ÉTATS DU SYSTÈME (SIMULATION PERSISTANTE)
   ==========================================================================
*/

// État initial du contenu éditable par l'Admin
let siteContent = {
    brand_name: "CASH LINK",
    titre_principal: "MINAGE AUTO",
    description: "Changez de vie aujourd'hui. Laissez nos serveurs travailler pour vous et encaissez vos profits chaque jour sans aucun effort physique.",
    puissance_hash: "85.4 TH/s", // Utilisé comme "UNITÉ CONNECTÉE"
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    footer_text: "© 2026 CASH LINK - TOUS DROITS RÉSERVÉS",
    footer_sub: "PLATEFORME DE MINAGE NUMÉRIQUE AGRÉÉE RDC"
};

// Liste des utilisateurs
let users = [
    {
        id: "1",
        username: "Anash",
        phone: "820000000", // 9 chiffres sans le +243
        password: "123",
        solde: 50000,
        bonus: 10000,
        pack: "Aucun",
        certified: false, // false = 3 jours, true = 24h
        investDate: null,
        lastWithdrawal: null,
        role: "USER"
    },
    {
        id: "admin_master",
        username: "Admin",
        password: "999",
        role: "ADMIN"
    }
];

// Files d'attente
let pendingTransactions = []; // Dépôts TID
let withdrawalRequests = [];  // Retraits
let globalLogs = [];         // Historique des activités

/* ==========================================================================
   MOTEUR DE CALCULS TECHNIQUES (LOGIQUE DE GAIN)
   ==========================================================================
*/

/**
 * Calcule la progression du minage (0 à 100%)
 * Un cycle complet de minage dure 24h
 */
function getMiningProgress(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    
    const now = new Date();
    const startTime = new Date(user.investDate);
    const elapsedMs = now - startTime;
    const cycleMs = 24 * 60 * 60 * 1000; // 24 heures
    
    let progress = Math.floor((elapsedMs / cycleMs) * 100);
    return progress > 100 ? 100 : progress;
}

/**
 * Vérifie si le retrait est autorisé selon le statut (Standard/Certifié)
 */
function canUserWithdraw(user) {
    if (!user.lastWithdrawal) return true; // Premier retrait toujours OK
    
    const now = new Date();
    const lastDate = new Date(user.lastWithdrawal);
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    
    const requiredHours = user.certified ? 24 : 72; // 24h vs 3 jours (72h)
    return diffHours >= requiredHours;
}

/* ==========================================================================
   ROUTES UTILISATEURS (FRONT-END)
   ==========================================================================
*/

// Redirection vers Login ou Dashboard
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login'); 
});

// Authentification
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        if (user.role === "ADMIN") return res.redirect('/admin');
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: "Nom d'utilisateur ou mot de passe incorrect." });
    }
});

// Dashboard Principal
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    // On récupère les données fraîches de l'utilisateur
    const user = users.find(u => u.id === req.session.user.id);
    const progress = getMiningProgress(user);
    
    res.render('dashboard', {
        user: user,
        content: siteContent,
        p: progress
    });
});

/**
 * Soumission d'un TID (Dépôt ou Certification)
 * Format TID : PP260328.1242.H42886
 */
app.post('/souscrire-pack', (req, res) => {
    if (!req.session.user) return res.status(403).send("Session expirée");
    
    const { packName, prix, reference } = req.body;
    
    // Regex de validation TID RDC
    const tidPattern = /^[A-Z0-9]{8}\.[0-9]{4}\.[A-Z0-9]{6}$/;

    // On accepte les formats un peu plus souples si besoin, mais on log
    pendingTransactions.push({
        id: Date.now(),
        username: req.session.user.username,
        type: packName,
        montant: parseInt(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString()
    });

    console.log(`[PAIEMENT] Nouveau TID reçu de ${req.session.user.username} : ${reference}`);
    res.redirect('/dashboard?msg=TID_SEND');
});

/**
 * Demande de retrait des profits
 */
app.post('/retrait', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const user = users.find(u => u.id === req.session.user.id);
    const montant = parseInt(req.body.montant);

    // 1. Vérification du solde bonus
    if (user.bonus < montant) {
        return res.redirect('/dashboard?err=SOLDE_INSUFFISANT');
    }

    // 2. Vérification de la restriction temporelle (Standard vs Certifié)
    if (!canUserWithdraw(user)) {
        return res.redirect('/dashboard?err=DELAI_NON_ATTEINT');
    }

    // 3. Traitement de la demande
    user.bonus -= montant;
    user.lastWithdrawal = new Date();
    
    withdrawalRequests.push({
        id: Date.now(),
        username: user.username,
        phone: user.phone,
        montant: montant,
        certified: user.certified,
        statut: "En attente",
        date: new Date().toLocaleString()
    });

    res.redirect('/dashboard?msg=SUCCESS');
});

/* ==========================================================================
   ROUTES ADMIN (CONTROLE ET VALIDATION)
   ==========================================================================
*/

// Middleware de sécurité Admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === "ADMIN") return next();
    res.redirect('/');
};

app.get('/admin', isAdmin, (req, res) => {
    const stats = {
        totalUsers: users.filter(u => u.role === "USER").length,
        enAttente: pendingTransactions.length,
        soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0)
    };

    res.render('admin', {
        stats: stats,
        transactions: pendingTransactions,
        retraits: withdrawalRequests,
        users: users.filter(u => u.role === "USER"),
        site: siteContent
    });
});

/**
 * Approbation d'un dépôt (TID)
 */
app.post('/admin/approve-tx', isAdmin, (req, res) => {
    const { txId } = req.body;
    const tx = pendingTransactions.find(t => t.id == txId);
    
    if (tx) {
        const user = users.find(u => u.username === tx.username);
        
        if (tx.type === "CERTIFICATION") {
            user.certified = true;
            console.log(`[ADMIN] Certification activée pour ${user.username}`);
        } else {
            // Activation de pack de minage
            user.pack = tx.type;
            user.investDate = new Date(); // Démarre le cycle de minage
            user.solde += tx.montant;
            
            // On ajoute aussi le bonus de bienvenue selon le pack
            const bonuses = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            user.bonus += bonuses[tx.type] || 0;
            
            console.log(`[ADMIN] Pack ${tx.type} activé pour ${user.username}`);
        }

        // Supprimer de la file
        pendingTransactions = pendingTransactions.filter(t => t.id != txId);
    }
    res.redirect('/admin?msg=TX_APPROVED');
});

/**
 * Confirmation de paiement d'un retrait
 */
app.post('/admin/confirm-pay', isAdmin, (req, res) => {
    const { reqId } = req.body;
    withdrawalRequests = withdrawalRequests.filter(r => r.id != reqId);
    res.redirect('/admin?msg=WITHDRAWAL_PAID');
});

/**
 * Mise à jour du contenu du Dashboard
 */
app.post('/admin/update-content', isAdmin, (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    console.log(`[ADMIN] Configuration du Dashboard mise à jour.`);
    res.redirect('/admin?msg=CONTENT_UPDATED');
});

/* ==========================================================================
   CRON SIMULÉ (MOTEUR DE GAINS AUTOMATIQUES)
   ==========================================================================
*/

/**
 * Vérifie toutes les 30 minutes si des cycles de 24h sont terminés
 */
setInterval(() => {
    console.log("[SYSTEM] Vérification des cycles de gain...");
    const now = new Date();
    
    users.forEach(user => {
        if (user.pack !== "Aucun" && user.investDate) {
            const lastInvest = new Date(user.investDate);
            const diffHours = (now - lastInvest) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                // Attribution des gains journaliers
                const dailyIncomes = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                const gain = dailyIncomes[user.pack] || 0;
                
                user.bonus += gain;
                user.investDate = new Date(); // Reset pour le cycle suivant
                
                console.log(`[GAIN] +${gain} FC ajouté à ${user.username} (Pack ${user.pack})`);
            }
        }
    });
}, 1000 * 60 * 30); // 30 minutes

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- DÉMARRAGE DU TERMINAL ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ============================================================
    CASH LINK TERMINAL v5.0 DÉMARRÉ
    PORT: ${PORT}
    MODE: PRODUCTION RDC
    ============================================================
    `);
});
