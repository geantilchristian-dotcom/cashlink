/**
 * ==========================================================================
 * PROJET : CASH LINK - CORE ENGINE v5.0
 * ARCHITECTURE : NODE.JS | EXPRESS | EJS | SESSIONS
 * RÔLE : SYNCHRONISATION TEMPS RÉEL CLIENT / ADMIN
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURATION SERVEUR & VUES ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- SYSTÈME DE SESSIONS SÉCURISÉES ---
app.use(session({
    secret: 'cashlink_titan_ultra_secret_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Session active 24h
}));

/* ==========================================================================
   BASE DE DONNÉES ET CONFIGURATION DU SYSTÈME
   ==========================================================================
*/

// Contenu éditable par l'Admin en temps réel
let siteContent = {
    brand_name: "CASH LINK",
    titre_principal: "MINAGE AUTO",
    description: "Changez de vie aujourd'hui. Laissez nos serveurs travailler pour vous et encaissez vos profits chaque jour sans aucun effort physique.",
    puissance_hash: "98.2 TH/s",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    footer_text: "© 2026 CASH LINK - TOUS DROITS RÉSERVÉS"
};

// Base de données utilisateurs (Simulée)
let users = [
    {
        id: "admin_001",
        username: "Admin",
        password: "999",
        role: "ADMIN"
    }
];

// Files d'attente système
let pendingTID = [];      // Dépôts en attente
let withdrawalQueue = []; // Retraits en attente
let logs = [];            // Historique serveur

/* ==========================================================================
   LOGIQUE MÉTIER & CALCULS DE GAINS
   ==========================================================================
*/

// Calculer la progression de la barre (0 à 100% sur 24h)
function calculateProgress(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const now = new Date();
    const start = new Date(user.investDate);
    const diff = (now - start) / (1000 * 60 * 60); // Heures écoulées
    let p = Math.floor((diff / 24) * 100);
    return p > 100 ? 100 : p;
}

// Vérifier si le retrait est possible (Standard 3j vs Certifié 24h)
function isWithdrawalAllowed(user) {
    if (!user.lastWithdrawal) return true;
    const now = new Date();
    const last = new Date(user.lastWithdrawal);
    const diffHours = (now - last) / (1000 * 60 * 60);
    const limit = user.certified ? 24 : 72; // 24h ou 3 jours
    return diffHours >= limit;
}

/* ==========================================================================
   ROUTES D'ACCÈS & AUTHENTIFICATION
   ==========================================================================
*/

// Page de Connexion / Inscription
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect(req.session.user.role === "ADMIN" ? '/admin' : '/dashboard');
    res.render('login'); 
});

// Création de compte en temps réel
app.post('/register', (req, res) => {
    const { username, phone, password } = req.body;
    
    // Vérification si l'utilisateur existe déjà
    if (users.find(u => u.username === username || u.phone === phone)) {
        return res.send("Erreur : Ce compte existe déjà.");
    }

    const newUser = {
        id: "U" + Date.now(),
        username,
        phone,
        password,
        solde: 0,
        bonus: 0,
        pack: "Aucun",
        certified: false,
        investDate: null,
        lastWithdrawal: null,
        role: "USER"
    };

    users.push(newUser);
    req.session.user = newUser;
    console.log(`[AUTH] Nouveau compte créé : ${username} (+243 ${phone})`);
    res.redirect('/dashboard');
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        res.redirect(user.role === "ADMIN" ? '/admin' : '/dashboard');
    } else {
        res.send("Identifiants incorrects.");
    }
});

/* ==========================================================================
   ROUTES CLIENT (DASHBOARD)
   ==========================================================================
*/

app.get('/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== "USER") return res.redirect('/');
    
    // Récupérer les données utilisateur synchronisées
    const user = users.find(u => u.id === req.session.user.id);
    const progress = calculateProgress(user);
    
    res.render('dashboard', {
        user: user,
        content: siteContent,
        p: progress
    });
});

// Soumission d'un TID (Dépôt ou Certification)
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const user = req.session.user;

    pendingTID.push({
        id: Date.now(),
        username: user.username,
        phone: user.phone,
        pack: packName,
        montant: prix,
        tid: reference,
        status: "En attente",
        date: new Date().toLocaleString()
    });

    console.log(`[PAIEMENT] TID reçu de ${user.username} : ${reference}`);
    res.redirect('/dashboard?msg=TID_SEND');
});

// Demande de Retrait
app.post('/retrait', (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const montant = parseInt(req.body.montant);

    if (user.bonus < montant) return res.send("Solde bonus insuffisant.");
    if (!isWithdrawalAllowed(user)) return res.send("Délai de retrait non atteint.");

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
   ROUTES ADMIN (TERMINAL DE CONTRÔLE)
   ==========================================================================
*/

app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== "ADMIN") return res.redirect('/');
    
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

// Approuver un TID (Le moment où l'argent entre en compte)
app.post('/admin/approve-tx', (req, res) => {
    const { txId } = req.body;
    const tx = pendingTID.find(t => t.id == txId);
    
    if (tx) {
        const user = users.find(u => u.username === tx.username);
        
        if (tx.pack === "CERTIFICATION") {
            user.certified = true;
        } else {
            user.pack = tx.pack;
            user.investDate = new Date(); // Démarre le minage
            user.solde += parseInt(tx.montant);
            
            // Bonus automatique à l'activation
            const bonusMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            user.bonus += bonusMap[tx.pack] || 0;
        }
        // Retirer de la file d'attente
        pendingTID = pendingTID.filter(t => t.id != txId);
    }
    res.redirect('/admin');
});

// Mise à jour du Dashboard depuis l'Admin
app.post('/admin/update-content', (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin?msg=UPDATED');
});

/* ==========================================================================
   CRON SIMULÉ (DISTRIBUTION DES GAINS TOUTES LES 24H)
   ==========================================================================
*/

setInterval(() => {
    users.forEach(user => {
        if (user.pack !== "Aucun" && user.investDate) {
            const now = new Date();
            const start = new Date(user.investDate);
            const diffHours = (now - start) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                const incomes = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                user.bonus += incomes[user.pack];
                user.investDate = new Date(); // Reset du cycle
                console.log(`[GAIN AUTO] +${incomes[user.pack]} FC pour ${user.username}`);
            }
        }
    });
}, 1000 * 60 * 30); // Vérification toutes les 30 minutes

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// LANCEMENT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] CASH LINK v5.0 opérationnel sur le port ${PORT}`);
});
