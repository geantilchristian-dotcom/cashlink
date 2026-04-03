/**
 * ==============================================================================
 * CASHLINK ELITE v27.3 - SYSTÈME INDUSTRIEL COMPLET (RDC 2026)
 * ------------------------------------------------------------------------------
 * CORRECTIFS INCLUS : 
 * - Anti-crash 'investDate' (TypeError sur Render)
 * - Persistance forcée des données CMS (Bouton Sauvegarder)
 * - Synchronisation complète Admin/Dashboard
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURATION DU STOCKAGE (PERSISTANCE RDC) ---
const dbPath = '/tmp/cashlink_v27_final_master';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [SYSTEM] Base de données initialisée avec succès.");
    } catch (e) {
        console.error("⚠️ [SYSTEM] Erreur de création du répertoire.");
    }
}

const db = {
    users: new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(dbPath, 'transactions.db'), autoload: true }),
    config: new Datastore({ filename: path.join(dbPath, 'site_config.db'), autoload: true }),
    logs: new Datastore({ filename: path.join(dbPath, 'activity_logs.db'), autoload: true }),
    retraits: new Datastore({ filename: path.join(dbPath, 'retraits.db'), autoload: true })
};

// --- 2. CONFIGURATION DU SERVEUR ---
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

// --- 3. LOGIQUE CMS : DONNÉES PAR DÉFAUT ---
const MASTER_UID = "ANASH_MASTER_SESSION_2026";

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
    admin_voda: "0810000000",
    admin_airtel: "0990000000",
    admin_orange: "0820000000",
    about_text: "Cashlink Elite est la plateforme leader du minage décentralisé en RDC...",
    rules_text: "1. Un seul compte par personne.\n2. Retraits traités sous 24h.",
    contact_address: "Immeuble Elite, Blvd du 30 Juin, Kinshasa, RDC",
    contact_email: "support@cashlink-elite.cd",
    contact_phone: "+243 810 000 000",
    min_retrait: 1000,
    footer_text: "CASHLINK ELITE v3.0",
    footer_sub: "Sécurisé par Protocole Blockchain 2026"
};

// Initialisation forcée au démarrage
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) db.config.insert(INITIAL_SITE_CONTENT);
});

const PACKS_CONFIG = {
    'BRONZE':  { prix: 50000,   bonus: 5000 },
    'SILVER':  { prix: 150000,  bonus: 9000 },
    'GOLD':    { prix: 500000,  bonus: 40000 },
    'DIAMOND': { prix: 1000000, bonus: 120000 }
};

// --- 4. MOTEURS DE CALCULS ---
function getMiningProgress(startDate) {
    if (!startDate) return "0.0";
    try {
        const start = new Date(startDate).getTime();
        const now = new Date().getTime();
        const diffDays = (now - start) / (1000 * 60 * 60 * 24);
        const percent = (diffDays / 30) * 100;
        return Math.min(percent, 100).toFixed(1);
    } catch (e) { return "0.0"; }
}

function addSystemLog(type, msg) {
    db.logs.insert({ date: new Date().toLocaleString('fr-FR'), type, msg, ts: Date.now() });
}

// --- 5. ROUTES CLIENTS (DASHBOARD AVEC SÉCURITÉ) ---
app.get('/', (req, res) => {
    const defaultUser = { _id: MASTER_UID, username: "ANASH MASTER", solde: 0, bonus: 0, pack: 'Aucun', investDate: null };

    db.users.update({ _id: MASTER_UID }, { $set: { lastVisit: new Date().toISOString() } }, { upsert: true }, () => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                
                // Correction du crash investDate
                const activeUser = user || defaultUser;
                const progress = (activeUser && activeUser.investDate) ? getMiningProgress(activeUser.investDate) : "0.0";

                res.render('dashboard', {
                    user: activeUser,
                    p: progress,
                    content: site || INITIAL_SITE_CONTENT,
                    packs: PACKS_CONFIG
                });
            });
        });
    });
});

// --- 6. SAUVEGARDE ADMIN (FONCTIONNELLE) ---
app.post('/admin/update-content', (req, res) => {
    // On capture tout le corps du formulaire
    const updateData = req.body;
    
    // On s'assure que le minimum retrait reste un nombre
    if(updateData.min_retrait) updateData.min_retrait = Number(updateData.min_retrait);

    // Mise à jour avec 'upsert' pour garantir l'enregistrement
    db.config.update({ _id: "UI_CONTENT" }, { $set: updateData }, { upsert: true }, (err) => {
        if (err) return res.status(500).send("Erreur de sauvegarde");
        
        addSystemLog("CMS", "Mise à jour des informations par l'administrateur.");
        
        // Petit délai pour Render avant la redirection
        setTimeout(() => {
            res.redirect('/admin');
        }, 300);
    });
});

// --- 7. ADMINISTRATION TERMINAL ---
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
                                soldeTotalUsers: users.reduce((acc, u) => acc + (u.solde || 0), 0)
                            }
                        });
                    });
                });
            });
        });
    });
});

// --- 8. VALIDATIONS ET FLUX ---
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx) return res.redirect('/admin');
        const packKey = tx.type.replace("ACHAT ", "");
        const bonus = PACKS_CONFIG[packKey] ? PACKS_CONFIG[packKey].bonus : 0;

        db.users.update({ _id: MASTER_UID }, { $inc: { solde: tx.montant, bonus: bonus } }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé" } }, {}, () => {
                addSystemLog("ADMIN", `Validation TID ${tx.reference} effectuée.`);
                res.redirect('/admin');
            });
        });
    });
});

app.post('/retrait', (req, res) => {
    const amount = Number(req.body.montant);
    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            if (user && user.bonus >= amount && amount >= (site.min_retrait || 1000)) {
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -amount } }, {}, () => {
                    db.retraits.insert({
                        userId: MASTER_UID, username: user.username, montant: amount,
                        statut: "En attente", date: new Date().toLocaleString(), ts: Date.now()
                    }, () => {
                        addSystemLog("RETRAIT", `Nouveau retrait de ${amount} FC détecté.`);
                        res.redirect('/?msg=SUCCESS');
                    });
                });
            } else { res.redirect('/?err=FONDS'); }
        });
    });
});

app.post('/souscrire-pack', (req, res) => {
    db.tx.insert({
        userId: MASTER_UID, type: "ACHAT " + req.body.packName,
        montant: Number(req.body.prix), reference: req.body.reference,
        statut: "En attente", ts: Date.now(), date: new Date().toLocaleString()
    }, () => {
        addSystemLog("DÉPÔT", `Nouveau TID ${req.body.reference} à valider.`);
        res.redirect('/?msg=TID_SEND');
    });
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

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- 9. LANCEMENT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("💎 CASHLINK ELITE v27.3 INDUSTRIEL ACTIF");
});
