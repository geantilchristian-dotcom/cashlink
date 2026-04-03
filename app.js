/**
 * ============================================================
 * PROJET : CASHLINK ELITE v9.5 - TERMINAL DE CONTRÔLE RDC
 * DÉPLOIEMENT : OPTIMISÉ POUR RENDER.COM (FS-FIX)
 * FONCTION : PILOTAGE TOTAL DU DASHBOARD & LOGIQUE FINANCIÈRE
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. GESTION DES RÉPERTOIRES ET BASES DE DONNÉES (FIX CLOUD) ---
// Render efface le dossier local, on utilise /tmp pour la persistance session
let dbPath = path.join(__dirname, 'database');
try {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }
} catch (e) {
    dbPath = '/tmp/cashlink_v9_data';
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'logs.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultra_secure_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES PAR DÉFAUT (CMS DYNAMIQUE) ---
const INITIAL_CONTENT = {
    _id: "UI_CONTENT",
    tag_tech: "TECHNOLOGIE RDC 2026",
    titre_principal: "MINAGE AUTO",
    description: "Générez des profits passifs sécurisés grâce à nos fermes de minage décentralisées.",
    puissance_hash: "0.00 TH/s",
    reseau_status: "Actif",
    securite_type: "SSL-256",
    retraits_status: "Ouverts",
    footer_text: "CASHLINK ELITE v3.0 - DÉPLOYÉ SUR TERMINAL RDC",
    footer_sub: "Sécurisé par Protocole Blockchain 2026"
};

// Initialisation de la configuration au premier lancement
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_CONTENT);
});

const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

const MASTER_UID = "ANASH_MASTER_SESSION_2026";

// --- 4. FONCTIONS UTILITAIRES ---

/**
 * Calcule la progression du minage sur un cycle de 30 jours
 */
function calculateMining(startDate) {
    if (!startDate) return 0;
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    const progress = (diff / 30) * 100;
    return Math.min(progress, 100).toFixed(2);
}

/**
 * Ajoute un événement au journal d'activité
 */
function addSystemLog(msg) {
    const log = { date: new Date().toLocaleString('fr-FR'), text: msg };
    db.logs.insert(log);
    console.log(`[LOG] ${msg}`);
}

// --- 5. ROUTES NAVIGATION (ACCÈS DIRECT) ---

app.get('/', (req, res) => {
    const userSeed = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // On s'assure que l'utilisateur Master existe
    db.users.update({ _id: MASTER_UID }, { $set: userSeed }, { upsert: true }, (err) => {
        req.session.userId = MASTER_UID;
        res.redirect('/dashboard');
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');

    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            const p = calculateMining(user.investDate);
            res.render('dashboard', {
                user: user,
                p: p,
                content: site || INITIAL_CONTENT
            });
        });
    });
});

// --- 6. ADMINISTRATION (CONTRÔLE TOTAL) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ date: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ date: -1 }).limit(15).exec((err, logs) => {
                    
                    const stats = {
                        totalUsers: users.length,
                        enAttente: txs.filter(t => t.statut === "En attente").length,
                        soldeTotalUsers: users.reduce((acc, u) => acc + (Number(u.solde) || 0), 0)
                    };

                    res.render('admin', {
                        users: users,
                        transactions: txs,
                        stats: stats,
                        site: site || INITIAL_CONTENT,
                        messages: logs || []
                    });
                });
            });
        });
    });
});

/**
 * MISE À JOUR DU DASHBOARD DEPUIS L'ADMIN (MODAL/FORM)
 */
app.post('/admin/update-content', (req, res) => {
    const newContent = {
        tag_tech: req.body.tag_tech,
        titre_principal: req.body.titre_principal,
        puissance_hash: req.body.puissance_hash,
        reseau_status: req.body.reseau_status,
        description: req.body.description,
        securite_type: req.body.securite_type,
        retraits_status: req.body.retraits_status,
        footer_text: req.body.footer_text
    };

    db.config.update({ _id: "UI_CONTENT" }, { $set: newContent }, {}, (err) => {
        addSystemLog("Mise à jour des textes du Dashboard par l'Admin");
        res.redirect('/admin?msg=UPDATED');
    });
});

// --- 7. LOGIQUE DES FLUX (TID & VALIDATION) ---

// Le client envoie sa preuve (TID)
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
        addSystemLog(`Demande de pack ${packName} soumise par le client (TID: ${reference})`);
        res.redirect('/dashboard?msg=TID_OK');
    });
});

// L'Admin valide le paiement
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        // Récupération du bonus automatique selon le pack
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusToGive = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        // Mise à jour : On donne le montant au solde + le bonus
        db.users.update({ _id: tx.userId }, { 
            $inc: { solde: tx.montant, bonus: bonusToGive } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                addSystemLog(`Validation TID ${tx.reference}. Crédit: ${tx.montant} FC + Bonus: ${bonusToGive} FC`);
                res.redirect('/admin?msg=VALIDATED');
            });
        });
    });
});

// Le client active son minage (Déduction solde)
app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    const cost = Number(prix);

    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= cost) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { 
                    solde: user.solde - cost, 
                    pack: packName, 
                    investDate: new Date().toISOString() 
                }
            }, {}, () => {
                addSystemLog(`Lancement effectif du minage Pack ${packName} pour ANASH MASTER`);
                res.redirect('/dashboard');
            });
        } else {
            res.redirect('/dashboard?err=SOLDE_INSUFFISANT');
        }
    });
});

// --- 8. SYSTÈME DE SÉCURITÉ ---

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Route de secours pour vider la DB si besoin (RESET)
app.get('/admin/wipe-system', (req, res) => {
    if (req.query.key === "ANASH2026") {
        db.users.remove({}, { multi: true });
        db.tx.remove({}, { multi: true });
        db.logs.remove({}, { multi: true });
        res.redirect('/');
    } else {
        res.send("Clé invalide");
    }
});

// --- 9. DÉMARRAGE ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log("💎 MASTER ENGINE v9.5 - OPÉRATIONNEL");
    console.log(`🌍 PORT : ${PORT}`);
    console.log(`📂 DB PATH : ${dbPath}`);
    console.log("====================================================");
});
