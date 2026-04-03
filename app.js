/**
 * CASHLINK ELITE v4.0 - Moteur de Minage Décentralisé
 * Développé pour déploiement Cloud (Render/Replit/GitHub)
 * Gestion complète : Solde, Bonus, Packs et Validation Admin
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION DES BASES DE DONNÉES ---
// Création du dossier database si absent pour éviter les erreurs d'écriture
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log("📁 Dossier Database créé avec succès.");
}

const db = {
    users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbDir, 'transactions.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbDir, 'system_logs.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ET MIDDLEWARES ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuration de la session avec une clé sécurisée
app.use(session({
    secret: 'cashlink_elite_ultra_secure_2026_prod',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Session de 24 heures
}));

// --- 3. LOGIQUE MÉTIER ET PARAMÉTRAGE DES PACKS ---
const CONFIG_ELITE = {
    brand_name: "CASHLINK ELITE",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    min_retrait: 1000,
    cycle_jours: 30
};

const PACKS_SYSTEM = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000,   color: '#10b981' },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000,   color: '#6366f1' },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000,  color: '#f59e0b' },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000, color: '#f43f5e' }
};

// ID Unique pour le compte de test principal
const MASTER_USER_ID = "ANASH_ELITE_PROD_USER";

// --- 4. FONCTIONS UTILITAIRES ---

/**
 * Enregistre une activité dans les logs du système
 */
function logActivity(type, message, userId = "SYSTEM") {
    const entry = {
        timestamp: new Date().toISOString(),
        type,
        message,
        userId
    };
    db.logs.insert(entry);
    console.log(`[${type}] ${message}`);
}

/**
 * Calcule la progression du minage en pourcentage
 */
function calculateProgression(investDate) {
    if (!investDate) return 0;
    const start = new Date(investDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const percent = (diffDays / CONFIG_ELITE.cycle_jours) * 100;
    return Math.min(percent, 100).toFixed(1);
}

// --- 5. ROUTES DE NAVIGATION ---

/**
 * Route Racine : Point d'entrée unique
 * Assure la création du compte Master et initialise la session
 */
app.get('/', (req, res) => {
    const masterAccount = {
        _id: MASTER_USER_ID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0,
        bonus: 0,
        pack: 'Aucun',
        investDate: null,
        certified: true,
        lastLogin: new Date().toISOString()
    };

    db.users.update({ _id: MASTER_USER_ID }, { $set: masterAccount }, { upsert: true }, (err) => {
        if (err) return res.send("Erreur d'initialisation de la base de données.");
        req.session.userId = MASTER_USER_ID;
        logActivity("AUTH", "Connexion automatique de l'utilisateur Master");
        res.redirect('/dashboard');
    });
});

/**
 * Dashboard : Interface principale du client
 */
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (!user) return res.redirect('/');

        const progression = calculateProgression(user.investDate);

        res.render('dashboard', {
            user: user,
            p: progression,
            content: CONFIG_ELITE,
            packs: PACKS_SYSTEM
        });
    });
});

// --- 6. ROUTES D'ACTIONS FINANCIÈRES ---

/**
 * Envoi de TID (Demande de recharge du solde)
 */
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;

    if (!reference || reference.length < 4) {
        return res.redirect('/dashboard?msg=TID_INVALIDE');
    }

    const transaction = {
        userId: req.session.userId,
        username: "ANASH MASTER",
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR'),
        createdAt: new Date().toISOString()
    };

    db.tx.insert(transaction, (err) => {
        logActivity("TRANSACTION", `Nouveau TID reçu: ${reference} pour le pack ${packName}`, req.session.userId);
        res.redirect('/dashboard?msg=TID_ENVOYE_ATTENTE_VALIDATION');
    });
});

/**
 * Activation de l'investissement (Passage du solde au minage actif)
 */
app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    const montantPack = Number(prix);

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (err || !user) return res.redirect('/dashboard?msg=ERREUR_COMPTE');

        if (user.solde >= montantPack) {
            const updateData = {
                $set: {
                    solde: user.solde - montantPack,
                    pack: packName,
                    investDate: new Date().toISOString()
                }
            };

            db.users.update({ _id: user._id }, updateData, {}, (err) => {
                logActivity("INVEST", `Activation du pack ${packName} réussie`, user._id);
                res.redirect('/dashboard?msg=MINAGE_LANCE_AVEC_SUCCES');
            });
        } else {
            res.redirect('/dashboard?msg=SOLDE_INSUFFISANT');
        }
    });
});

/**
 * Demande de retrait
 */
app.post('/retrait', (req, res) => {
    const { montant } = req.body;
    const val = Number(montant);

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (val >= CONFIG_ELITE.min_retrait && user.bonus >= val) {
            // Logique de retrait simplifiée pour le test
            db.users.update({ _id: user._id }, { $inc: { bonus: -val } }, {}, () => {
                logActivity("WITHDRAW", `Demande de retrait de ${val} FC enregistrée`, user._id);
                res.redirect('/dashboard?msg=RETRAIT_EN_COURS');
            });
        } else {
            res.redirect('/dashboard?msg=MONTANT_INVALIDE');
        }
    });
});

// --- 7. ROUTES ADMINISTRATION ---

/**
 * Interface Admin : Vue d'ensemble du système
 */
app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        const safeUsers = users || [];
        db.tx.find({}).sort({ createdAt: -1 }).exec((err, transactions) => {
            const safeTx = transactions || [];

            let totalInvesti = 0;
            safeUsers.forEach(u => totalInvesti += (Number(u.solde) || 0));

            const stats = {
                totalUsers: safeUsers.length,
                enAttente: safeTx.filter(t => t.statut === "En attente").length,
                soldeTotalUsers: totalInvesti,
                transactionsTotal: safeTx.length
            };

            res.render('admin', {
                users: safeUsers,
                transactions: safeTx,
                stats: stats,
                messages: [],
                content: CONFIG_ELITE
            });
        });
    });
});

/**
 * Validation Admin (Crédite le solde + Bonus)
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;

    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx || tx.statut !== "En attente") return res.redirect('/admin?msg=TX_INTROUVABLE');

        // Extraction dynamique du bonus selon le pack mentionné dans la transaction
        const packName = tx.type.replace("ACHAT ", "");
        const bonusConfig = PACKS_SYSTEM[packName] ? PACKS_SYSTEM[packName].bonus : 0;

        // Mise à jour de l'utilisateur : Crédit solde et Bonus
        db.users.update({ _id: tx.userId }, {
            $inc: { solde: tx.montant, bonus: bonusConfig }
        }, {}, (err) => {
            // Mise à jour de la transaction
            db.tx.update({ _id: txId }, { $set: { statut: "Validé", validatedAt: new Date().toISOString() } }, {}, () => {
                logActivity("ADMIN_ACTION", `Transaction ${tx.reference} validée. Bonus de ${bonusConfig} FC octroyé.`);
                res.redirect('/admin?msg=VALIDATION_EFFECTUEE');
            });
        });
    });
});

// --- 8. GESTION DES ERREURS ET DECONNEXION ---

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Capture des routes inexistantes (404)
app.use((req, res) => {
    res.status(404).send("Page introuvable sur le serveur Cashlink.");
});

// --- 9. DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log(`🚀 SERVEUR ${CONFIG_ELITE.brand_name} DÉMARRÉ`);
    console.log(`🌍 URL LOCALE : http://localhost:${PORT}`);
    console.log(`🛡️  MODE : DÉVELOPPEMENT & PRODUCTION`);
    console.log("====================================================");
});
