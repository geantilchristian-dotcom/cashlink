const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION BASES DE DONNÉES ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = {
    users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbDir, 'transactions.db'), autoload: true })
};

// --- 2. CONFIGURATION SERVEUR ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'cashlink_ultra_direct_access_2026',
    resave: true,
    saveUninitialized: true
}));

const CONFIG = {
    brand_name: "CASHLINK ELITE",
    admin_voda: "0810000000", admin_airtel: "0990000000", admin_orange: "0820000000"
};

const PACKS_DATA = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

const MASTER_ID = "ANASH_MASTER_LIVE";

// --- 3. LA ROUTE MAGIQUE (ACCÈS DIRECT) ---

app.get('/', (req, res) => {
    const defaultUser = {
        _id: MASTER_ID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0, bonus: 0, pack: 'Aucun', investDate: null, certified: true
    };

    // On force la création et on redirige instantanément
    db.users.update({ _id: MASTER_ID }, { $set: defaultUser }, { upsert: true }, () => {
        req.session.userId = MASTER_ID;
        res.redirect('/dashboard');
    });
});

// --- 4. LE DASHBOARD AVEC TOUS LES CALCULS ---

app.get('/dashboard', (req, res) => {
    // Si pas de session, on force le retour à la racine pour recréer l'user
    if (!req.session.userId) return res.redirect('/');

    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (!user) return res.redirect('/');

        // CALCUL DE PROGRESSION (30 JOURS)
        let progression = 0;
        if (user.investDate && user.pack && user.pack !== 'Aucun') {
            const debut = new Date(user.investDate);
            const maintenant = new Date();
            const diffJours = (maintenant - debut) / (1000 * 60 * 60 * 24);
            progression = Math.min((diffJours / 30) * 100, 100);
        }

        res.render('dashboard', { 
            user: user, 
            p: progression.toFixed(1), 
            content: CONFIG 
        });
    });
});

// --- 5. ACTIONS (TID & INVESTISSEMENT) ---

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
    db.tx.insert(tx, () => res.redirect('/dashboard?msg=TID_ENVOYE'));
});

app.post('/activer-investissement', (req, res) => {
    const { packName, prix } = req.body;
    db.users.findOne({ _id: MASTER_ID }, (err, user) => {
        if (user && user.solde >= Number(prix)) {
            db.users.update({ _id: MASTER_ID }, { 
                $set: { 
                    solde: user.solde - Number(prix),
                    pack: packName, 
                    investDate: new Date().toISOString()
                } 
            }, {}, () => res.redirect('/dashboard'));
        } else {
            res.redirect('/dashboard?msg=SOLDE_INSUFFISANT');
        }
    });
});

// --- 6. ADMINISTRATION ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ date: -1 }).exec((err, txs) => {
            const stats = { 
                totalUsers: (users || []).length, 
                enAttente: (txs || []).filter(t => t.statut === "En attente").length,
                soldeTotal: 0 
            };
            res.render('admin', { users: users || [], transactions: txs || [], stats, messages: [], content: CONFIG });
        });
    });
});

app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusAuto = PACKS_DATA[packKey] ? PACKS_DATA[packKey].bonus : 0;

        db.users.update({ _id: tx.userId }, { $inc: { solde: tx.montant, bonus: bonusAuto } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                res.redirect('/admin');
            });
        });
    });
});

// --- 7. DÉMARRAGE ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SERVEUR LIVE SUR PORT ${PORT}`));
