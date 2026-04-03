/**
 * ============================================================
 * CASHLINK ELITE v12.0 - FIX CRITIQUE "NULL PROPERTIES"
 * SOLUTION : PROTECTION CONTRE LES OBJETS INDÉFINIS
 * DÉPLOIEMENT : RENDER CLOUD (DOSSIER /TMP)
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION STORAGE (FIX RENDER) ---
const dbPath = '/tmp/cashlink_v12_final';
if (!fs.existsSync(dbPath)) {
    try { fs.mkdirSync(dbPath, { recursive: true }); } catch (e) { console.log("Mode RAM"); }
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'anash_master_ultimate_fix_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. CONTENU DYNAMIQUE (TEXTES DEMANDÉS) ---
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

db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: INITIAL_CONTENT }, { upsert: true });

const MASTER_UID = "ANASH_MASTER_USER_2026";

// --- 4. CALCULS SÉCURISÉS (ANTI-CRASH) ---

function getSafeProgress(user) {
    if (!user || !user.investDate || user.pack === 'Aucun') return "0.0";
    try {
        const diff = (new Date() - new Date(user.investDate)) / (1000 * 60 * 60 * 24);
        return Math.min((diff / 30) * 100, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

// --- 5. ROUTE PRINCIPALE (AFFICHAGE DIRECT SANS BOUCLE) ---

app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // On s'assure que l'utilisateur existe avant de charger la page
    db.users.update({ _id: MASTER_UID }, { $set: defaultUser }, { upsert: true }, () => {
        
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                
                // Utilisation du fix pour éviter le TypeError
                const finalUser = user || defaultUser;
                const progress = getSafeProgress(finalUser);
                
                res.render('dashboard', {
                    user: finalUser,
                    p: progress,
                    content: site || INITIAL_CONTENT
                });
            });
        });
    });
});

// Alias
app.get('/dashboard', (req, res) => res.redirect('/'));

// --- 6. ADMINISTRATION ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ date: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                res.render('admin', {
                    users: users || [],
                    transactions: txs || [],
                    stats: {
                        totalUsers: (users || []).length,
                        enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                        soldeTotalUsers: (users || []).reduce((acc, u) => acc + (u.solde || 0), 0)
                    },
                    site: site || INITIAL_CONTENT,
                    messages: []
                });
            });
        });
    });
});

// Mise à jour des textes Dashboard
app.post('/admin/update-content', (req, res) => {
    db.config.update({ _id: "UI_CONTENT" }, { $set: req.body }, {}, () => {
        res.redirect('/admin');
    });
});

// Validation Admin (Crédit Solde)
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        db.users.update({ _id: tx.userId }, { $inc: { solde: tx.montant } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                res.redirect('/admin');
            });
        });
    });
});

// --- 7. ACTIONS CLIENTS ---

app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente",
        date: new Date().toLocaleString()
    };
    db.tx.insert(tx, () => res.redirect('/?msg=OK'));
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

// --- 8. DÉMARRAGE ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 SERVEUR v12.0 PRÊT SUR PORT ${PORT}`);
});
