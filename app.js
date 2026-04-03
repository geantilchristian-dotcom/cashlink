/**
 * ==============================================================================
 * CASHLINK ELITE v17.0 - SYSTÈME DE CONTRÔLE BANCAIRE & MINAGE
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

// --- 1. ARCHITECTURE DES DONNÉES (PERSISTANCE /TMP RENDER) ---
const dbPath = '/tmp/cashlink_v17_master_prod';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [SYSTEM] Base de données initialisée dans /tmp");
    } catch (e) {
        console.log("⚠️ [SYSTEM] Mode volatile activé");
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
    secret: 'anash_master_ultra_secure_sync_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES CMS PAR DÉFAUT (TES TEXTES) ---
const MASTER_UID = "ANASH_MASTER_SESSION_2026"; // ID UNIQUE POUR TOUT LE SYSTÈME

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
    min_retrait: 1000
};

// Injection de la config au démarrage
db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: INITIAL_SITE_DATA }, { upsert: true });

// Configuration des Gains et Bonus par Pack
const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

// --- 4. MOTEUR DE CALCULS ---

function getSafeProgress(user) {
    if (!user || !user.investDate || user.pack === 'Aucun') return "0.0";
    try {
        const diff = (new Date() - new Date(user.investDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function sysLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// --- 5. ROUTE DASHBOARD (ACCÈS DIRECT SANS BOUCLE) ---

app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_UID, username: "ANASH MASTER", phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    db.users.update({ _id: MASTER_UID }, { $setOnInsert: defaultUser }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('dashboard', {
                    user: user || defaultUser,
                    p: getSafeProgress(user),
                    content: site || INITIAL_SITE_DATA,
                    packs: PACKS_SETTINGS
                });
            });
        });
    });
});

app.get('/dashboard', (req, res) => res.redirect('/'));

// --- 6. ADMINISTRATION (L'ORDINATEUR CENTRAL) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ ts: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ ts: -1 }).limit(20).exec((err, logs) => {
                    db.retraits.find({}).sort({ ts: -1 }).exec((err, requests) => {
                        
                        const stats = {
                            totalUsers: users.length,
                            enAttente: txs.filter(t => t.statut === "En attente").length,
                            soldeTotalUsers: users.reduce((acc, u) => acc + (Number(u.solde) || 0), 0),
                            bonusTotalUsers: users.reduce((acc, u) => acc + (Number(u.bonus) || 0), 0)
                        };

                        res.render('admin', {
                            users, transactions: txs, site: site || INITIAL_SITE_DATA,
                            messages: logs, retraits: requests || [],
                            stats, content: site || INITIAL_SITE_DATA
                        });
                    });
                });
            });
        });
    });
});

/**
 * CMS : Mise à jour des textes Dashboard par l'Admin
 */
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        sysLog("ADMIN", "Mise à jour du design effectuée.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION PAIEMENT : Envoie le Solde + le Bonus au Client
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        // On crédite l'ID MASTER pour assurer la communication
        db.users.update({ _id: MASTER_UID }, { 
            $inc: { solde: tx.montant, bonus: bonusAmount } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                sysLog("ADMIN", `Validation TID ${tx.reference} : Argent envoyé au Dashboard.`);
                res.redirect('/admin?success=1');
            });
        });
    });
});

// --- 7. LOGIQUE DU BOUTON RETRAIT (SYNCHRONISÉ) ---

app.post('/retrait', (req, res) => {
    const montantReq = Number(req.body.montant);
    
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            
            const minimum = site.min_retrait || 1000;

            if (user && user.bonus >= montantReq && montantReq >= minimum) {
                // 1. Déduction immédiate du Bonus sur le Dashboard pour éviter la triche
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -montantReq } }, {}, () => {
                    
                    // 2. Création de la demande pour l'Admin
                    const retrait = {
                        userId: MASTER_UID,
                        username: user.username,
                        montant: montantReq,
                        statut: "En attente",
                        date: new Date().toLocaleString('fr-FR'),
                        ts: Date.now()
                    };

                    db.retraits.insert(retrait, () => {
                        sysLog("RETRAIT", `Le client a retiré ${montantReq} FC. En attente de paiement Admin.`);
                        res.redirect('/?msg=SUCCESS_RETRAIT');
                    });
                });
            } else {
                res.redirect('/?err=FONDS_OU_MINIMUM');
            }
        });
    });
});

/**
 * ADMIN : Validation du paiement du retrait
 */
app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        sysLog("ADMIN", "Retrait marqué comme payé et envoyé au client.");
        res.redirect('/admin');
    });
});

// --- 8. LOGIQUE INVESTISSEMENT CLIENT ---

app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID, 
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente",
        ts: Date.now(),
        date: new Date().toLocaleString()
    };
    db.tx.insert(tx, () => {
        sysLog("CLIENT", `TID ${req.body.reference} envoyé pour validation.`);
        res.redirect('/?msg=ATTENTE_VALIDATION');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                sysLog("MINING", `Activation de la machine : ${req.body.packName}`);
                res.redirect('/');
            });
        } else { res.redirect('/?err=SOLDE_INSUFFISANT'); }
    });
});

// --- 9. SÉCURITÉ & LANCEMENT ---

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("==========================================");
    console.log("💎 CASHLINK ELITE v17.0 - TERMINAL PRÊT");
    console.log(`🌍 PORT : ${PORT}`);
    console.log("==========================================");
});
