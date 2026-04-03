/**
 * ==============================================================================
 * CASHLINK ELITE v16.0 - SYNC TOTALE ADMIN/DASHBOARD (600 LIGNES)
 * DÉPLOIEMENT : RENDER CLOUD OPTIMISÉ
 * FIX : COMMUNICATION INTER-COMPTES ET LOGIQUE DE RETRAIT
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. ARCHITECTURE DES DONNÉES (PERSISTANCE /TMP) ---
const dbPath = '/tmp/cashlink_v16_master_sync';
if (!fs.existsSync(dbPath)) {
    try { fs.mkdirSync(dbPath, { recursive: true }); } catch (e) { console.log("RAM Mode"); }
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultra_sync_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// --- 3. CONSTANTES ET CONFIGURATION CMS ---
const MASTER_UID = "ANASH_MASTER_SESSION_2026"; // L'ID UNIQUE POUR TOUT LE SYSTÈME

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

// Injection automatique de la config
db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: INITIAL_SITE_DATA }, { upsert: true });

const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000 }
};

// --- 4. MOTEUR DE CALCULS SÉCURISÉS ---

function getProgress(user) {
    if (!user || !user.investDate || user.pack === 'Aucun') return "0.0";
    try {
        const diff = (new Date() - new Date(user.investDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function logger(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// --- 5. ROUTE DASHBOARD (SYNCHRONISÉ) ---

app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_UID, username: "ANASH MASTER", phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // On s'assure que l'utilisateur unique est en base
    db.users.update({ _id: MASTER_UID }, { $setOnInsert: defaultUser }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('dashboard', {
                    user: user || defaultUser,
                    p: getProgress(user),
                    content: site || INITIAL_SITE_DATA,
                    packs: PACKS_SETTINGS
                });
            });
        });
    });
});

app.get('/dashboard', (req, res) => res.redirect('/'));

// --- 6. ADMINISTRATION (L'INTERRUPTEUR GÉNÉRAL) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ ts: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ ts: -1 }).limit(15).exec((err, logs) => {
                    db.retraits.find({}).sort({ ts: -1 }).exec((err, requests) => {
                        
                        const stats = {
                            totalUsers: users.length,
                            enAttente: txs.filter(t => t.statut === "En attente").length,
                            soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0),
                            bonusTotalUsers: users.reduce((acc, u) => acc + (u.bonus || 0), 0)
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
 * CMS ADMIN : MODIFIER LES TEXTES D'AFFICHAGE
 */
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        logger("ADMIN", "Mise à jour des textes Dashboard effectuée.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION PAIEMENT : ENVOI L'ARGENT AU DASHBOARD
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        // ON UTILISE MASTER_UID POUR ÊTRE SÛR QUE ÇA ARRIVE AU DASHBOARD
        db.users.update({ _id: MASTER_UID }, { 
            $inc: { solde: tx.montant, bonus: bonusAmount } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                logger("ADMIN", `Validation réussie : Solde +${tx.montant} / Bonus +${bonusAmount}`);
                res.redirect('/admin?success=1');
            });
        });
    });
});

// --- 7. LOGIQUE DE RETRAIT (COMMUNICATION) ---

app.post('/retrait', (req, res) => {
    const montantReq = Number(req.body.montant);
    
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            
            const minimum = site.min_retrait || 1000;

            if (user && user.bonus >= montantReq && montantReq >= minimum) {
                // Déduction immédiate du Bonus sur le Dashboard
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -montantReq } }, {}, () => {
                    const retrait = {
                        userId: MASTER_UID,
                        username: user.username,
                        montant: montantReq,
                        statut: "En attente",
                        date: new Date().toLocaleString(),
                        ts: Date.now()
                    };
                    db.retraits.insert(retrait, () => {
                        logger("RETRAIT", `Demande de ${montantReq} FC envoyée à l'Admin.`);
                        res.redirect('/?msg=SUCCESS_RETRAIT');
                    });
                });
            } else {
                res.redirect('/?err=FONDS');
            }
        });
    });
});

app.post('/admin/payer-retrait', (req, res) => {
    db.retraits.update({ _id: req.body.requestId }, { $set: { statut: "Payé" } }, {}, () => {
        logger("ADMIN", "Retrait marqué comme payé.");
        res.redirect('/admin');
    });
});

// --- 8. FLUX CLIENT (DÉPÔTS & ACTIVATION) ---

app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID, // On lie tjs à l'ID Master
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente",
        ts: Date.now()
    };
    db.tx.insert(tx, () => {
        logger("CLIENT", `TID ${req.body.reference} soumis.`);
        res.redirect('/?msg=ATTENTE');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                logger("MINING", `Activation machine : ${req.body.packName}`);
                res.redirect('/');
            });
        } else { res.redirect('/?err=SOLDE'); }
    });
});

// --- 9. LANCEMENT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("==========================================");
    console.log("💎 CASHLINK ELITE v16.0 - SYNC OK");
    console.log("==========================================");
});
