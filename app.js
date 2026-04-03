/**
 * ==============================================================================
 * CASHLINK ELITE v27.0 - SYSTÈME DE GESTION BANCAIRE & MINAGE (RDC 2026)
 * ------------------------------------------------------------------------------
 * ARCHITECTURE : MVC (Model-View-Controller) avec Persistance NeDB
 * MODULES : CMS Dynamique, Banking Engine, Validation TID, Gestion Retraits
 * DÉPLOIEMENT : OPTIMISÉ POUR RENDER.COM (Utilisation de /tmp)
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// ---------------------------------------------------------
// 1. CONFIGURATION DU STOCKAGE (PERSISTANCE RDC)
// ---------------------------------------------------------
const dbPath = '/tmp/cashlink_v27_final_master';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [SYSTEM] Base de données initialisée avec succès.");
    } catch (e) {
        console.error("⚠️ [SYSTEM] Erreur de création du répertoire.");
    }
}

// Initialisation des bases de données spécialisées
const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'site_config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'activity_logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true })
};

// ---------------------------------------------------------
// 2. CONFIGURATION DU SERVEUR
// ---------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

app.use(session({
    secret: 'anash_master_ultra_high_security_key_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// ---------------------------------------------------------
// 3. LOGIQUE CMS : LES DONNÉES PILOTABLES PAR L'ADMIN
// ---------------------------------------------------------
const MASTER_UID = "ANASH_MASTER_SESSION_2026"; // ID UNIQUE SYNC

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
    
    // NUMÉROS DE PAIEMENT (L'ADMIN LES CHANGE ICI)
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    
    // SECTIONS LÉGALES (POUR LE DASHBOARD)
    about_text: "Cashlink Elite est la plateforme leader du minage décentralisé en RDC. Fondée en 2026, nous démocratisons l'accès aux revenus numériques.",
    rules_text: "1. Un seul compte par personne.\n2. Retraits traités sous 24h.\n3. Minimum de retrait : 1.000 FC.\n4. Toute fraude entraîne le blocage.",
    contact_address: "Immeuble Elite, Blvd du 30 Juin, Kinshasa, RDC",
    contact_email: "support@cashlink-elite.cd",
    contact_phone: "+243 810 000 000",
    
    // PARAMÈTRES TECHNIQUES
    min_retrait: 1000,
    footer_text: "CASHLINK ELITE v3.0 - DÉPLOYÉ SUR TERMINAL RDC",
    footer_sub: "Sécurisé par Protocole Blockchain 2026"
};

// Injection automatique de la config si vide
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_SITE_CONTENT);
});

// Packs techniques (Bonus gérés par l'Admin lors de la validation)
const PACKS_CONFIG = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

// ---------------------------------------------------------
// 4. MOTEURS DE CALCULS ET LOGS
// ---------------------------------------------------------

function getMiningProgress(startDate) {
    if (!startDate) return "0.0";
    try {
        const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function addSystemLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// ---------------------------------------------------------
// 5. ROUTES CLIENTS (DASHBOARD)
// ---------------------------------------------------------

app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_UID, username: "ANASH MASTER", phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

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

app.get('/dashboard', (req, res) => res.redirect('/'));

// ---------------------------------------------------------
// 6. LOGIQUE BANCAIRE (RETRAITS)
// ---------------------------------------------------------

app.post('/retrait', (req, res) => {
    const amount = Number(req.body.montant);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            const min = site.min_retrait || 1000;
            if (user && user.bonus >= amount && amount >= min) {
                // Déduction immédiate du bonus client
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -amount } }, {}, () => {
                    const reqData = {
                        userId: MASTER_UID, username: user.username,
                        montant: amount, statut: "En attente",
                        date: new Date().toLocaleString(), ts: Date.now()
                    };
                    db.retraits.insert(reqData, () => {
                        addSystemLog("RETRAIT", `Demande de ${amount} FC initiée.`);
                        res.redirect('/?msg=SUCCESS');
                    });
                });
            } else { res.redirect('/?err=FONDS'); }
        });
    });
});

// ---------------------------------------------------------
// 7. ADMINISTRATION CENTRALE (LE TERMINAL)
// ---------------------------------------------------------

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
                                soldeGlobal: users.reduce((acc, u) => acc + (u.solde || 0), 0)
                            },
                            content: site || INITIAL_SITE_CONTENT
                        });
                    });
                });
            });
        });
    });
});

/**
 * CMS : SAUVEGARDE DE TOUTE LA CONFIGURATION (NUMÉROS ET TEXTES)
 */
app.post('/admin/update-content', (req, res) => {
    const updateData = { ...req.body };
    if(updateData.min_retrait) updateData.min_retrait = Number(updateData.min_retrait);

    db.config.update({ _id: "UI_CONTENT" }, { $set: updateData }, {}, () => {
        addSystemLog("CMS", "L'administrateur a modifié les paramètres du site.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION DE DÉPÔT : SOLDE + BONUS CADEAU
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        
        // Extraction du pack pour donner le bonus correct
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_CONFIG[packKey] ? PACKS_CONFIG[packKey].bonus : 0;

        db.users.update({ _id: MASTER_UID }, { $inc: { solde: tx.montant, bonus: bonusAmount } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                addSystemLog("ADMIN", `Validation TID ${tx.reference}. Solde +${tx.montant} / Bonus +${bonusAmount}`);
                res.redirect('/admin');
            });
        });
    });
});

/**
 * PAIEMENT DES RETRAITS
 */
app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        addSystemLog("ADMIN", "Un retrait a été marqué comme payé.");
        res.redirect('/admin');
    });
});

// ---------------------------------------------------------
// 8. ACTIONS CLIENTS (INVESTISSEMENT)
// ---------------------------------------------------------

app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente", ts: Date.now(),
        date: new Date().toLocaleString()
    };
    db.tx.insert(tx, () => res.redirect('/?msg=TID_SEND'));
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                addSystemLog("MINING", `Activation de la machine ${req.body.packName}`);
                res.redirect('/');
            });
        } else { res.redirect('/?err=SOLDE'); }
    });
});

// ---------------------------------------------------------
// 9. SÉCURITÉ ET MAINTENANCE
// ---------------------------------------------------------
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/admin/wipe-system-2026', (req, res) => {
    if (req.query.key === "ANASH_MASTER_WIPE") {
        db.users.remove({}, { multi: true });
        db.tx.remove({}, { multi: true });
        db.retraits.remove({}, { multi: true });
        db.logs.remove({}, { multi: true });
        res.redirect('/');
    }
});

// ---------------------------------------------------------
// 10. LANCEMENT DU MOTEUR
// ---------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log("💎 CASHLINK ELITE v27.0 - SYSTÈME INDUSTRIEL ACTIF");
    console.log(`🌍 PORT : ${PORT}`);
    console.log("====================================================");
});
