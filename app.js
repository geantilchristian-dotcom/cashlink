/**
 * ==============================================================================
 * CASHLINK ELITE v14.0 - LE SYSTÈME DE CONTRÔLE ULTIME (3 AVRIL 2026)
 * DÉPLOIEMENT : OPTIMISÉ POUR RENDER.COM / GITHUB
 * MODULES : DASHBOARD CLIENT, ADMIN CMS, GESTION DES RETRAITS, LOGS AVANCÉS
 * ==============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- 1. ARCHITECTURE DES DONNÉES (PERSISTANCE RENDER) ---
// On utilise /tmp car Render interdit l'écriture sur le disque racine en gratuit
const dbPath = '/tmp/cashlink_v14_master_prod';
if (!fs.existsSync(dbPath)) {
    try {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log("📂 [SYSTEM] Répertoire de données initialisé dans /tmp");
    } catch (e) {
        console.log("⚠️ [SYSTEM] Alerte permissions : utilisation de la mémoire vive");
    }
}

// Initialisation des collections de la base de données
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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Sécurisation des sessions
app.use(session({
    secret: 'anash_master_ultra_secure_blockchain_2026_elite',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // Session d'un an pour éviter les déconnexions
}));

// --- 3. LOGIQUE CMS & CONFIGURATION INITIALE ---
// Ces données sont celles que tu pilotes depuis ton Admin
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
    admin_airtel: "0990000000",
    min_retrait: 1000,
    cover_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2000"
};

// Injection de la config de base si inexistante
db.config.findOne({ _id: "UI_CONTENT" }, (err, doc) => {
    if (!doc) {
        db.config.insert(INITIAL_SITE_DATA);
        console.log("✨ [CONFIG] Contenu CMS par défaut injecté.");
    }
});

// Logiciel de calcul des Packs
const PACKS_SETTINGS = {
    'BRONZE':  { prix: 50000,   daily: 5000,   bonus: 5000,   color: '#10b981' },
    'SILVER':  { prix: 150000,  daily: 15000,  bonus: 9000,   color: '#6366f1' },
    'GOLD':    { prix: 500000,  daily: 40000,  bonus: 40000,  color: '#f59e0b' },
    'DIAMOND': { prix: 1000000, daily: 100000, bonus: 120000, color: '#f43f5e' }
};

const MASTER_UID = "ANASH_MASTER_SESSION_2026";

// --- 4. MOTEUR DE CALCULS & UTILITAIRES ---

/**
 * Calcule la progression du cycle de minage (30 jours)
 */
function computeMiningProgress(startDate) {
    if (!startDate) return "0.0";
    try {
        const debut = new Date(startDate);
        const maintenant = new Date();
        const diffInMs = mains - debut;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
        const percent = (diffInDays / 30) * 100;
        return Math.min(percent, 100).toFixed(1);
    } catch (e) {
        return "0.0";
    }
}

/**
 * Enregistre chaque action système pour l'historique admin
 */
function systemLogger(type, message, userId = "SYSTEM") {
    const logEntry = {
        date: new Date().toLocaleString('fr-FR'),
        type: type,
        text: message,
        userId: userId,
        timestamp: new Date().getTime()
    };
    db.logs.insert(logEntry);
    console.log(`[${type}] ${message}`);
}

// --- 5. ROUTES DE NAVIGATION (ANTI-BOUCLE RENDER) ---

/**
 * Route / : C'est le point d'entrée unique.
 * On affiche le Dashboard directement ici pour éviter les redirections infinies.
 */
app.get('/', (req, res) => {
    const userTemplate = {
        _id: MASTER_UID,
        username: "ANASH MASTER",
        phone: "970000000",
        solde: 0,
        bonus: 0,
        pack: 'Aucun',
        investDate: null,
        certified: true,
        lastActive: new Date().toISOString()
    };

    // On force la synchronisation de l'utilisateur
    db.users.update({ _id: MASTER_UID }, { $set: userTemplate }, { upsert: true }, (err) => {
        db.users.findOne({ _id: MASTER_UID }, (err, user) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                
                const currentProgress = computeMiningProgress(user.investDate);
                
                // Rendu direct du Dashboard
                res.render('dashboard', {
                    user: user || userTemplate,
                    p: currentProgress,
                    content: site || INITIAL_SITE_DATA,
                    packs: PACKS_SETTINGS
                });
            });
        });
    });
});

// Alias pour le confort de navigation
app.get('/dashboard', (req, res) => { res.redirect('/'); });

// --- 6. LOGIQUE D'ADMINISTRATION (PILOTAGE) ---

app.get('/admin', (req, res) => {
    db.users.find({}, (err, users) => {
        db.tx.find({}).sort({ timestamp: -1 }).exec((err, txs) => {
            db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
                db.logs.find({}).sort({ timestamp: -1 }).limit(30).exec((err, logs) => {
                    db.retraits.find({}).sort({ timestamp: -1 }).exec((err, paiments) => {
                        
                        const stats = {
                            totalUsers: users.length,
                            enAttente: txs.filter(t => t.statut === "En attente").length,
                            soldeTotalUsers: users.reduce((acc, u) => acc + (Number(u.solde) || 0), 0),
                            bonusTotalUsers: users.reduce((acc, u) => acc + (Number(u.bonus) || 0), 0),
                            demandesRetrait: (paiments || []).filter(r => r.statut === "En attente").length
                        };

                        res.render('admin', {
                            users: users,
                            transactions: txs,
                            stats: stats,
                            site: site || INITIAL_SITE_DATA,
                            messages: logs || [],
                            retraits: paiments || [],
                            content: site || INITIAL_SITE_DATA
                        });
                    });
                });
            });
        });
    });
});

/**
 * CMS : Mise à jour des textes dynamiques du Dashboard
 */
app.post('/admin/update-content', (req, res) => {
    const updatedData = {
        tag_tech: req.body.tag_tech,
        titre_principal: req.body.titre_principal,
        puissance_hash: req.body.puissance_hash,
        reseau_status: req.body.reseau_status,
        description: req.body.description,
        securite_type: req.body.securite_type,
        retraits_status: req.body.retraits_status,
        footer_text: req.body.footer_text,
        footer_sub: req.body.footer_sub,
        min_retrait: Number(req.body.min_retrait) || 1000
    };

    db.config.update({ _id: "UI_CONTENT" }, { $set: updatedData }, {}, () => {
        systemLogger("CMS", "L'administrateur a modifié l'apparence du Dashboard.");
        res.redirect('/admin?msg=CMS_OK');
    });
});

/**
 * VALIDATION ADMIN : Crédite le solde ET le bonus correspondant
 */
app.post('/valider-depot', (req, res) => {
    const { txId } = req.body;
    db.tx.findOne({ _id: txId }, (err, tx) => {
        if (!tx || tx.statut !== "En attente") return res.redirect('/admin');

        // On identifie le pack pour attribuer le bonus automatique
        const packKey = tx.type.replace("ACHAT ", "");
        const bonusConfig = PACKS_SETTINGS[packKey] ? PACKS_SETTINGS[packKey].bonus : 0;

        // Transaction atomique : Solde + Bonus
        db.users.update({ _id: tx.userId }, { 
            $inc: { solde: tx.montant, bonus: bonusConfig } 
        }, {}, () => {
            db.tx.update({ _id: txId }, { $set: { statut: "Validé", dateAction: new Date().toLocaleString() } }, {}, () => {
                systemLogger("ADMIN", `Validation TID ${tx.reference}. Crédit: ${tx.montant} FC | Bonus: ${bonusConfig} FC`);
                res.redirect('/admin?msg=APPROUVE');
            });
        });
    });
});

// --- 7. LOGIQUE DE RETRAIT (Bouton Retrait) ---

/**
 * Client effectue une demande de retrait de ses gains (Bonus)
 */
app.post('/retrait', (req, res) => {
    const { montant, methode } = req.body;
    const value = Number(montant);

    db.users.findOne({ _id: MASTER_UID }, (err, user) => {
        db.config.findOne({ _id: "UI_CONTENT" }, (err, site) => {
            
            const min = site.min_retrait || 1000;

            // Vérification des fonds et du minimum
            if (user && user.bonus >= value && value >= min) {
                
                // 1. Déduction immédiate du bonus client
                db.users.update({ _id: MASTER_UID }, { $inc: { bonus: -value } }, {}, () => {
                    
                    // 2. Création de la demande de paiement pour l'Admin
                    const retraitEntry = {
                        userId: MASTER_UID,
                        username: user.username,
                        montant: value,
                        methode: methode || "Mobile Money",
                        statut: "En attente",
                        date: new Date().toLocaleString('fr-FR'),
                        timestamp: new Date().getTime()
                    };

                    db.retraits.insert(retraitEntry, () => {
                        systemLogger("RETRAIT", `Demande de retrait de ${value} FC initiée par ${user.username}`);
                        res.redirect('/?msg=RETRAIT_EN_COURS');
                    });
                });

            } else {
                res.redirect('/?err=FONDS_INSUFFISANTS_OU_MINIMUM');
            }
        });
    });
});

/**
 * Admin valide le paiement effectif du retrait
 */
app.post('/admin/payer-retrait', (req, res) => {
    const { requestId } = req.body;
    db.retraits.update({ _id: requestId }, { $set: { statut: "Payé", datePaye: new Date().toLocaleString() } }, {}, () => {
        systemLogger("ADMIN", `Le retrait ${requestId} a été marqué comme PAYÉ.`);
        res.redirect('/admin?msg=PAYE_OK');
    });
});

// --- 8. LOGIQUE D'INVESTISSEMENT ---

/**
 * Envoi de preuve (TID)
 */
app.post('/souscrire-pack', (req, res) => {
    const { packName, prix, reference } = req.body;
    const newTx = {
        userId: MASTER_UID,
        type: "ACHAT " + packName,
        montant: Number(prix),
        reference: reference,
        statut: "En attente",
        timestamp: new Date().getTime(),
        date: new Date().toLocaleString('fr-FR')
    };
    db.tx.insert(newTx, () => {
        systemLogger("CLIENT", `TID ${reference} soumis pour le pack ${packName}`);
        res.redirect('/?msg=TID_OK');
    });
});

/**
 * Activation de la machine (Passage du Solde au Minage)
 */
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
                systemLogger("MINING", `Démarrage du minage : Pack ${packName}`);
                res.redirect('/');
            });
        } else {
            res.redirect('/?err=SOLDE_INSUFFISANT');
        }
    });
});

// --- 9. SÉCURITÉ & MAINTENANCE ---

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

/**
 * Route de secours pour purger les logs
 */
app.get('/admin/clear-logs', (req, res) => {
    db.logs.remove({}, { multi: true }, () => res.redirect('/admin'));
});

/**
 * RESET TOTAL (ZONE ROUGE)
 */
app.get('/admin/wipe-system-2026', (req, res) => {
    if (req.query.key === "ANASH_MASTER_RESET") {
        db.users.remove({}, { multi: true });
        db.tx.remove({}, { multi: true });
        db.retraits.remove({}, { multi: true });
        db.logs.remove({}, { multi: true });
        console.log("🔥 [SYSTEM] Wipe total effectué.");
        res.redirect('/');
    } else {
        res.status(403).send("Accès refusé.");
    }
});

// --- 10. LANCEMENT DU MOTEUR ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("====================================================");
    console.log("💎 CASHLINK ELITE v14.0 - SYSTÈME OPÉRATIONNEL");
    console.log(`🌍 URL DE CONTRÔLE : https://cashlink-vmd5.onrender.com`);
    console.log(`📂 DATA STORAGE : ${dbPath}`);
    console.log("====================================================");
});
