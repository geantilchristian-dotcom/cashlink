/**
 * ============================================================
 * PROJET : CASHLINK ELITE v7.0 - FINAL CLOUD FIX
 * AUTEUR : ANASH MASTER
 * FIX : PERMISSIONS D'ÉCRITURE SUR RENDER.COM
 * ============================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. GESTION CRITIQUE DU DOSSIER DE DONNÉES ---
// Sur Render, /opt/render/project/src est souvent verrouillé.
// On utilise /tmp qui est le dossier temporaire universel de Linux.
const dbPath = '/tmp/cashlink_data_2026';

if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("✅ Dossier /tmp créé avec succès pour la base de données.");
    } catch (err) {
        console.log("⚠️ Impossible de créer le dossier, NeDB utilisera la mémoire vive.");
    }
}

// Initialisation des bases de données dans /tmp
const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'system.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session stable pour le déploiement
app.use(session({
    secret: 'cashlink_elite_render_secret_key',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. PARAMÈTRES MÉTIER ET CALCULS ---
const APP_CONFIG = {
    brand_name: "CASHLINK ELITE",
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000"
};

const PACKS_SYSTEM = {
    'BRONZE':  { prix: 50000,   bonus: 5000,   color: '#10b981' },
    'SILVER':  { prix: 150000,  bonus: 9000,   color: '#6366f1' },
    'GOLD':    { prix: 500000,  bonus: 40000,  color: '#f59e0b' },
    'DIAMOND': { prix: 1000000, bonus: 120000, color: '#f43f5e' }
};

const MASTER_UID = "ANASH_MASTER_PROD_2026";

/**
 * Calcule la progression (0 à 100%) sur 30 jours
 */
function getMiningStatus(startDate) {
    if (!startDate) return 0;
    const diff = (new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24);
    const progress = (diff / 30) * 100;
    return Math.min(progress, 100).toFixed(1);
}

// --- 4. ROUTES PRINCIPALES (ACCÈS DIRECT SANS BOUCLE) ---

/**
 * Route / : On gère tout ici pour éviter les erreurs de redirection
 */
app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0,
        bonus: 0,
        pack: 'Aucun',
        investDate: null,
        certified: true
    };

    // Upsert sécurisé : si l'écriture échoue, on rend quand même la page avec l'objet mémoire
    db.users.update({ _id: MASTER_UID }, { $set: defaultUser }, { upsert: true }, (err) => {
        if (err) console.error("❌ Erreur d'écriture (non fatale) :", err);

        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            // Si la DB est bloquée, on utilise l'objet par défaut pour que l'utilisateur voie son dashboard
            const activeUser = user || defaultUser;
            req.session.userId = activeUser._id;
            
            const progress = getMiningStatus(activeUser.investDate);

            res.render('dashboard', {
                user: activeUser,
                p: progress,
                content: APP_CONFIG,
                packs: PACKS_SYSTEM
            });
        });
    });
});

// Alias pour le dashboard
app.get('/dashboard', (req, res) => {
    res.redirect('/');
});

// --- 5. LOGIQUE DES FLUX (CLIENT) ---

/**
 * Envoi du TID (Recharge)
 */
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const tx = {
        userId: MASTER_UID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        date: new Date().toLocaleString('fr-FR'),
        createdAt: new Date().toISOString()
    };

    db.tx.insert(tx, () => {
        console.log(`📩 TID Reçu : ${reference}`);
        res.redirect('/?msg=TID_ENVOYE');
    });
});

/**
 * Lancement du Minage
 */
app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        if (user && user.solde >= Number(prix)) {
            db.users.update({ _id: MASTER_UID }, {
                $set: { 
                    solde: user.solde - Number(prix), 
                    pack: packName, 
                    investDate: new Date().toISOString() 
                }
            }, {}, () => res.redirect('/'));
        } else {
            res.redirect('/?err=SOLDE');
        }
    });
});

// --- 6. ADMINISTRATION ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ createdAt: -1 }).exec((err, txs) => {
            const stats = {
                totalUsers: (users || []).length,
                enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                soldeTotal: 0
            };
            res.render('admin', { 
                users: users || [], 
                transactions: txs || [], 
                stats: stats, 
                messages: [], 
                content: APP_CONFIG 
            });
        });
    });
});

/**
 * Validation Admin (Crédit Solde + Bonus)
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');

        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAmount = PACKS_SYSTEM[packKey] ? PACKS_SYSTEM[packKey].bonus : 0;

        // On crédite l'utilisateur
        db.users.update({ _id: tx.userId }, { 
            $inc: { solde: tx.montant, bonus: bonusAmount } 
        }, {}, () => {
            // On valide la transaction
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                console.log(`✅ Transaction ${tx.reference} Validée`);
                res.redirect('/admin');
            });
        });
    });
});

// --- 7. DÉMARRAGE DU MOTEUR ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log(`🚀 CASHLINK ELITE v7.0 LIVE`);
    console.log(`📂 STOCKAGE : ${dbPath}`);
    console.log(`🌍 PORT : ${PORT}`);
    console.log("====================================================");
});
