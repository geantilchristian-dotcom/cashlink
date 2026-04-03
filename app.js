/**
 * ============================================================
 * PROJET : CASHLINK ELITE v5.5 - ÉDITION PROFESSIONNELLE
 * ARCHITECTURE : MONOLITHIQUE POUR DÉPLOIEMENT CLOUD (RENDER)
 * FONCTIONNALITÉS : AUTO-LOGIN, CALCULS DE MINAGE, ADMIN SYNC
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. GESTION DES RÉPERTOIRES ET BASES DE DONNÉES ---
const databasePath = path.join(__dirname, 'database');
if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath, { recursive: true });
    console.log("📂 [SYSTEM] Création du dossier database pour Render.");
}

// Initialisation des collections NeDB
const db = {
    users: new Datastore({ filename: path.join(databasePath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(databasePath, 'transactions.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(databasePath, 'system.log.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ET DES MIDDLEWARES ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuration de session renforcée pour éviter les boucles de redirection
app.use(session({
    secret: 'cashlink_elite_master_security_key_2026_anash',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Mettre à true si HTTPS est forcé sur Render
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// --- 3. LOGIQUE MÉTIER : CONFIGURATION DES GAINS ET PACKS ---
const APP_CONFIG = {
    brand_name: "CASHLINK ELITE",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    min_retrait: 1000,
    cycle_mining: 30 // jours
};

const ELITE_PACKS = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000,   color: '#10b981' },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000,   color: '#6366f1' },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000,  color: '#f59e0b' },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000, color: '#f43f5e' }
};

// Identifiant statique pour l'accès direct sans inscription
const MASTER_UID = "ANASH_MASTER_PRODUCTION";

// --- 4. FONCTIONS UTILITAIRES (LOGS ET CALCULS) ---

function writeLog(type, message, userId = "SYSTEM") {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        userId: userId
    };
    db.logs.insert(logEntry);
    console.log(`[${type}] ${message}`);
}

function getMiningProgress(startDate) {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    const diff = now - start;
    const days = diff / (1000 * 60 * 60 * 24);
    const progress = (days / APP_CONFIG.cycle_mining) * 100;
    return Math.min(progress, 100).toFixed(1);
}

// --- 5. ROUTES DE NAVIGATION (ACCÈS DIRECT) ---

/**
 * Route Racine : Évite les redirections infinies
 * On traite l'utilisateur et on affiche le dashboard sur la même route
 */
app.get('/', (req, res) => {
    const initialUser = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0,
        bonus: 0,
        pack: 'Aucun',
        investDate: null,
        certified: true,
        lastSeen: new Date().toISOString()
    };

    // On force la présence de l'utilisateur dans la DB
    db.users.update({ _id: MASTER_UID }, { $set: initialUser }, { upsert: true }, (err) => {
        if (err) {
            writeLog("ERROR", "Échec de l'initialisation utilisateur");
            return res.status(500).send("Erreur de base de données");
        }

        // On récupère l'user frais pour le dashboard
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            const p = getMiningProgress(user.investDate);
            
            // Rendu direct du Dashboard pour tuer l'erreur de redirection Render
            res.render('dashboard', {
                user: user,
                p: p,
                content: APP_CONFIG,
                packs: ELITE_PACKS
            });
        });
    });
});

// Doublon pour la compatibilité des formulaires
app.get('/dashboard', (req, res) => {
    res.redirect('/');
});

// --- 6. LOGIQUE DES FLUX FINANCIERS (CLIENT) ---

/**
 * Soumission de la preuve de paiement (TID)
 */
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;

    if (!reference || reference.trim() === "") {
        return res.redirect('/?error=tid_manquant');
    }

    const newTransaction = {
        userId: MASTER_UID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR'),
        createdAt: new Date().toISOString()
    };

    db.tx.insert(newTransaction, (err) => {
        writeLog("TX", `Nouveau TID ${reference} soumis pour le pack ${packName}`, MASTER_UID);
        res.redirect('/?msg=TID_RECU');
    });
});

/**
 * Activation du minage avec le solde disponible
 */
app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    const cost = Number(prix);

    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= cost) {
            db.users.update({ _id: MASTER_UID }, {
                $set: {
                    solde: user.solde - cost,
                    pack: packName,
                    investDate: new Date().toISOString()
                }
            }, {}, (err) => {
                writeLog("MINING", `Activation réussie du pack ${packName}`, MASTER_UID);
                res.redirect('/?msg=MINAGE_ACTIF');
            });
        } else {
            res.redirect('/?error=solde_insuffisant');
        }
    });
});

// --- 7. ADMINISTRATION (COMMUNICATION DASHBOARD) ---

/**
 * Route Admin : Surveillance en temps réel
 */
app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        const safeUsers = users || [];
        db.tx.find({}).sort({ createdAt: -1 }).exec((err, txs) => {
            const safeTx = txs || [];
            
            let capitalTotal = 0;
            safeUsers.forEach(u => capitalTotal += (Number(u.solde) || 0));

            const stats = {
                totalUsers: safeUsers.length,
                enAttente: safeTx.filter(t => t.statut === "En attente").length,
                tresorerie: capitalTotal
            };

            res.render('admin', {
                users: safeUsers,
                transactions: safeTx,
                stats: stats,
                messages: [],
                content: APP_CONFIG
            });
        });
    });
});

/**
 * Validation Admin : Transfert solde + bonus au Dashboard
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;

    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx || tx.statut !== "En attente") return res.redirect('/admin');

        // On récupère dynamiquement le bonus du pack choisi
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusConfig = ELITE_PACKS[packKey] ? ELITE_PACKS[packKey].bonus : 0;

        // Mise à jour de l'utilisateur
        db.users.update({ _id: tx.userId }, {
            $inc: { solde: tx.montant, bonus: bonusConfig }
        }, {}, (err) => {
            // Confirmation de la transaction
            db.tx.update({ _id: txId }, { $set: { statut: "Validé", validatedAt: new Date().toISOString() } }, {}, () => {
                writeLog("ADMIN", `Validation TID ${tx.reference}. Crédit: ${tx.montant} + Bonus: ${bonusConfig}`);
                res.redirect('/admin?success=1');
            });
        });
    });
});

// --- 8. GESTION DU SERVEUR ET SÉCURITÉ ---

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Capture des erreurs 404
app.use((req, res) => {
    res.status(404).send("<h1>404</h1><p>Route Cashlink non trouvée.</p><a href='/'>Retour</a>");
});

// Lancement dynamique (Requis pour Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log(`💎 SERVEUR LIVE : ${APP_CONFIG.brand_name}`);
    console.log(`🚀 PORT : ${PORT}`);
    console.log(`📂 DB PATH : ${databasePath}`);
    console.log("====================================================");
});
