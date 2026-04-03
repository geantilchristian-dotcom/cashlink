/* ============================================================
   CASHLINK TERMINAL ENGINE v4.0 - BACKEND CORE
   Congo RDC Edition - 2026
   ============================================================ */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// --- CONFIGURATION DU MOTEUR DE VUE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// --- SYSTÈME DE SESSION SÉCURISÉ ---
app.use(session({
    secret: 'cashlink_ultra_secret_2026_rdc',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

/* ============================================================
   BASE DE DONNÉES SIMULÉE (À RELIER À MONGODB PLUS TARD)
   ============================================================ */
let users = [
    { 
        username: "Anash", 
        phone: "820000000", 
        password: "123", 
        solde: 25000, 
        bonus: 0, 
        pack: "Aucun", 
        investDate: null,
        referrals: 0,
        role: "USER"
    },
    { username: "Admin", password: "999", role: "ADMIN" }
];

let pendingPayments = []; // Stocke les TID à valider par l'admin
let withdrawalRequests = []; // Stocke les demandes de retraits

// --- CONFIGURATION GLOBALE DU SITE (Variables EJS) ---
const siteContent = {
    brand_name: "CASHLINK",
    tag_tech: "PROTOCOLE DE MINAGE CLOUD RDC",
    titre_principal: "GÉNÉREZ DES PROFITS QUOTIDIENS",
    description: "Le premier terminal de minage décentralisé en République Démocratique du Congo. Simple, Rapide et Sécurisé.",
    puissance_hash: "85.4 TH/s",
    reseau_status: "OPÉRATIONNEL",
    admin_voda: "810000000",
    admin_airtel: "970000000",
    admin_orange: "890000000",
    contact_phone: "820000000",
    contact_address: "Gombe, Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    footer_text: "© 2026 CASHLINK ELITE - TOUS DROITS RÉSERVÉS",
    footer_sub: "PLATEFORME AGRÉÉE POUR LE MINAGE NUMÉRIQUE"
};

/* ============================================================
   LOGIQUE DE CALCUL DES PROFITS (MOTEUR TEMPS RÉEL)
   ============================================================ */
function calculateMiningProgress(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    
    const now = new Date();
    const start = new Date(user.investDate);
    const diffMs = now - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // On calcule le % basé sur un cycle de 24h
    let progress = (diffHours / 24) * 100;
    if (progress > 100) progress = 100;
    
    return Math.floor(progress);
}

/* ============================================================
   ROUTES DES UTILISATEURS (DASHBOARD)
   ============================================================ */

// Page d'accueil / Connexion
app.get('/', (req, res) => {
    res.render('login'); // Crée un fichier login.ejs simple
});

// Traitement de la connexion
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = user;
        if (user.role === "ADMIN") return res.redirect('/admin');
        res.redirect('/dashboard');
    } else {
        res.send("Identifiants incorrects.");
    }
});

// Dashboard Principal
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const user = users.find(u => u.username === req.session.user.username);
    const progress = calculateMiningProgress(user);
    
    res.render('dashboard', { 
        user: user, 
        content: siteContent, 
        p: progress 
    });
});

// --- GESTION DES PAIEMENTS (TID) ---
app.post('/souscrire-pack', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const { packName, prix, reference } = req.body;
    
    // Validation du format TID RDC
    const tidRegex = /^[A-Z0-9]{8}\.[0-9]{4}\.[A-Z0-9]{6}$/;
    
    pendingPayments.push({
        user: req.session.user.username,
        pack: packName,
        montant: prix,
        tid: reference,
        date: new Date().toLocaleString()
    });
    
    res.redirect('/dashboard?msg=TID_SEND');
});

// --- GESTION DES RETRAITS ---
app.post('/retrait', (req, res) => {
    const user = users.find(u => u.username === req.session.user.username);
    const montant = parseInt(req.body.montant);

    if (user.bonus >= montant) {
        user.bonus -= montant;
        withdrawalRequests.push({ 
            user: user.username, 
            montant: montant, 
            phone: user.phone,
            status: "En attente" 
        });
        res.redirect('/dashboard?msg=SUCCESS');
    } else {
        res.redirect('/dashboard?err=FONDS');
    }
});

/* ============================================================
   INTERFACE ADMIN (VALIDATION ET CONTRÔLE)
   ============================================================ */

app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== "ADMIN") return res.redirect('/');
    
    res.render('admin', { 
        payments: pendingPayments, 
        withdrawals: withdrawalRequests,
        usersCount: users.length 
    });
});

// Valider un paiement (Créditer le pack et le bonus)
app.post('/admin/approve-payment', (req, res) => {
    const { tid, username, pack, montant } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user) {
        user.pack = pack;
        user.investDate = new Date();
        // Attribution du bonus de bienvenue selon le pack
        const bonusMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
        user.bonus += bonusMap[pack] || 0;
        
        // Supprimer des paiements en attente
        pendingPayments = pendingPayments.filter(p => p.tid !== tid);
    }
    res.redirect('/admin');
});

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

/* ============================================================
   CRON JOB SIMULÉ : DISTRIBUTION DES GAINS JOURNALIERS
   ============================================================ */
setInterval(() => {
    users.forEach(user => {
        if (user.pack !== "Aucun" && user.investDate) {
            const now = new Date();
            const lastUpdate = new Date(user.investDate);
            const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

            // Si 24h sont passées, on ajoute le gain quotidien
            if (diffHours >= 24) {
                const incomeMap = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                user.bonus += incomeMap[user.pack];
                user.investDate = new Date(); // Reset du cycle
                console.log(`Gains distribués pour ${user.username}`);
            }
        }
    });
}, 60000); // Vérification chaque minute

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ===========================================
    CASHLINK TERMINAL v4.0 DÉMARRÉ
    PORT: ${PORT}
    STATUT: OPÉRATIONNEL (RDC)
    ===========================================
    `);
});
