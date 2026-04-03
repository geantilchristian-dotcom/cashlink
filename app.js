/**
 * ==============================================================================
 * CASHLINK ELITE v15.0 - TERMINAL BANCAIRE ET MINAGE (ÉDITION 600 LIGNES)
 * DÉPLOIEMENT : OPTIMISÉ POUR RENDER.COM / GITHUB
 * MODULES : DASHBOARD, ADMIN CMS, GESTION DES RETRAITS, LOGS SYSTÈME
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. ARCHITECTURE DES DONNÉES (PERSISTANCE RENDER FIX) ---
const dbPath = '/tmp/cashlink_v15_master_data';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [SYSTEM] Répertoire de données initialisé.");
    } catch (e) {
        console.log("⚠️ [SYSTEM] Mode RAM activé.");
    }
}

// Initialisation des bases de données
const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultra_secure_blockchain_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES CMS PAR DÉFAUT ---
const INITIAL_SITE_DATA = {
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
    min_retrait: 1000,
    cover_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2000"
};

// Injection de la config
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_SITE_DATA);
});

// Logiciel des Packs
const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000 }
};

const MASTER_UID = "ANASH_MASTER_SESSION_2026";

// --- 4. MOTEUR DE CALCULS ---

function getSafeMiningProgress(startDate) {
    if (!startDate) return "0.0";
    try {
        const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function sysLogger(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// --- 5. ROUTES CLIENTS (DASHBOARD) ---

app.get('/', (req, res) => {
    const userDefault = {
        _id: MASTER_UID, username: "ANASH MASTER", phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    db.users.update({ _id: MASTER_UID }, { $set: userDefault }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('dashboard', {
                    user: user || userDefault,
                    p: getSafeMiningProgress(user ? user.investDate : null),
                    content: site || INITIAL_SITE_DATA,
                    packs: PACKS_SETTINGS
                });
            });
        });
    });
});

app.get('/dashboard', (req, res) => res.redirect('/'));

// --- 6. ADMINISTRATION TOTALE (CMS + FINANCE) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ ts: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ ts: -1 }).limit(20).exec((err, logs) => {
                    db.retraits.find({}).sort({ ts: -1 }).exec((err, requests) => {
                        res.render('admin', {
                            users, transactions: txs, site: site || INITIAL_SITE_DATA,
                            messages: logs, retraits: requests || [],
                            stats: {
                                totalUsers: users.length,
                                enAttente: txs.filter(t => t.statut === "En attente").length,
                                soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0),
                                bonusTotalUsers: users.reduce((acc, u) => acc + (u.bonus || 0), 0)
                            }
                        });
                    });
                });
            });
        });
    });
});

/**
 * CMS : Mise à jour des textes
 */
app.post('/admin/update-content', (req, res) => {
    const update = {
        tag_tech: req.body.tag_tech,
        titre_principal: req.body.titre_principal,
        puissance_hash: req.body.puissance_hash,
        reseau_status: req.body.reseau_status,
        description: req.body.description,
        securite_type: req.body.securite_type,
        retraits_status: req.body.retraits_status,
        footer_text: req.body.footer_text,
        footer_sub: req.body.footer_sub,
        min_retrait: Number(req.body.min_retrait) || 1000
    };
    db.config.update({ _id: "UI_CONTENT" }, { $set: update }, {}, () => {
        sysLogger("CMS", "Textes du Dashboard mis à jour.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION DEPOT (SOLDE + BONUS)
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx || tx.statut !== "En attente") return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonus = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        db.users.update({ _id: tx.userId }, { $inc: { solde: tx.montant, bonus: bonus } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                sysLogger("ADMIN", `TID ${tx.reference} validé (+${bonus} Bonus)`);
                res.redirect('/admin?msg=OK');
            });
        });
    });
});

// --- 7. LOGIQUE DU BOUTON RETRAIT (IMPORTANT) ---

/**
 * Route du Bouton Retrait : Retire du Bonus et crée une demande
 */
app.post('/retrait', (req, res) => {
    const value = Number(req.body.montant);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            const min = site.min_retrait || 1000;
            if (user && user.bonus >= value && value >= min) {
                // Déduction immédiate pour éviter le double retrait
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -value } }, {}, () => {
                    const reqRetrait = {
                        userId: MASTER_UID,
                        username: user.username,
                        montant: value,
                        statut: "En attente",
                        date: new Date().toLocaleString(),
                        ts: Date.now()
                    };
                    db.retraits.insert(reqRetrait, () => {
                        sysLogger("RETRAIT", `Demande de ${value} FC par ${user.username}`);
                        res.redirect('/?msg=WAIT_PAIE');
                    });
                });
            } else {
                res.redirect('/?err=FONDS');
            }
        });
    });
});

/**
 * Admin : Marquer comme payé
 */
app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        sysLogger("ADMIN", "Retrait payé avec succès.");
        res.redirect('/admin');
    });
});

// --- 8. FLUX INVESTISSEMENTS ---

app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente",
        ts: Date.now()
    };
    db.tx.insert(tx, () => {
        sysLogger("CLIENT", `TID ${req.body.reference} envoyé.`);
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
                sysLogger("MINING", `Pack ${req.body.packName} activé.`);
                res.redirect('/');
            });
        } else { res.redirect('/?err=SOLDE'); }
    });
});

// --- 9. SÉCURITÉ ---
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.get('/admin/wipe-system', (req, res) => {
    if (req.query.key === "ANASH2026") {
        db.users.remove({}, { multi: true });
        db.tx.remove({}, { multi: true });
        db.retraits.remove({}, { multi: true });
        res.redirect('/');
    }
});

// --- 10. LANCEMENT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log("💎 CASHLINK ELITE v15.0 - TERMINAL ACTIF");
    console.log("====================================================");
});
