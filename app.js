/**
 * ============================================================
 * CASHLINK ELITE v10.0 - MOTEUR DE CONTRÔLE ABSOLU
 * FIX : ZÉRO REDIRECTION (ANTI-BOUCLE RENDER)
 * FONCTION : PILOTAGE DYNAMIQUE DU DASHBOARD & LOGIQUE GAINS
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. GESTION DES RÉPERTOIRES (FIX PERMISSIONS RENDER) ---
const dbPath = '/tmp/cashlink_v10_prod';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
    } catch (e) {
        console.log("⚠️ Dossier /tmp inaccessible, NeDB en mode volatile.");
    }
}

// Initialisation des bases de données
const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'activity.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session stable
app.use(session({
    secret: 'anash_master_blockchain_key_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES D'AFFICHAGE DYNAMIQUES (CMS) ---
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
    admin_voda: "0810000000",
    admin_airtel: "0990000000"
};

// Initialisation de la config si vide
db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: INITIAL_SITE_DATA }, { upsert: true });

const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

const MASTER_ID = "ANASH_MASTER_SESSION_2026";

// --- 4. FONCTIONS DE CALCUL & LOGS ---

function getProgress(startDate) {
    if (!startDate) return 0;
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    return Math.min((diff / 30) * 100, 100).toFixed(2);
}

function addLog(msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), text: msg });
}

// --- 5. ROUTE UNIQUE (C'EST ICI QUE LA BOUCLE SE CASSE) ---

// Au lieu de rediriger vers /dashboard, on rend directement la vue
app.get('/', (req, res) => {
    const userDefault = {
        _id: MASTER_ID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // 1. On s'assure que l'utilisateur existe
    db.users.update({ _id: MASTER_ID }, { $set: userDefault }, { upsert: true }, () => {
        
        // 2. On récupère les données à afficher (User + Config Site)
        db.users.findOne({ _id: MASTER_ID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                
                const p = getProgress(user.investDate);
                
                // 3. AFFICHAGE DIRECT (Zéro redirection)
                res.render('dashboard', {
                    user: user,
                    p: p,
                    content: site || INITIAL_SITE_DATA
                });
            });
        });
    });
});

// Alias au cas où, mais / est la route principale désormais
app.get('/dashboard', (req, res) => { res.redirect('/'); });

// --- 6. LOGIQUE ADMINISTRATION (LE CERVEAU) ---

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
                        site: site || INITIAL_SITE_DATA,
                        messages: logs || []
                    });
                });
            });
        });
    });
});

/**
 * MISE À JOUR DU DASHBOARD DEPUIS L'ADMIN
 */
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        addLog("Modification des textes promotionnels du Dashboard");
        res.redirect('/admin?msg=MISE_A_JOUR_OK');
    });
});

/**
 * VALIDATION DE PAIEMENT (TRANSFERT SOLDE + BONUS)
 */
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
                addLog(`Validation TID ${tx.reference} : Solde +${tx.montant} FC / Bonus +${bonusAmount} FC`);
                res.redirect('/admin?msg=VALIDE');
            });
        });
    });
});

// --- 7. FLUX CLIENT (INVESTISSEMENT) ---

app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const tx = {
        userId: MASTER_ID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR')
    };
    db.tx.insert(tx, () => {
        addLog(`Demande de pack ${packName} soumise (Réf: ${reference})`);
        res.redirect('/?msg=TID_ENVOYE');
    });
});

app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_ID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => {
                addLog(`Démarrage du minage : Pack ${req.body.packName}`);
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
    console.log("==========================================");
    console.log(`🚀 MASTER ENGINE v10.0 ACTIF SUR PORT ${PORT}`);
    console.log("==========================================");
});
