/**
 * ==============================================================================
 * CASHLINK ELITE v27.1 - CORRECTIF SYNC ADMIN (RDC 2026)
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// 1. STOCKAGE
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

// 2. SERVEUR
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

// 3. INITIALISATION CMS (Inclusion des nouveaux champs légaux)
const MASTER_UID = "ANASH_MASTER_SESSION_2026";

const INITIAL_SITE_CONTENT = {
    _id: "UI_CONTENT",
    brand_name: "CASHLINK ELITE",
    tag_tech: "TECHNOLOGIE RDC 2026",
    titre_principal: "MINAGE AUTO",
    description: "Générez des profits passifs sécurisés grâce à nos fermes de minage décentralisées.",
    puissance_hash: "0.00 TH/s",
    reseau_status: "Actif",
    securite_type: "SSL-256",
    retraits_status: "Ouverts",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    about_text: "Cashlink Elite est la plateforme leader du minage décentralisé en RDC...",
    rules_text: "1. Un seul compte par personne...",
    contact_address: "Immeuble Elite, Blvd du 30 Juin, Kinshasa, RDC",
    contact_email: "support@cashlink-elite.cd",
    contact_phone: "+243 810 000 000",
    footer_text: "CASHLINK ELITE v3.0",
    footer_sub: "Sécurisé par Protocole Blockchain 2026",
    min_retrait: 1000
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

// 4. MOTEURS
function getMiningProgress(startDate) {
    if (!startDate) return "0.0";
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    return Math.min((diff / 30) * 100, 100).toFixed(1);
}

function addSystemLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// 5. DASHBOARD
app.get('/', (req, res) => {
    const defaultUser = { _id: MASTER_UID, username: "ANASH MASTER", solde: 0, bonus: 0, pack: 'Aucun', investDate: null };
    db.users.update({ _id: MASTER_UID }, { $set: { lastVisit: new Date().toISOString() } }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('dashboard', {
                    user: user || defaultUser,
                    p: getMiningProgress(user ? user.investDate : null),
                    content: site || INITIAL_SITE_CONTENT,
                    packs: PACKS_CONFIG
                });
            });
        });
    });
});

// 6. RETRAITS
app.post('/retrait', (req, res) => {
    const amount = Number(req.body.montant);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            if (user && user.bonus >= amount && amount >= (site.min_retrait || 1000)) {
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -amount } }, {}, () => {
                    db.retraits.insert({
                        userId: MASTER_UID, username: user.username, montant: amount,
                        statut: "En attente", date: new Date().toLocaleString(), ts: Date.now()
                    }, () => {
                        addSystemLog("RETRAIT", `Nouveau retrait de ${amount} FC à valider !`);
                        res.redirect('/?msg=SUCCESS');
                    });
                });
            } else { res.redirect('/?err=FONDS'); }
        });
    });
});

// 7. ADMIN (TERMINAL)
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

// 8. UPDATE CONTENT (Correction : On accepte TOUT le body envoyé par l'admin)
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        addSystemLog("CMS", "Mise à jour globale effectuée.");
        res.redirect('/admin#interface'); 
    });
});

// 9. VALIDATIONS & PAIEMENTS
app.post('/valider-depot', (req, res) => {
    db.tx.findOne({ _id: req.body.txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonus = PACKS_CONFIG[packKey] ? PACKS_CONFIG[packKey].bonus : 0;
        db.users.update({ _id: MASTER_UID }, { $inc: { solde: tx.montant, bonus: bonus } }, {}, () => {
            db.tx.update({ _id: tx._id }, { $set: { statut: "Validé" } }, {}, () => {
                addSystemLog("ADMIN", `TID ${tx.reference} validé.`);
                res.redirect('/admin');
            });
        });
    });
});

app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        addSystemLog("ADMIN", "Paiement confirmé.");
        res.redirect('/admin');
    });
});

// 10. PACKS & INVEST
app.post('/souscrire-pack', (req, res) => {
    db.tx.insert({
        userId: MASTER_UID, type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix), reference: req.body.reference,
        statut: "En attente", ts: Date.now(), date: new Date().toLocaleString()
    }, () => {
        addSystemLog("DÉPÔT", `Nouveau TID ${req.body.reference} soumis !`); // Alerte Admin
        res.redirect('/?msg=TID_SEND');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => res.redirect('/'));
        } else { res.redirect('/?err=SOLDE'); }
    });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("💎 CASHLINK ELITE v27.1 INDUSTRIEL ACTIF");
});
