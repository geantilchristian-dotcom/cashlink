/**
 * ==============================================================================
 * CASHLINK ELITE v27.5 - RÉSOLUTIONS DES ERREURS DE SAUVEGARDE (RDC 2026)
 * ------------------------------------------------------------------------------
 * CORRECTIF : Suppression des contraintes d'ID pour permettre l'écriture libre.
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. STOCKAGE ---
const dbPath = '/tmp/cashlink_v27_final_master';
if (!fs.existsSync(dbPath)) {
    try { fs.mkdirSync(dbPath, { recursive: true }); } catch (e) {}
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'site_config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'activity_logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true })
};

// --- 2. CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultra_high_security_key_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// --- 3. DONNÉES PAR DÉFAUT ---
const MASTER_UID = "ANASH_MASTER_SESSION_2026";
const INITIAL_SITE_CONTENT = {
    _id: "UI_CONTENT",
    brand_name: "CASHLINK ELITE",
    tag_tech: "TECHNOLOGIE RDC 2026",
    titre_principal: "MINAGE AUTO",
    description: "Générez des profits passifs sécurisés.",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    puissance_hash: "104.2 TH/s",
    reseau_status: "Actif",
    securite_type: "SSL-256",
    retraits_status: "Ouverts",
    about_text: "Elite plateforme RDC...",
    rules_text: "Règles...",
    contact_address: "Kinshasa, RDC",
    contact_email: "support@cashlink.cd",
    contact_phone: "+243",
    min_retrait: 1000,
    footer_text: "CASHLINK ELITE",
    footer_sub: "2026"
};

db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_SITE_CONTENT);
});

const PACKS_CONFIG = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

// --- 4. MOTEURS ---
function getMiningProgress(startDate) {
    if (!startDate) return "0.0";
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    return Math.min((diff / 30) * 100, 100).toFixed(1);
}

function addSystemLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// --- 5. DASHBOARD ---
app.get('/', (req, res) => {
    const defaultUser = { _id: MASTER_UID, username: "ANASH MASTER", solde: 0, bonus: 0, pack: 'Aucun', investDate: null };
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            const activeUser = user || defaultUser;
            const progress = (activeUser && activeUser.investDate) ? getMiningProgress(activeUser.investDate) : "0.0";
            res.render('dashboard', {
                user: activeUser,
                p: progress,
                content: site || INITIAL_SITE_CONTENT,
                packs: PACKS_CONFIG
            });
        });
    });
});

// --- 6. SAUVEGARDE ADMIN (VERSION RÉPARÉE) ---
app.post('/admin/update-content', (req, res) => {
    const updateData = req.body;
    
    // On retire l'ID s'il est présent dans le body pour éviter les conflits NeDB
    delete updateData._id;

    // On force la mise à jour de l'unique document de config
    db.config.update({ _id: "UI_CONTENT" }, { $set: updateData }, { upsert: true }, (err) => {
        if (err) {
            console.log("Erreur NeDB:", err);
            return res.redirect('/admin?err=SAVE_FAILED');
        }
        
        // On force NeDB à écrire sur le disque immédiatement
        db.config.persistence.compactDatafile();
        
        addSystemLog("CMS", "Informations du site mises à jour.");
        
        setTimeout(() => { res.redirect('/admin'); }, 500);
    });
});

// --- 7. ADMIN TERMINAL ---
app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ ts: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ ts: -1 }).limit(25).exec((err, logs) => {
                    db.retraits.find({}).sort({ ts: -1 }).exec((err, requests) => {
                        res.render('admin', {
                            users, transactions: txs, site: site || INITIAL_SITE_CONTENT,
                            messages: logs, retraits: requests || [],
                            stats: {
                                totalUsers: users.length,
                                enAttente: txs.filter(t => t.statut === "En attente").length,
                                soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0)
                            }
                        });
                    });
                });
            });
        });
    });
});

// --- 8. VALIDATIONS ---
app.post('/valider-depot', (req, res) => {
    db.tx.findOne({ _id: req.body.txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonus = PACKS_CONFIG[packKey] ? PACKS_CONFIG[packKey].bonus : 0;
        db.users.update({ _id: MASTER_UID }, { $inc: { solde: tx.montant, bonus: bonus } }, { upsert: true }, () => {
            db.tx.update({ _id: tx._id }, { $set: { statut: "Validé" } }, {}, () => {
                res.redirect('/admin');
            });
        });
    });
});

app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        res.redirect('/admin');
    });
});

app.post('/retrait', (req, res) => {
    const amount = Number(req.body.montant);
    db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -amount } }, {}, () => {
        db.retraits.insert({
            userId: MASTER_UID, username: "ANASH", montant: amount,
            statut: "En attente", date: new Date().toLocaleString(), ts: Date.now()
        }, () => { res.redirect('/?msg=SUCCESS'); });
    });
});

app.post('/souscrire-pack', (req, res) => {
    db.tx.insert({
        userId: MASTER_UID, type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix), reference: req.body.reference,
        statut: "En attente", ts: Date.now(), date: new Date().toLocaleString()
    }, () => { res.redirect('/?msg=TID_SEND'); });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.update({ _id: MASTER_UID }, {
        $set: { solde: 0, pack: req.body.packName, investDate: new Date().toISOString() }
    }, { upsert: true }, () => res.redirect('/'));
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("💎 CASHLINK v27.5 INDUSTRIEL ACTIF");
});
