/**
 * ==============================================================================
 * CASHLINK ELITE v25.0 - ARCHITECTURE INDUSTRIELLE COMPLÈTE
 * ------------------------------------------------------------------------------
 * DÉVELOPPÉ POUR : ANASH MASTER (RDC 2026)
 * * MODULES INCLUS :
 * 1. CMS TOTAL : Pilotage des numéros (Voda, Airtel, Orange), Textes, Pages Légales.
 * 2. BANKING : Gestion des Retraits, TID, Solde et Bonus avec calculs précis.
 * 3. MINING ENGINE : Calculateur de Hash et Progression de cycle (30j).
 * 4. NOTIFICATIONS : Système de toasts animés et simulateur de gains.
 * 5. SECURITY : Protection Render (Anti-Loop), Persistance /tmp et Logs Admin.
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
// 1. GESTION DES RÉPERTOIRES ET BASES DE DONNÉES
// ---------------------------------------------------------
const dbPath = '/tmp/cashlink_v25_industrial_anash';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [DATABASE] Initialisation du système persistant dans /tmp");
    } catch (e) {
        console.error("⚠️ [DATABASE] Mode RAM forcé.");
    }
}

// Initialisation des collections spécialisées
const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true }),
    notifs: new Datastore({ filename: path.join(dbPath, 'notifs.db'), autoload: true })
};

// ---------------------------------------------------------
// 2. CONFIGURATION DU SERVEUR ET SESSIONS
// ---------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

app.use(session({
    secret: 'anash_master_ultra_high_security_key_2026_elite',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // Session d'un an
}));

// ---------------------------------------------------------
// 3. LOGIQUE CMS : LES DONNÉES PILOTÉES PAR L'ADMIN
// ---------------------------------------------------------
const MASTER_UID = "ANASH_MASTER_SESSION_2026";

const INITIAL_SITE_DATA = {
    _id: "UI_CONTENT",
    brand_name: "CASHLINK ELITE",
    tag_tech: "TECHNOLOGIE RDC 2026",
    titre_principal: "MINAGE AUTO",
    description: "Générez des profits passifs sécurisés grâce à nos fermes de minage décentralisées.",
    puissance_hash: "0.00 TH/s",
    reseau_status: "Actif",
    securite_type: "SSL-256",
    retraits_status: "Ouverts",
    
    // NUMÉROS DE PAIEMENT DÉFINIS PAR L'ADMIN
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    
    // SECTIONS LÉGALES ET INFORMATIONNELLES
    about_text: "Cashlink Elite est la plateforme leader du minage décentralisé en RDC. Notre mission est de démocratiser l'accès aux revenus numériques.",
    rules_text: "1. Un seul compte par utilisateur. 2. Les retraits sont traités sous 24h. 3. Le minimum de retrait est de 1.000 FC.",
    contact_address: "Immeuble Elite, Blvd du 30 Juin, Kinshasa, RDC",
    contact_email: "support@cashlink-elite.cd",
    contact_phone: "+243 810 000 000",
    
    // PARAMÈTRES BANCAIRES
    min_retrait: 1000,
    footer_text: "CASHLINK ELITE v3.0 - DÉPLOYÉ SUR TERMINAL RDC",
    footer_sub: "Sécurisé par Protocole Blockchain 2026"
};

// Injection automatique de la config si vide
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_SITE_DATA);
});

// Configuration des Packs
const PACKS_DATABASE = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000,   color: '#10b981' },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000,   color: '#6366f1' },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000,  color: '#f59e0b' },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000, color: '#f43f5e' }
};

// ---------------------------------------------------------
// 4. MOTEURS DE CALCULS ET JOURNALISATION
// ---------------------------------------------------------

function getLiveProgress(startDate) {
    if (!startDate) return "0.0";
    try {
        const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function writeLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// ---------------------------------------------------------
// 5. ROUTES CLIENTS (ZÉRO REDIRECTION POUR RENDER)
// ---------------------------------------------------------

app.get('/', (req, res) => {
    const seedUser = {
        _id: MASTER_UID, username: "ANASH MASTER", phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    db.users.update({ _id: MASTER_UID }, { $set: { lastActive: new Date().toISOString() } }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('dashboard', {
                    user: user || seedUser,
                    p: getLiveProgress(user ? user.investDate : null),
                    content: site || INITIAL_SITE_DATA,
                    packs: PACKS_DATABASE
                });
            });
        });
    });
});

app.get('/dashboard', (req, res) => res.redirect('/'));

// ---------------------------------------------------------
// 6. LOGIQUE BANCAIRE ET RETRAITS
// ---------------------------------------------------------

/**
 * Route de retrait : Déduit le bonus et crée une demande Admin
 */
app.post('/retrait', (req, res) => {
    const amount = Number(req.body.montant);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            const minAllowed = site.min_retrait || 1000;
            if (user && user.bonus >= amount && amount >= minAllowed) {
                // Déduction Dashboard
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -amount } }, {}, () => {
                    const reqRetrait = {
                        userId: MASTER_UID, username: user.username,
                        montant: amount, statut: "En attente",
                        date: new Date().toLocaleString(), ts: Date.now()
                    };
                    db.retraits.insert(reqRetrait, () => {
                        writeLog("RETRAIT", `Demande de ${amount} FC par ${user.username}`);
                        res.redirect('/?msg=SUCCESS_RETRAIT');
                    });
                });
            } else { res.redirect('/?err=FONDS'); }
        });
    });
});

// ---------------------------------------------------------
// 7. ADMINISTRATION CENTRALE (L'ORDINATEUR DE BORD)
// ---------------------------------------------------------

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
                                soldeTotal: users.reduce((acc, u) => acc + (u.solde || 0), 0)
                            },
                            content: site || INITIAL_SITE_DATA
                        });
                    });
                });
            });
        });
    });
});

/**
 * CMS ADMIN : MODIFIER LES NUMÉROS, TEXTES LÉGAUX ET CONFIG
 */
app.post('/admin/update-content', (req, res) => {
    // Synchronisation forcée des types de données
    const data = { ...req.body };
    if(data.min_retrait) data.min_retrait = Number(data.min_retrait);

    db.config.update({ _id: "UI_CONTENT" }, { $set: data }, {}, () => {
        writeLog("CMS", "L'administrateur a modifié la configuration du site.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION DÉPÔT : SOLDE + BONUS CADEAU
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusConfig = PACKS_DATABASE[packKey] ? PACKS_DATABASE[packKey].bonus : 0;

        db.users.update({ _id: MASTER_UID }, { $inc: { solde: tx.montant, bonus: bonusConfig } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                writeLog("ADMIN", `Validation TID ${tx.reference}. Solde et Bonus synchronisés.`);
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
        writeLog("ADMIN", "Retrait client marqué comme payé.");
        res.redirect('/admin');
    });
});

// ---------------------------------------------------------
// 8. LOGIQUE D'INVESTISSEMENT ET TID
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
    db.tx.insert(tx, () => {
        writeLog("CLIENT", `Soumission du TID ${req.body.reference}`);
        res.redirect('/?msg=TID_ENVOYE');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                writeLog("MINING", `Activation de l'unité ${req.body.packName}`);
                res.redirect('/');
            });
        } else { res.redirect('/?err=SOLDE'); }
    });
});

// ---------------------------------------------------------
// 9. MAINTENANCE ET SÉCURITÉ
// ---------------------------------------------------------
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/admin/reset-system-2026', (req, res) => {
    if (req.query.key === "ANASH_MASTER_WIPE") {
        db.users.remove({}, { multi: true });
        db.tx.remove({}, { multi: true });
        db.retraits.remove({}, { multi: true });
        db.logs.remove({}, { multi: true });
        res.redirect('/');
    }
});

// ---------------------------------------------------------
// 10. LANCEMENT DU MOTEUR INDUSTRIEL
// ---------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log("💎 CASHLINK ELITE v25.0 - SYSTÈME INDUSTRIEL ACTIF");
    console.log(`🌍 ACCÈS DIRECT : https://cashlink-vmd5.onrender.com`);
    console.log("====================================================");
});
