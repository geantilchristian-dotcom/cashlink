/**
 * ============================================================
 * CASHLINK ELITE v8.0 - ADMIN DYNAMIQUE & PILOTAGE TOTAL
 * FIX : GESTION DES TEXTES DU DASHBOARD VIA L'ADMIN
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION DES BASES DE DONNÉES ---
const dbPath = '/tmp/cashlink_v8_data';
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'config.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'anash_master_key_ultra_2026',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES PAR DÉFAUT (CMS) ---
// Ces données seront modifiables via les boutons dans l'Admin
const DEFAULT_SITE_CONTENT = {
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

// Initialisation du contenu au démarrage
db.config.update({ _id: "UI_CONTENT" }, { $setOnInsert: DEFAULT_SITE_CONTENT }, { upsert: true });

const PACKS_LOGIC = {
    'BRONZE': { prix: 50000, bonus: 5000 },
    'SILVER': { prix: 150000, bonus: 9000 },
    'GOLD': { prix: 500000, bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

const MASTER_UID = "ANASH_MASTER_USER";

// --- 4. ROUTES DASHBOARD (CLIENT) ---

app.get('/', (req, res) => {
    // Force l'utilisateur de test
    const userObj = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    db.users.update({ _id: MASTER_UID }, { $set: userObj }, { upsert: true }, () => {
        req.session.userId = MASTER_UID;
        res.redirect('/dashboard');
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');

    // On récupère l'utilisateur ET le contenu dynamique du site
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, siteContent) => {
            
            let progression = 0;
            if (user.investDate && user.pack !== 'Aucun') {
                const diff = (new Date() - new Date(user.investDate)) / (1000 * 60 * 60 * 24);
                progression = Math.min((diff / 30) * 100, 100).toFixed(1);
            }

            res.render('dashboard', {
                user: user,
                p: progression,
                content: siteContent || DEFAULT_SITE_CONTENT, // Utilise les textes de l'admin
                admin_contacts: { voda: "0810000000", airtel: "0990000000", orange: "0820000000" }
            });
        });
    });
});

// --- 5. ROUTES ADMINISTRATION (LE CENTRE DE COMMANDE) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ date: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, siteContent) => {
                
                const stats = {
                    totalUsers: (users || []).length,
                    enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                    tresorerie: 0
                };

                res.render('admin', {
                    users: users || [],
                    transactions: txs || [],
                    stats: stats,
                    site: siteContent || DEFAULT_SITE_CONTENT, // Pour afficher les valeurs actuelles dans les formulaires
                    content: { brand_name: "CASHLINK ADMIN" }
                });
            });
        });
    });
});

/**
 * NOUVEAU : Route pour modifier les textes du Dashboard depuis l'Admin
 */
app.post('/admin/update-content', (req, res) => {
    const updatedData = {
        tag_tech: req.body.tag_tech,
        titre_principal: req.body.titre_principal,
        description: req.body.description,
        puissance_hash: req.body.puissance_hash,
        reseau_status: req.body.reseau_status,
        securite_type: req.body.securite_type,
        retraits_status: req.body.retraits_status,
        footer_text: req.body.footer_text,
        footer_sub: req.body.footer_sub
    };

    db.config.update({ _id: "UI_CONTENT" }, { $set: updatedData }, {}, () => {
        console.log("📝 Dashboard mis à jour par l'Admin !");
        res.redirect('/admin?msg=CONTENU_MIS_A_JOUR');
    });
});

// --- 6. ACTIONS FINANCIÈRES ---

// Validation de paiement
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packKey = tx.type.replace("ACHAT ", "");
        const bonus = PACKS_LOGIC[packKey] ? PACKS_LOGIC[packKey].bonus : 0;

        db.users.update({ _id: tx.userId }, { $inc: { solde: tx.montant, bonus: bonus } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                res.redirect('/admin?msg=VALIDE');
            });
        });
    });
});

// Envoi TID
app.post('/souscrire-pack', (req, res) => {
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix),
        reference: req.body.reference,
        statut: "En attente",
        date: new Date().toLocaleString()
    };
    db.tx.insert(tx, () => res.redirect('/dashboard?msg=TID_OK'));
});

// Activation
app.post('/activer-investissement', (req, res) => {
    const prix = Number(req.body.prix);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= prix) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { solde: user.solde - prix, pack: req.body.packName, investDate: new Date().toISOString() }
            }, {}, () => res.redirect('/dashboard'));
        } else {
            res.redirect('/dashboard?err=SOLDE');
        }
    });
});

// --- 7. LANCEMENT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 MASTER ENGINE v8.0 ON PORT ${PORT}`));
