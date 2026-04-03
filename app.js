/**
 * ============================================================
 * CASHLINK ELITE v11.0 - SYSTÈME DE CONTRÔLE TOTAL
 * FIX RENDRE : ZÉRO REDIRECTION (AFFICHAGE DIRECT)
 * FONCTION : PILOTAGE CMS + LOGIQUE FINANCIÈRE
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION BASES DE DONNÉES (MODE SURVIE CLOUD) ---
const dbPath = '/tmp/cashlink_v11_data';
if (!fs.existsSync(dbPath)) {
    try { fs.mkdirSync(dbPath, { recursive: true }); } catch (e) {}
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'activity.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultra_2026_fixed',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES CMS (TEXTES MODIFIABLES VIA ADMIN) ---
const INITIAL_SITE_CONTENT = {
    _id: "UI_CONTENT",
    tag_tech: "TECHNOLOGIE RDC 2026",
    titre_principal: "MINAGE AUTO",
    description: "Générez des profits passifs sécurisés grâce à nos fermes de minage décentralisées.",
    puissance_hash: "0.00 TH/s",
    reseau_status: "Actif",
    securite_type: "SSL-256",
    retraits_status: "Ouverts",
    footer_text: "CASHLINK ELITE v3.0 - DÉPLOYÉ SUR TERMINAL RDC",
    footer_sub: "Sécurisé par Protocole Blockchain 2026",
    admin_voda: "0810000000",
    admin_airtel: "0990000000"
};

// Initialisation de la configuration
db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: INITIAL_SITE_CONTENT }, { upsert: true });

const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

const MASTER_UID = "ANASH_MASTER_SESSION_2026";

// --- 4. FONCTIONS DE CALCUL & LOGS ---

function getMiningProgress(startDate) {
    if (!startDate) return 0;
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    return Math.min((diff / 30) * 100, 100).toFixed(2);
}

function addLogEntry(text) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), text: text });
}

// --- 5. LA ROUTE UNIQUE (PLUS DE REDIRECTION = PLUS DE BUG) ---

/**
 * Route / : Elle gère la création ET l'affichage du Dashboard en un seul bloc.
 * C'est la solution pour arriver directement devant ton Dashboard.
 */
app.get('/', (req, res) => {
    const userSeed = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // 1. Assurer l'existence de l'user sans redirect
    db.users.update({ _id: MASTER_UID }, { $set: userSeed }, { upsert: true }, (err) => {
        
        // 2. Récupérer l'user + la config des textes
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                
                const progress = getMiningProgress(user.investDate);
                
                // 3. AFFICHAGE DIRECT
                res.render('dashboard', {
                    user: user,
                    p: progress,
                    content: site || INITIAL_SITE_CONTENT
                });
            });
        });
    });
});

// --- 6. LOGIQUE ADMINISTRATION ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ date: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ date: -1 }).limit(10).exec((err, logs) => {
                    
                    const stats = {
                        totalUsers: (users || []).length,
                        enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                        soldeTotalUsers: (users || []).reduce((acc, u) => acc + (u.solde || 0), 0)
                    };

                    res.render('admin', {
                        users: users || [],
                        transactions: txs || [],
                        stats: stats,
                        site: site || INITIAL_SITE_CONTENT,
                        messages: logs || []
                    });
                });
            });
        });
    });
});

// Mise à jour des textes (TECHNOLOGIE RDC, etc.)
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        addLogEntry("Mise à jour des textes promotionnels par l'Admin");
        res.redirect('/admin');
    });
});

// Validation des paiements (Solde + Bonus)
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        db.users.update({ _id: tx.userId }, { 
            $inc: { solde: tx.montant, bonus: bonusAmount } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                addLogEntry(`TID ${tx.reference} validé (+${bonusAmount} Bonus)`);
                res.redirect('/admin');
            });
        });
    });
});

// --- 7. FLUX CLIENT (INVESTISSEMENT) ---

app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR')
    };
    db.tx.insert(tx, () => {
        addLogEntry(`Nouveau TID soumis : ${reference}`);
        res.redirect('/?msg=TID_OK');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                addLogEntry(`Minage activé : Pack ${req.body.packName}`);
                res.redirect('/');
            });
        } else {
            res.redirect('/?err=SOLDE');
        }
    });
});

// --- 8. DÉMARRAGE ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log(`🚀 MASTER ENGINE v11.0 DÉPLOYÉ SUR TERMINAL RDC`);
    console.log(`🌍 ACCÈS DIRECT SUR PORT : ${PORT}`);
    console.log("====================================================");
});
