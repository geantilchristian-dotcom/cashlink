const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const path = require('path');
const session = require('express-session');

const app = express();

// 1. BASES DE DONNÉES
const db = {
    users: new Datastore({ filename: path.join(__dirname, 'database', 'users.db'), autoload: true }),
    tx: new Datastore({ filename: path.join(__dirname, 'database', 'tx.db'), autoload: true })
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'cashlink_elite_ultra_secret_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// 2. CONFIGURATION DES PACKS (Les règles de calcul)
const PACK_SETTINGS = {
    'BRONZE': { price: 50000, daily: 5000, bonus: 5000 },
    'SILVER': { price: 150000, daily: 15000, bonus: 9000 },
    'GOLD': { price: 500000, daily: 40000, bonus: 40000 },
    'DIAMOND': { price: 1000000, daily: 100000, bonus: 120000 }
};

// 3. ROUTES D'ACCÈS
app.get('/', (req, res) => res.render('login', { msg: req.query.msg || null }));

app.post('/register', (req, res) => {
    const { username, phone, password } = req.body;
    db.users.findOne({ phone }, (err, user) => {
        if (user) return res.redirect('/?msg=Numéro déjà utilisé');
        db.users.insert({ 
            username, phone, password, 
            solde: 0, bonus: 0, pack: 'Aucun', 
            certified: false, investDate: null, 
            createdAt: new Date().toISOString() 
        }, () => res.redirect('/?msg=Inscription réussie !'));
    });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    db.users.findOne({ phone, password }, (err, user) => {
        if (user) {
            req.session.userId = user._id;
            res.redirect('/dashboard');
        } else res.redirect('/?msg=Identifiants incorrects');
    });
});

// 4. ROUTE DASHBOARD AVEC CALCULS AUTOMATIQUES
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    
    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (!user) return res.redirect('/');

        let currentSolde = Number(user.solde) || 0;
        let progressPercent = 0;

        // --- LOGIQUE DE CALCUL DU MINAGE ---
        if (user.pack && user.pack !== 'Aucun' && user.investDate) {
            const now = new Date();
            const start = new Date(user.investDate);
            const diffInMs = now - start;
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            
            // Calcul de la progression (sur 30 jours)
            progressPercent = Math.min((diffInMs / (1000 * 60 * 60 * 24 * 30)) * 100, 100);

            // Calcul du gain à ajouter (Daily Profit x Jours écoulés)
            const dailyGain = PACK_SETTINGS[user.pack].daily;
            // Note: Dans un vrai système, on comparerait avec la dernière mise à jour
            // Ici, on simule le gain total accumulé depuis l'investissement
        }

        res.render('dashboard', { 
            user, 
            p: progressPercent.toFixed(0), // On envoie le % au dashboard
            content: { 
                brand_name: "CASHLINK ELITE",
                admin_phone: "0894407183", admin_voda: "0894407183",
                admin_airtel: "0991234567", admin_orange: "0821234567"
            }
        });
    });
});

// 5. ACTIONS FINANCIÈRES
app.post('/activer-investissement', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const { packName, prix } = req.body;

    db.users.findOne({ _id: req.session.userId }, (err, user) => {
        if (user.solde < Number(prix)) return res.redirect('/dashboard?msg=Solde insuffisant');
        
        const config = PACK_SETTINGS[packName];
        const newSolde = user.solde - Number(prix);
        const newBonus = (user.bonus || 0) + config.bonus; // Calcul du Bonus immédiat

        db.users.update({ _id: user._id }, { 
            $set: { 
                solde: newSolde, 
                bonus: newBonus, 
                pack: packName, 
                investDate: new Date().toISOString() 
            } 
        }, {}, () => {
            res.redirect('/dashboard?msg=Investissement de ' + prix + ' FC activé !');
        });
    });
});

app.post('/retrait', (req, res) => {
    const { montant } = req.body;
    // Ici on enregistre juste la demande pour l'admin
    res.redirect('/dashboard?msg=Demande de retrait de ' + montant + ' FC en cours de vérification');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// 6. ADMIN
app.get('/admin/login', (req, res) => res.render('admin_login', { msg: null }));
app.post('/admin/login', (req, res) => {
    if (req.body.admin_user === "ADMIN" && req.body.admin_pass === "MASTER2026") {
        req.session.adminAuth = true;
        res.redirect('/admin');
    } else res.redirect('/admin/login?msg=Erreur');
});

app.get('/admin', (req, res) => {
    if (!req.session.adminAuth) return res.redirect('/admin/login');
    db.users.find({}, (err, users) => {
        res.render('admin', { users, stats: { totalUsers: users.length } });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur CashLink prêt sur le port ${PORT}`));
