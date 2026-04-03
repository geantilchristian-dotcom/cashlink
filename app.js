/**
 * ==========================================================================
 * CASH LINK - CORE ENGINE v5.6 (ÉDITION TITAN FINALE)
 * ARCHITECTURE : NODE.JS | EXPRESS | EJS | SESSIONS
 * LOCALISATION : RÉPUBLIQUE DÉMOCRATIQUE DU CONGO (RDC)
 * LOGIQUE : MINAGE AUTO 24H, RETRAITS SÉCURISÉS, SÉCURITÉ 9 CHIFFRES
 * ==========================================================================
 */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// --- CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- SESSIONS PERSISTANTES (7 JOURS) ---
// L'utilisateur reste connecté même s'il ferme son navigateur
app.use(session({
    secret: 'cashlink_titan_ultra_secure_alpha_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, 
        secure: false 
    }
}));

/* ==========================================================================
   BASE DE DONNÉES ET CONFIGURATION ÉDITABLE (ADMIN)
   ========================================================================== */

// Contenu piloté par l'Admin en temps réel
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

// Stockage des utilisateurs (Inscriptions en temps réel)
let users = [
    {
        id: "admin_001",
        username: "Admin",
        password: "999",
        role: "ADMIN",
        phone: "000000000"
    }
];

// Files d'attente pour validation Admin
let pendingTID = [];      // Dépôts (TID)
let withdrawalQueue = []; // Demandes de retraits

/* ==========================================================================
   LOGIQUE MÉTIER : CALCULS DE PROFITS & RESTRICTIONS
   ========================================================================== */

/**
 * Calcule la progression du minage (0 à 100% sur 24h)
 */
function calculateMiningProgress(user) {
    if (!user.investDate || user.pack === "Aucun") return 0;
    const now = new Date();
    const start = new Date(user.investDate);
    const diffHours = (now - start) / (1000 * 60 * 60);
    let p = Math.floor((diffHours / 24) * 100);
    return p > 100 ? 100 : p;
}

/**
 * Vérifie si le retrait est autorisé (Standard 72h vs Certifié 24h)
 */
function isWithdrawalAllowed(user) {
    if (!user.lastWithdrawal) return true; // Premier retrait OK
    const now = new Date();
    const last = new Date(user.lastWithdrawal);
    const diffHours = (now - last) / (1000 * 60 * 60);
    const limit = user.certified ? 24 : 72; // Règle : 1 jour vs 3 jours
    return diffHours >= limit;
}

/* ==========================================================================
   ROUTES D'AUTHENTIFICATION (INSCRIPTION & RÉCUPÉRATION)
   ========================================================================== */

// Page de Connexion
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === "ADMIN" ? '/admin' : '/dashboard');
    }
    res.render('login'); 
});

/**
 * Inscription Strict : 9 chiffres, min 4 chiffres pass, questions secrètes
 */
app.post('/register', (req, res) => {
    const { username, phone, password, q_naissance, q_pere } = req.body;
    
    // Validation 9 chiffres RDC
    if (!/^[0-9]{9}$/.test(phone)) {
        return res.send("Erreur : Le numéro doit contenir exactement 9 chiffres (ex: 820000000).");
    }

    // Validation mot de passe (Minimum 4 chiffres)
    if (password.length < 4 || isNaN(password)) {
        return res.send("Erreur : Le mot de passe doit comporter au moins 4 chiffres.");
    }

    if (users.find(u => u.phone === phone)) {
        return res.send("Erreur : Ce numéro de téléphone est déjà utilisé.");
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
    req.session.user = newUser; // Connexion automatique immédiate
    console.log(`[AUTH] Nouveau compte créé : ${username} (+243 ${phone})`);
    res.redirect('/dashboard?welcome=true');
});

// Connexion Classique avec Distinction de Rôle
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
        res.send("Identifiants incorrects.");
    }
});

// Récupération de mot de passe (Questions de sécurité)
app.post('/recovery', (req, res) => {
    const { phone, q_naissance, q_pere } = req.body;
    const user = users.find(u => u.phone === phone);

    if (user && user.q_naissance === q_naissance.toLowerCase().trim() && user.q_pere === q_pere.toLowerCase().trim()) {
        res.send(`Votre mot de passe est : <strong>${user.password}</strong>. <a href="/">Retour au login</a>`);
    } else {
        res.send("Réponses de sécurité incorrectes.");
    }
});

/* ==========================================================================
   ROUTES CLIENT (DASHBOARD)
   ========================================================================== */

app.get('/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== "USER") return res.redirect('/');
    
    const user = users.find(u => u.id === req.session.user.id);
    const progress = calculateMiningProgress(user);
    
    res.render('dashboard', {
        user: user,
        content: siteContent,
        p: progress,
        welcome: req.query.welcome === 'true'
    });
});

// Soumission d'un ID de transaction (TID)
app.post('/souscrire-pack', (req, res) => {
    if (!req.session.user) return res.redirect('/');
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

    res.redirect('/dashboard?msg=TID_SEND');
});

// Demande de Retrait Profits
app.post('/retrait', (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    const montant = parseInt(req.body.montant);

    if (user.bonus < montant) return res.send("Solde bonus insuffisant.");
    if (!isWithdrawalAllowed(user)) return res.send("Délai de retrait non atteint (Standard: 3j, Certifié: 24h).");

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
   ========================================================================== */

// Accès Admin sécurisé
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

// Modification Profil Admin par lui-même
app.post('/admin/update-self', (req, res) => {
    const { new_username, new_password } = req.body;
    const admin = users.find(u => u.role === "ADMIN");

    if (new_username) admin.username = new_username;
    if (new_password && new_password.length >= 4) admin.password = new_password;

    res.redirect('/admin?msg=ADMIN_UPDATED');
});

// Approbation TID (Activation Pack ou Certification)
app.post('/admin/approve-tx', (req, res) => {
    const { txId } = req.body;
    const tx = pendingTID.find(t => t.id == txId);
    
    if (tx) {
        const user = users.find(u => u.username === tx.username);
        if (tx.pack === "CERTIFICATION") {
            user.certified = true;
        } else {
            user.pack = tx.pack;
            user.solde += tx.montant;
            user.investDate = new Date(); // Démarre le cycle de minage
            
            // Attribution bonus immédiat (Bienvenue)
            const bonusMap = { "BRONZE": 5000, "SILVER": 9000, "GOLD": 40000, "DIAMOND": 120000 };
            user.bonus += bonusMap[tx.pack] || 0;
        }
        pendingTID = pendingTID.filter(t => t.id != txId);
    }
    res.redirect('/admin');
});

// Mise à jour Contenu Dashboard (Marketing, Numéros)
app.post('/admin/update-content', (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    res.redirect('/admin?msg=CONTENT_UPDATED');
});

/* ==========================================================================
   MOTEUR CRON : DISTRIBUTION DES GAINS AUTOMATIQUES (24H)
   ========================================================================== */

setInterval(() => {
    console.log("[SYSTEM] Analyse des cycles de gains...");
    users.forEach(user => {
        if (user.pack !== "Aucun" && user.investDate) {
            const now = new Date();
            const start = new Date(user.investDate);
            const diffHours = (now - start) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                // Table de Gains Journaliers
                const dailyIncome = { "BRONZE": 5000, "SILVER": 15000, "GOLD": 40000, "DIAMOND": 100000 };
                const gain = dailyIncome[user.pack] || 0;
                
                user.bonus += gain;
                user.investDate = new Date(); // Redémarre le cycle de 24h
                console.log(`[GAIN AUTO] +${gain} FC crédités à ${user.username}`);
            }
        }
    });
}, 1000 * 60 * 30); // Vérifie chaque 30 minutes

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// LANCEMENT DU SERVEUR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ============================================================
    CASH LINK TERMINAL v5.6 OPÉRATIONNEL
    PORT: ${PORT} | RÉGION: RDC (2026)
    ============================================================
    `);
});
