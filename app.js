/**
 * CASHLINK v21.0 - MONGODB ATLAS PERMANENT
 */
const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const path       = require('path');
const { MongoClient } = require('mongodb');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'cashlink_titan_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

/* ── BASE DE DONNÉES MONGODB ──────────────────────────────────────────────── */
const MONGO_URI = process.env.MONGODB_URI;
console.log('[DB] MONGODB_URI présent:', !!MONGO_URI);
if (!MONGO_URI) {
    console.error('[FATAL] MONGODB_URI non défini dans les variables d\'environnement !');
    process.exit(1);
}

let _db;
let dbConnected = false;
let dbError     = 'En cours de connexion...';

const col = (name) => _db.collection(name);

/* Génère un ID string unique pour chaque document */
const genId = (prefix) => prefix + Date.now() + Math.random().toString(36).slice(2, 6);

/* ── HELPERS DB ───────────────────────────────────────────────────────────── */
const dbFindOne = (colName, q)         => col(colName).findOne(q);
const dbFind    = (colName, q, sort)   => { let c = col(colName).find(q); if (sort) c = c.sort(sort); return c.toArray(); };
const dbInsert  = async (colName, doc) => { const d = { ...doc }; if (!d._id) d._id = genId(colName[0].toUpperCase()); await col(colName).insertOne(d); return d; };
const dbUpdate  = (colName, q, u, o={})=> o.multi ? col(colName).updateMany(q,u) : col(colName).updateOne(q,u);
const dbRemove  = (colName, q, o={})   => o.multi ? col(colName).deleteMany(q)   : col(colName).deleteOne(q);

/* ── CONFIG ──────────────────────────────────────────────────────────────── */
let cfg = {
    brand_name:'CASH LINK', admin_voda:'810000000', admin_airtel:'970000000',
    admin_orange:'890000000', contact_phone:'820000000',
    contact_address:'Gombe, Kinshasa, RDC', contact_email:'support@cashlink.cd',
    puissance_hash:'104.2 TH/s', cover_url:'', main_title:'MINAGE INDUSTRIEL',
    cert_price:30000,
    about_text:'CashLink est le leader du minage numérique décentralisé en RDC.',
    rules_text:'1. Un seul pack par utilisateur.\n2. Parrainage 10% cash.\n3. Retraits 1.000 FC min.',
    price_BRONZE:50000,  daily_BRONZE:5000,
    price_SILVER:150000, daily_SILVER:15000,
    price_GOLD:500000,   daily_GOLD:40000,
    price_DIAMOND:1000000, daily_DIAMOND:100000
};
const PACKS     = ['BRONZE','SILVER','GOLD','DIAMOND'];
const ADMIN_PWD = process.env.ADMIN_PASS || 'cashlink2026';

/* ── UTILITAIRES ─────────────────────────────────────────────────────────── */
const remainMs  = u => (!u||!u.investDate||u.pack==='Aucun') ? 0 : Math.max(0, new Date(u.investDate).getTime()+86400000-Date.now());
const progress  = u => { if(!u||u.pack==='Aucun') return 0; const ms=remainMs(u); return ms===0?100:Math.floor(((86400000-ms)/86400000)*100); };
const gradients = { BRONZE:'linear-gradient(135deg,#10b981,#059669)', SILVER:'linear-gradient(135deg,#6366f1,#4f46e5)', GOLD:'linear-gradient(135deg,#f59e0b,#d97706)', DIAMOND:'linear-gradient(135deg,#ef4444,#dc2626)' };
const addLog    = async t => { try { await dbInsert('logs',{text:t,date:new Date().toLocaleString('fr-FR'),createdAt:new Date()}); }catch(e){} };
const alertBack = (msg) => '<script>alert('+JSON.stringify(String(msg))+');window.history.back();</script>';
const authUser  = (req,res,next) => req.session.userId  ? next() : res.redirect('/');
const authAdmin = (req,res,next) => req.session.isAdmin ? next() : res.redirect('/admin-login');

/* ── SANTÉ & PAGE DB EN ATTENTE ─────────────────────────────────────────── */
app.get('/health', (req, res) => res.json({ status: dbConnected ? 'ok' : 'connecting', error: dbError }));

/* Bloque toutes les routes (sauf /health et /admin-login) si DB non connectée */
app.use((req, res, next) => {
    if (dbConnected) return next();
    if (req.path === '/health' || req.path === '/admin-login') return next();
    res.status(503).send(`
        <html><head><meta http-equiv="refresh" content="10"><title>CashLink</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
        <h2 style="color:#f59e0b">⚙️ CashLink démarre...</h2>
        <p>Connexion à la base de données en cours. La page se rafraîchira automatiquement.</p>
        <p style="color:#ef4444;font-size:13px">${dbError}</p>
        </body></html>
    `);
});

/* ==========================================================================
   ROUTES PUBLIQUES
   ========================================================================== */
app.get('/', (req,res) => req.session.userId ? res.redirect('/dashboard') : res.render('login'));

app.post('/register', async (req,res) => {
    try {
        const {username,phone,password,ref,q_naissance,q_pere} = req.body;
        if (!username||!phone||!password) return res.send(alertBack('Tous les champs sont obligatoires.'));
        const uid = 'U'+Date.now();
        const doc = { id:uid, username:username.trim(), phone:String(phone).trim(),
            password, q_naissance:q_naissance||'', q_pere:q_pere||'',
            solde:0, bonus:0, pack:'Aucun', referredBy:ref||null,
            investDate:null, certified:false, role:'USER', createdAt:new Date() };
        const saved = await dbInsert('users', doc);
        await addLog('Nouveau membre : '+saved.username);
        req.session.userId = saved.id;
        req.session.save(() => res.redirect('/dashboard'));
    } catch(e) {
        if (e.code===11000) return res.send(alertBack('Ce nom ou numéro est déjà utilisé.'));
        console.error('[REGISTER]', e.message);
        res.send(alertBack('Erreur technique : '+e.message));
    }
});

app.post('/login', async (req,res) => {
    try {
        const {username,password} = req.body;
        if (!username||!password) return res.send(alertBack('Champs manquants.'));
        const user = await dbFindOne('users',{username:username.trim(),password});
        if (user) { req.session.userId=user.id; req.session.save(()=>res.redirect('/dashboard')); }
        else res.send(alertBack('Identifiant ou mot de passe incorrect.'));
    } catch(e) { console.error('[LOGIN]',e.message); res.send(alertBack('Erreur: '+e.message)); }
});

app.post('/recovery', async (req,res) => {
    try {
        const {phone,q_naissance,q_pere} = req.body;
        const u = await dbFindOne('users',{phone:String(phone).trim(),q_naissance,q_pere});
        if (u) res.send(alertBack('Votre mot de passe : '+u.password));
        else   res.send(alertBack('Informations incorrectes.'));
    } catch(e) { res.send(alertBack('Erreur: '+e.message)); }
});

app.get('/logout', (req,res) => req.session.destroy(()=>res.redirect('/')));

/* ==========================================================================
   ROUTES CLIENT
   ========================================================================== */
app.get('/dashboard', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        if (!user) { req.session.destroy(); return res.redirect('/'); }
        res.render('dashboard',{user,content:cfg,p:progress(user),msRemaining:remainMs(user)});
    } catch(e) { res.status(500).send('Erreur dashboard: '+e.message); }
});

app.get('/depot', authUser, async (req,res) => {
    try { const user=await dbFindOne('users',{id:req.session.userId}); res.render('depot',{user,content:cfg}); }
    catch(e) { res.redirect('/dashboard'); }
});

app.post('/process-depot', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const {montant,reference,type_paiement} = req.body;
        await dbInsert('transactions',{
            utilisateur:user.username, username:user.username,
            phone:user.phone, userId:user.id, pack:'DEPOT', type:type_paiement||'Dépôt',
            montant:parseInt(montant)||0, reference, tid:reference,
            statut:'EN_ATTENTE', date:new Date().toLocaleString('fr-FR'), createdAt:new Date()
        });
        await addLog('Dépôt soumis par '+user.username+' : '+reference);
        res.redirect('/dashboard?msg=TID_SENT');
    } catch(e) { res.redirect('/dashboard?err=1'); }
});

app.get('/packs', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const packs = PACKS.map(id=>({id,grad:gradients[id],price:cfg['price_'+id]||0,daily:cfg['daily_'+id]||0}));
        res.render('packs',{user,packs,content:cfg});
    } catch(e) { res.redirect('/dashboard'); }
});

app.post('/souscrire-pack', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const {packName,prix,reference} = req.body;
        await dbInsert('transactions',{
            utilisateur:user.username, username:user.username,
            phone:user.phone, userId:user.id, pack:packName, type:packName,
            montant:parseInt(prix)||0, reference, tid:reference,
            statut:'EN_ATTENTE', date:new Date().toLocaleString('fr-FR'), createdAt:new Date()
        });
        await addLog('TID soumis: '+user.username+' pack '+packName);
        res.redirect('/dashboard?msg=TID_SENT');
    } catch(e) { res.redirect('/dashboard?err=1'); }
});

app.post('/activer-investissement', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const {pack,prix,reference} = req.body;
        await dbInsert('transactions',{
            utilisateur:user.username, username:user.username,
            phone:user.phone, userId:user.id, pack, type:pack,
            montant:parseInt(prix)||0, reference, tid:reference,
            statut:'EN_ATTENTE', date:new Date().toLocaleString('fr-FR'), createdAt:new Date()
        });
        res.redirect('/paiement-instructions?packName='+encodeURIComponent(pack)+'&prix='+prix);
    } catch(e) { res.redirect('/packs'); }
});

app.get('/paiement-instructions', authUser, (req,res) => {
    const {packName,prix} = req.query;
    res.render('paiement-instructions',{packName,prix,content:cfg});
});

app.post('/confirmer-envoi', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const {packName,prix,tid} = req.body;
        await dbInsert('transactions',{
            utilisateur:user.username, username:user.username,
            phone:user.phone, userId:user.id, pack:packName, type:packName,
            montant:parseInt(prix)||0, reference:tid, tid,
            statut:'EN_ATTENTE', date:new Date().toLocaleString('fr-FR'), createdAt:new Date()
        });
        await addLog('TID confirmé par '+user.username+' : '+tid);
        res.redirect('/dashboard?msg=TID_SENT');
    } catch(e) { res.redirect('/dashboard'); }
});

app.post('/activer-gain', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        if (user.pack!=='Aucun' && progress(user)>=100) {
            const gain = cfg['daily_'+user.pack]||0;
            await dbUpdate('users',{id:user.id},{$inc:{bonus:gain},$set:{investDate:new Date()}});
        }
        res.redirect('/dashboard');
    } catch(e) { res.redirect('/dashboard'); }
});

app.get('/retrait', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const transactions = await dbFind('retraits',{userId:user.id},{createdAt:-1});
        res.render('retrait',{user,transactions,content:cfg});
    } catch(e) { res.redirect('/dashboard'); }
});

app.post('/retrait', authUser, async (req,res) => {
    try {
        const user = await dbFindOne('users',{id:req.session.userId});
        const m = parseInt(req.body.montant);
        if (!user||user.bonus<m||m<1000) return res.send(alertBack('Solde insuffisant ou montant trop bas (min 1.000 FC).'));
        await dbUpdate('users',{id:user.id},{$inc:{bonus:-m}});
        await dbInsert('retraits',{
            username:user.username, phone:user.phone,
            userId:user.id, montant:m, statut:'En attente',
            date:new Date().toLocaleString('fr-FR'), createdAt:new Date()
        });
        await addLog('Retrait: '+user.username+' | '+m+' FC');
        res.redirect('/dashboard?msg=RETRAIT_OK');
    } catch(e) { res.redirect('/dashboard?err=1'); }
});

/* ==========================================================================
   ADMIN
   ========================================================================== */
app.get('/admin-login', (req,res) => req.session.isAdmin ? res.redirect('/admin') : res.render('admin_login',{error:null}));

app.post('/admin-login', (req,res) => {
    if (req.body.password===ADMIN_PWD) { req.session.isAdmin=true; req.session.save(()=>res.redirect('/admin')); }
    else res.render('admin_login',{error:'Mot de passe incorrect.'});
});

app.get('/admin-logout', (req,res) => { req.session.isAdmin=false; req.session.save(()=>res.redirect('/admin-login')); });

app.get('/admin', authAdmin, async (req,res) => {
    try {
        const now=new Date(), sod=new Date(now); sod.setHours(0,0,0,0);
        const som=new Date(now); som.setDate(1); som.setHours(0,0,0,0);
        const soy=new Date(now); soy.setMonth(0,1); soy.setHours(0,0,0,0);

        const allUsers   = await dbFind('users',{});
        const pending    = await dbFind('transactions',{statut:'EN_ATTENTE'},{createdAt:-1});
        const pendingRet = await dbFind('retraits',{statut:'En attente'},{createdAt:-1});
        const approved   = await dbFind('transactions',{statut:'APPROUVE'});
        const logs       = await dbFind('logs',{},{createdAt:-1});

        const transactions = pending.map(t=>({...t,utilisateur:t.utilisateur||t.username,type:t.type||t.pack,reference:t.reference||t.tid}));
        const sum   = arr => arr.reduce((a,t)=>a+(t.montant||0),0);
        const today = approved.filter(t=>new Date(t.createdAt)>=sod);
        const month = approved.filter(t=>new Date(t.createdAt)>=som);
        const year  = approved.filter(t=>new Date(t.createdAt)>=soy);

        const stats = {
            totalUsers:allUsers.length, enAttente:pending.length,
            usersToday:allUsers.filter(u=>new Date(u.createdAt)>=sod).length,
            packsToday:sum(today), packsMonth:sum(month),
            packsYear:sum(year),   totalGagne:sum(approved),
            soldeTotalUsers:allUsers.reduce((a,u)=>a+(u.bonus||0),0)
        };
        res.render('admin',{stats,transactions,retraits:pendingRet,users:allUsers,site:cfg,content:cfg,packs:PACKS,logs:logs.slice(0,50)});
    } catch(e) { res.status(500).send('Erreur admin: '+e.message); }
});

app.post('/valider-depot', authAdmin, async (req,res) => {
    try {
        const tx = await dbFindOne('transactions',{_id:req.body.txId});
        if (!tx) return res.redirect('/admin');
        const bonuses = {BRONZE:5000,SILVER:9000,GOLD:40000,DIAMOND:120000};
        await dbUpdate('users',{id:tx.userId},{$set:{pack:tx.pack,investDate:new Date()},$inc:{solde:tx.montant,bonus:bonuses[tx.pack]||0}});
        const user = await dbFindOne('users',{id:tx.userId});
        if (user&&user.referredBy) await dbUpdate('users',{id:user.referredBy},{$inc:{bonus:Math.floor(tx.montant*0.10)}});
        await dbUpdate('transactions',{_id:tx._id},{$set:{statut:'APPROUVE'}});
        await addLog('VALIDÉ: '+tx.utilisateur+' | '+tx.pack+' | '+tx.montant+' FC');
        res.redirect('/admin');
    } catch(e) { console.error('[VALIDER]',e.message); res.redirect('/admin'); }
});

app.post('/admin/reject-tx', authAdmin, async (req,res) => {
    try { await dbUpdate('transactions',{_id:req.body.txId},{$set:{statut:'REJETE'}}); res.redirect('/admin'); }
    catch(e) { res.redirect('/admin'); }
});

app.post('/admin/approve-retrait', authAdmin, async (req,res) => {
    try { await dbUpdate('retraits',{_id:req.body.retId},{$set:{statut:'Payé'}}); res.redirect('/admin'); }
    catch(e) { res.redirect('/admin'); }
});

app.delete('/admin/delete-user/:id', authAdmin, async (req,res) => {
    try { await dbRemove('users',{_id:req.params.id}); res.json({ok:true}); }
    catch(e) { res.json({ok:false,error:e.message}); }
});

app.post('/admin/update-content', authAdmin, (req,res) => {
    const updates = {...req.body};
    ['cert_price'].forEach(f => { if(updates[f]!==undefined) updates[f]=parseInt(updates[f])||0; });
    cfg = {...cfg,...updates};
    res.redirect('/admin');
});

app.post('/admin/update-packs-config', authAdmin, (req,res) => {
    const updates = {...req.body};
    ['BRONZE','SILVER','GOLD','DIAMOND'].forEach(p => {
        if(updates['price_'+p]!==undefined) updates['price_'+p]=parseInt(updates['price_'+p])||0;
        if(updates['daily_'+p]!==undefined) updates['daily_'+p]=parseInt(updates['daily_'+p])||0;
    });
    cfg = {...cfg,...updates};
    res.redirect('/admin');
});

/* CRON : gains quotidiens */
setInterval(async () => {
    if (!dbConnected) return;
    try {
        const active = await dbFind('users',{pack:{$ne:'Aucun'}});
        for (const u of active) {
            if (!u.investDate) continue;
            if (Date.now()-new Date(u.investDate).getTime()>=86400000)
                await dbUpdate('users',{id:u.id},{$inc:{bonus:cfg['daily_'+u.pack]||0},$set:{investDate:new Date()}});
        }
    } catch(e) { console.error('[CRON]',e.message); }
}, 30*60*1000);

app.use((err,req,res,next) => {
    console.error('[ERR]',err.message);
    res.status(500).send('<h2>Erreur</h2><pre>'+err.message+'</pre>');
});

/* ── CONNEXION MONGODB ET DÉMARRAGE ──────────────────────────────────────── */
async function connectMongo() {
    try {
        console.log('[DB] Connexion à MongoDB Atlas...');
        const client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000
        });
        await client.connect();
        _db = client.db();
        await _db.collection('users').createIndex({username:1},{unique:true});
        await _db.collection('users').createIndex({phone:1},{unique:true});
        dbConnected = true;
        dbError     = '';
        console.log('[DB] MongoDB Atlas connecté avec succès ! DB:', _db.databaseName);
    } catch(e) {
        dbConnected = false;
        dbError     = e.message;
        console.error('[DB] Connexion échouée:', e.message);
        console.error('[DB] Nouvelle tentative dans 30 secondes...');
        setTimeout(connectMongo, 30000);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('[CASHLINK v21.0] Port '+PORT+' | Démarré - connexion MongoDB en cours...');
    connectMongo();
});
