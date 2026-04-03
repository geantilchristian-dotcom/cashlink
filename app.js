/**
 * CASHLINK ELITE v4.5 - PRODUCTION LIVE
 * MODE : ACCÈS DIRECT SANS INSCRIPTION
 * Ce code force la création du compte Master à chaque chargement.
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. BASES DE DONNÉES (AUTO-RECHARGEMENT) ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = {
    users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbDir, 'transactions.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Session configurée pour durer longtemps
app.use(session({
    secret: 'cashlink_ultra_secret_live_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // 1 an
}));

// --- 3. PARAMÈTRES ET LOGIQUE DES PACKS ---
const CONFIG_ELITE = {
    brand_name: "CASHLINK ELITE",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000"
};

const PACKS_SYSTEM = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000 }
};

// ID Permanent pour ton compte
const MASTER_ID = "ANASH_MASTER_LIVE_SESSION";

// --- 4. MIDDLEWARE D'AUTO-CONNEXION (LA CLÉ DU PROBLÈME) ---
// Ce code s'exécute à chaque requête pour s'assurer que tu es TOUJOURS connecté
app.use((req, res, next) => {
    const defaultUser = {
        _id: MASTER_ID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0,
        bonus: 0,
        pack: 'Aucun',
        investDate: null,
        certified: true
    };

    // On vérifie si l'utilisateur existe dans la DB
    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (!user) {
            // Si Render a effacé la DB, on recrée l'user instantanément
            db.users.insert(defaultUser, (err, newUser) => {
                req.session.userId = MASTER_ID;
                next();
            });
        } else {
            // Si l'user existe, on s'assure que la session est active
            req.session.userId = MASTER_ID;
            next();
        }
    });
});

// --- 5. ROUTES DE NAVIGATION ---

// Route racine : Redirige directement vers le Dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Dashboard : Interface avec calculs de progression
app.get('/dashboard', (req, res) => {
    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (!user) return res.redirect('/');

        let progression = 0;
        if (user.investDate && user.pack && user.pack !== 'Aucun') {
            const start = new Date(user.investDate);
            const now = new Date();
            const diffDays = (now - start) / (1000 * 60 * 60 * 24);
            progression = Math.min((diffDays / 30) * 100, 100);
        }

        res.render('dashboard', {
            user: user,
            p: progression.toFixed(1),
            content: CONFIG_ELITE
        });
    });
});

// --- 6. ACTIONS FINANCIÈRES (DASHBOARD -> ADMIN) ---

// Envoi de TID
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const tx = {
        userId: MASTER_ID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR'),
        createdAt: new Date().toISOString()
    };

    db.tx.insert(tx, () => {
        res.redirect('/dashboard?msg=SUCCESS_TID');
    });
});

// Activation Investissement (Déduction solde)
app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    const montant = Number(prix);

    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (user && user.solde >= montant) {
            db.users.update({ _id: MASTER_ID }, { 
                $set: { 
                    solde: user.solde - montant,
                    pack: packName, 
                    investDate: new Date().toISOString()
                } 
            }, {}, () => {
                res.redirect('/dashboard?msg=MINAGE_ACTIF');
            });
        } else {
            res.redirect('/dashboard?msg=SOLDE_INSUFFISANT');
        }
    });
});

// --- 7. ADMINISTRATION ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ createdAt: -1 }).exec((err, txs) => {
            const stats = {
                totalUsers: (users || []).length,
                enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                soldeTotal: 0
            };
            res.render('admin', {
                users: users || [],
                transactions: txs || [],
                stats: stats,
                messages: [],
                content: CONFIG_ELITE
            });
        });
    });
});

// Validation Admin (Recharge + Bonus)
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packName = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_SYSTEM[packName] ? PACKS_SYSTEM[packName].bonus : 0;

        db.users.update({ _id: tx.userId }, { 
            $inc: { solde: tx.montant, bonus: bonusAmount } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                res.redirect('/admin?msg=VALIDATED');
            });
        });
    });
});

// --- 8. LANCEMENT ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVEUR CASHLINK LIVE : PORT ${PORT}`);
});
