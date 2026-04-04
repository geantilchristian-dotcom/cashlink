/**
   * ==========================================================================
   * CASHLINK GLOBAL CORE v19.0 - VERSION FINALE COMPLÈTE
   * Toutes les routes, NeDB persistant, admin sécurisé
   * ==========================================================================
   */

  const express  = require('express');
  const session  = require('express-session');
  const bodyParser = require('body-parser');
  const path     = require('path');
  const Datastore = require('nedb');

  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(session({
      secret: 'cashlink_titan_ultra_secret_2026',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

  /* ── BASE DE DONNÉES PERSISTANTE ─────────────────────────────────────── */
  const usersDB = new Datastore({ filename: path.join(__dirname, 'database/users.db'),        autoload: true });
  const txDB    = new Datastore({ filename: path.join(__dirname, 'database/transactions.db'), autoload: true });
  const retDB   = new Datastore({ filename: path.join(__dirname, 'database/retraits.db'),    autoload: true });
  const logDB   = new Datastore({ filename: path.join(__dirname, 'database/logs.db'),        autoload: true });

  usersDB.ensureIndex({ fieldName: 'username', unique: true });
  usersDB.ensureIndex({ fieldName: 'phone',    unique: true });

  const findOne = (db, q)     => new Promise((ok,ko) => db.findOne(q, (e,d)   => e ? ko(e) : ok(d)));
  const find    = (db, q, s)  => new Promise((ok,ko) => db.find(q).sort(s||{}).exec((e,d) => e ? ko(e) : ok(d)));
  const insert  = (db, d)     => new Promise((ok,ko) => db.insert(d, (e,r)    => e ? ko(e) : ok(r)));
  const update  = (db, q, u, o={}) => new Promise((ok,ko) => db.update(q, u, o, (e,n) => e ? ko(e) : ok(n)));
  const remove  = (db, q, o={})    => new Promise((ok,ko) => db.remove(q, o, (e,n)   => e ? ko(e) : ok(n)));
  const count   = (db, q)     => new Promise((ok,ko) => db.count(q, (e,n)    => e ? ko(e) : ok(n)));

  /* ── CONFIG ÉDITABLE ─────────────────────────────────────────────────── */
  let cfg = {
      brand_name:      'CASH LINK',
      admin_voda:      '810000000',
      admin_airtel:    '970000000',
      admin_orange:    '890000000',
      contact_phone:   '820000000',
      contact_address: 'Gombe, Kinshasa, RDC',
      contact_email:   'support@cashlink.cd',
      puissance_hash:  '104.2 TH/s',
      about_text:      'CashLink est le leader du minage numérique décentralisé en RDC.',
      rules_text:      '1. Un seul pack par utilisateur.\n2. Parrainage 10% cash.\n3. Retraits 1.000 FC min.',
      cover_url:       '',
      main_title:      'MINAGE INDUSTRIEL',
      cert_price:      30000,
      price_BRONZE: 50000,  daily_BRONZE: 5000,
      price_SILVER: 150000, daily_SILVER: 15000,
      price_GOLD:   500000, daily_GOLD:   40000,
      price_DIAMOND:1000000,daily_DIAMOND:100000
  };

  const PACK_LIST = ['BRONZE','SILVER','GOLD','DIAMOND'];
  const ADMIN_PASS = process.env.ADMIN_PASS || 'cashlink2026';

  /* ── UTILITAIRES ─────────────────────────────────────────────────────── */
  function remainingMs(user) {
      if (!user || !user.investDate || user.pack === 'Aucun') return 0;
      const diff = new Date(user.investDate).getTime() + 86400000 - Date.now();
      return diff > 0 ? diff : 0;
  }
  function progress(user) {
      if (!user || user.pack === 'Aucun') return 0;
      const ms = remainingMs(user);
      return ms === 0 ? 100 : Math.floor(((86400000 - ms) / 86400000) * 100);
  }
  function packGrad(id) {
      const g = { BRONZE:'linear-gradient(135deg,#10b981,#059669)', SILVER:'linear-gradient(135deg,#6366f1,#4f46e5)', GOLD:'linear-gradient(135deg,#f59e0b,#d97706)', DIAMOND:'linear-gradient(135deg,#ef4444,#dc2626)' };
      return g[id] || '#333';
  }
  async function addLog(text) {
      try { await insert(logDB, { text, date: new Date().toLocaleString('fr-FR') }); } catch(e) {}
  }
  function startOfDay()   { const d=new Date(); d.setHours(0,0,0,0); return d; }
  function startOfMonth()  { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }
  function startOfYear()  { const d=new Date(); d.setMonth(0,1); d.setHours(0,0,0,0); return d; }

  /* ── MIDDLEWARES ─────────────────────────────────────────────────────── */
  const authUser  = (req,res,next) => req.session.userId   ? next() : res.redirect('/');
  const authAdmin = (req,res,next) => req.session.isAdmin  ? next() : res.redirect('/admin-login');

  /* ==========================================================================
     ROUTES PUBLIQUES
     ========================================================================== */

  app.get('/', (req,res) => {
      if (req.session.userId) return res.redirect('/dashboard');
      res.render('login');
  });

  /* INSCRIPTION */
  app.post('/register', async (req,res) => {
      try {
          const { username, phone, password, ref, q_naissance, q_pere } = req.body;
          if (!username || !phone || !password)
              return res.send("<script>alert('Tous les champs sont obligatoires.');window.history.back();</script>");

          const saved = await insert(usersDB, {
              id: 'U'+Date.now(), username: username.trim(),
              phone: String(phone).trim(), password,
              q_naissance: q_naissance||'', q_pere: q_pere||'',
              solde:0, bonus:0, pack:'Aucun',
              referredBy: ref||null, investDate:null,
              certified:false, role:'USER', createdAt: new Date()
          });
          await addLog('Nouveau membre : '+saved.username);
          req.session.userId = saved.id;
          req.session.save(() => res.redirect('/dashboard'));
      } catch(e) {
          if (e.errorType === 'uniqueViolated')
              return res.send("<script>alert('Ce nom ou numéro est déjà utilisé.');window.history.back();</script>");
          console.error('[REGISTER]',e);
          res.send("<script>alert('Erreur inscription. Réessayez.');window.history.back();</script>");
      }
  });

  /* CONNEXION */
  app.post('/login', async (req,res) => {
      try {
          const { username, password } = req.body;
          if (!username||!password)
              return res.send("<script>alert('Champs manquants.');window.history.back();</script>");
          const user = await findOne(usersDB, { username: username.trim(), password });
          if (user) {
              req.session.userId = user.id;
              req.session.save(() => res.redirect('/dashboard'));
          } else {
              res.send("<script>alert('Identifiant ou mot de passe incorrect.');window.history.back();</script>");
          }
      } catch(e) {
          console.error('[LOGIN]',e);
          res.send("<script>alert('Erreur connexion.');window.history.back();</script>");
      }
  });

  /* RÉCUPÉRATION MOT DE PASSE */
  app.post('/recovery', async (req,res) => {
      try {
          const { phone, q_naissance, q_pere } = req.body;
          const user = await findOne(usersDB, { phone: String(phone).trim(), q_naissance, q_pere });
          if (user) {
              res.send('<script>alert("Votre mot de passe : "+'+JSON.stringify(user.password)+');window.history.back();</script>');
          } else {
              res.send("<script>alert('Informations incorrectes.');window.history.back();</script>");
          }
      } catch(e) { res.send("<script>alert('Erreur.');window.history.back();</script>"); }
  });

  /* DÉCONNEXION */
  app.get('/logout', (req,res) => req.session.destroy(() => res.redirect('/')));

  /* ==========================================================================
     ROUTES CLIENT PROTÉGÉES
     ========================================================================== */

  /* DASHBOARD */
  app.get('/dashboard', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          if (!user) { req.session.destroy(); return res.redirect('/'); }
          res.render('dashboard', { user, content: cfg, p: progress(user), msRemaining: remainingMs(user) });
      } catch(e) {
          console.error('[DASHBOARD]',e);
          res.status(500).send('Erreur tableau de bord : '+e.message);
      }
  });

  /* PAGE DÉPÔT */
  app.get('/depot', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          res.render('depot', { user, content: cfg });
      } catch(e) { res.redirect('/dashboard'); }
  });

  /* TRAITEMENT DÉPÔT (depuis depot.ejs) */
  app.post('/process-depot', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const { montant, reference, type_paiement } = req.body;
          await insert(txDB, {
              id: 'TX'+Date.now(), username: user.username,
              utilisateur: user.username, phone: user.phone,
              userId: user.id, pack: 'DEPOT', type: type_paiement||'Dépôt',
              montant: parseInt(montant)||0, tid: reference, reference,
              statut: 'EN_ATTENTE', date: new Date().toLocaleString('fr-FR'), createdAt: new Date()
          });
          await addLog('Dépôt TID soumis par '+user.username+' : '+reference);
          res.redirect('/dashboard?msg=TID_SENT');
      } catch(e) { res.redirect('/dashboard?err=1'); }
  });

  /* PAGE PACKS */
  app.get('/packs', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const packs = PACK_LIST.map(id => ({
              id, grad: packGrad(id),
              price:  cfg['price_'+id]  || 0,
              daily:  cfg['daily_'+id]  || 0
          }));
          res.render('packs', { user, packs, content: cfg });
      } catch(e) { res.redirect('/dashboard'); }
  });

  /* SOUSCRIPTION PACK (depuis dashboard modal) */
  app.post('/souscrire-pack', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const { packName, prix, reference } = req.body;
          await insert(txDB, {
              id: 'TX'+Date.now(), username: user.username,
              utilisateur: user.username, phone: user.phone,
              userId: user.id, pack: packName, type: packName,
              montant: parseInt(prix)||0, tid: reference, reference,
              statut: 'EN_ATTENTE', date: new Date().toLocaleString('fr-FR'), createdAt: new Date()
          });
          await addLog('TID soumis par '+user.username+' pour pack '+packName);
          res.redirect('/dashboard?msg=TID_SENT');
      } catch(e) { res.redirect('/dashboard?err=1'); }
  });

  /* ACTIVER INVESTISSEMENT (depuis packs.ejs) */
  app.post('/activer-investissement', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const { pack, prix, reference } = req.body;
          await insert(txDB, {
              id: 'TX'+Date.now(), username: user.username,
              utilisateur: user.username, phone: user.phone,
              userId: user.id, pack, type: pack,
              montant: parseInt(prix)||0, tid: reference, reference,
              statut: 'EN_ATTENTE', date: new Date().toLocaleString('fr-FR'), createdAt: new Date()
          });
          res.redirect('/paiement-instructions?packName='+encodeURIComponent(pack)+'&prix='+prix);
      } catch(e) { res.redirect('/packs?err=1'); }
  });

  /* PAGE INSTRUCTIONS DE PAIEMENT */
  app.get('/paiement-instructions', authUser, async (req,res) => {
      try {
          const { packName, prix } = req.query;
          res.render('paiement-instructions', { packName, prix, content: cfg });
      } catch(e) { res.redirect('/dashboard'); }
  });

  /* CONFIRMATION ENVOI */
  app.post('/confirmer-envoi', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const { packName, prix, tid } = req.body;
          await insert(txDB, {
              id: 'TX'+Date.now(), username: user.username,
              utilisateur: user.username, phone: user.phone,
              userId: user.id, pack: packName, type: packName,
              montant: parseInt(prix)||0, tid, reference: tid,
              statut: 'EN_ATTENTE', date: new Date().toLocaleString('fr-FR'), createdAt: new Date()
          });
          await addLog('TID confirmé par '+user.username+' : '+tid);
          res.redirect('/dashboard?msg=TID_SENT');
      } catch(e) { res.redirect('/dashboard?err=1'); }
  });

  /* ACTIVATION GAINS */
  app.post('/activer-gain', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          if (user.pack !== 'Aucun' && progress(user) >= 100) {
              const gain = cfg['daily_'+user.pack] || 0;
              await update(usersDB, { id: user.id }, { $inc:{bonus:gain}, $set:{investDate:new Date()} });
              await addLog('Gain activé par '+user.username+' : +'+gain+' FC');
          }
          res.redirect('/dashboard');
      } catch(e) { res.redirect('/dashboard'); }
  });

  /* PAGE RETRAIT */
  app.get('/retrait', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const transactions = await find(retDB, { userId: user.id }, { createdAt: -1 });
          res.render('retrait', { user, transactions, content: cfg });
      } catch(e) { res.redirect('/dashboard'); }
  });

  /* DEMANDE RETRAIT */
  app.post('/retrait', authUser, async (req,res) => {
      try {
          const user = await findOne(usersDB, { id: req.session.userId });
          const m = parseInt(req.body.montant);
          if (!user || user.bonus < m || m < 1000)
              return res.send("<script>alert('Solde insuffisant ou montant trop bas (min 1.000 FC).');window.history.back();</script>");
          await update(usersDB, { id: user.id }, { $inc:{bonus:-m} });
          await insert(retDB, {
              id: 'RET'+Date.now(), username: user.username,
              phone: user.phone, userId: user.id,
              montant: m, statut: 'En attente',
              date: new Date().toLocaleString('fr-FR'), createdAt: new Date()
          });
          await addLog('Retrait demandé par '+user.username+' : '+m+' FC');
          res.redirect('/dashboard?msg=RETRAIT_OK');
      } catch(e) { res.redirect('/dashboard?err=1'); }
  });

  /* ==========================================================================
     ADMIN
     ========================================================================== */

  /* LOGIN ADMIN */
  app.get('/admin-login', (req,res) => {
      if (req.session.isAdmin) return res.redirect('/admin');
      res.render('admin_login', { error: null });
  });

  app.post('/admin-login', (req,res) => {
      if (req.body.password === ADMIN_PASS) {
          req.session.isAdmin = true;
          req.session.save(() => res.redirect('/admin'));
      } else {
          res.render('admin_login', { error: 'Mot de passe incorrect.' });
      }
  });

  app.get('/admin-logout', (req,res) => {
      req.session.isAdmin = false;
      req.session.save(() => res.redirect('/admin-login'));
  });

  /* PANNEAU ADMIN */
  app.get('/admin', authAdmin, async (req,res) => {
      try {
          const now   = new Date();
          const sod   = startOfDay();
          const som   = startOfMonth();
          const soy   = startOfYear();

          const allUsers = await find(usersDB, {});
          const pendingTx = await find(txDB, { statut: 'EN_ATTENTE' }, { createdAt: -1 });
          const pendingRet = await find(retDB, { statut: 'En attente' }, { createdAt: -1 });
          const approvedTx = await find(txDB, { statut: 'APPROUVE' });
          const logs = await find(logDB, {}, { _id: -1 });

          // Transactions en attente mappées pour admin.ejs
          const transactions = pendingTx.map(tx => ({
              ...tx,
              utilisateur: tx.utilisateur || tx.username,
              type:        tx.type        || tx.pack,
              reference:   tx.reference   || tx.tid
          }));

          const txToday = approvedTx.filter(t => new Date(t.createdAt) >= sod);
          const txMonth = approvedTx.filter(t => new Date(t.createdAt) >= som);
          const txYear  = approvedTx.filter(t => new Date(t.createdAt) >= soy);
          const usersToday = allUsers.filter(u => new Date(u.createdAt) >= sod).length;
          const sum = arr => arr.reduce((a,t) => a+(t.montant||0),0);

          const stats = {
              totalUsers:      allUsers.length,
              enAttente:       pendingTx.length,
              usersToday,
              packsToday:      sum(txToday),
              packsMonth:      sum(txMonth),
              packsYear:       sum(txYear),
              totalGagne:      sum(approvedTx),
              soldeTotalUsers: allUsers.reduce((a,u) => a+(u.bonus||0),0)
          };

          res.render('admin', {
              stats, transactions, retraits: pendingRet,
              users: allUsers, site: cfg, content: cfg,
              packs: PACK_LIST, logs: logs.slice(0,50)
          });
      } catch(e) {
          console.error('[ADMIN]',e);
          res.status(500).send('Erreur admin : '+e.message);
      }
  });

  /* VALIDER DÉPÔT */
  app.post('/valider-depot', authAdmin, async (req,res) => {
      try {
          const tx = await findOne(txDB, { _id: req.body.txId });
          if (!tx) return res.redirect('/admin');

          const bonuses = { BRONZE:5000, SILVER:9000, GOLD:40000, DIAMOND:120000 };
          const bonus   = bonuses[tx.pack] || 0;

          await update(usersDB, { id: tx.userId }, {
              $set: { pack: tx.pack, investDate: new Date() },
              $inc: { solde: tx.montant, bonus }
          });

          // Parrainage 10%
          const user = await findOne(usersDB, { id: tx.userId });
          if (user && user.referredBy) {
              const comm = Math.floor(tx.montant * 0.10);
              await update(usersDB, { id: user.referredBy }, { $inc:{bonus:comm} });
              await addLog('Parrainage +'+comm+' FC pour le parrain de '+user.username);
          }

          await update(txDB, { _id: tx._id }, { $set:{ statut:'APPROUVE' } });
          await addLog('Transaction APPROUVÉE : '+tx.utilisateur+' | pack '+tx.pack+' | '+tx.montant+' FC');
          res.redirect('/admin');
      } catch(e) { console.error('[VALIDER]',e); res.redirect('/admin'); }
  });

  /* REJETER TRANSACTION */
  app.post('/admin/reject-tx', authAdmin, async (req,res) => {
      try {
          await update(txDB, { _id: req.body.txId }, { $set:{ statut:'REJETE' } });
          res.redirect('/admin');
      } catch(e) { res.redirect('/admin'); }
  });

  /* VALIDER RETRAIT */
  app.post('/admin/approve-retrait', authAdmin, async (req,res) => {
      try {
          await update(retDB, { _id: req.body.retId }, { $set:{ statut:'Payé' } });
          const ret = await findOne(retDB, { _id: req.body.retId });
          if (ret) await addLog('Retrait payé : '+ret.username+' | '+ret.montant+' FC');
          res.redirect('/admin');
      } catch(e) { res.redirect('/admin'); }
  });

  /* SUPPRIMER UTILISATEUR (AJAX) */
  app.delete('/admin/delete-user/:id', authAdmin, async (req,res) => {
      try {
          await remove(usersDB, { _id: req.params.id });
          res.json({ ok: true });
      } catch(e) { res.json({ ok:false }); }
  });

  /* MISE À JOUR CONTENU */
  app.post('/admin/update-content', authAdmin, (req,res) => {
      cfg = { ...cfg, ...req.body };
      res.redirect('/admin');
  });

  /* MISE À JOUR CONFIG PACKS */
  app.post('/admin/update-packs-config', authAdmin, (req,res) => {
      cfg = { ...cfg, ...req.body };
      res.redirect('/admin');
  });

  /* ==========================================================================
     CRON : GAINS QUOTIDIENS AUTOMATIQUES
     ========================================================================== */
  setInterval(async () => {
      try {
          const active = await find(usersDB, { pack: { $ne:'Aucun' } });
          for (const u of active) {
              if (!u.investDate) continue;
              if (Date.now() - new Date(u.investDate).getTime() >= 86400000) {
                  const gain = cfg['daily_'+u.pack] || 0;
                  await update(usersDB, { id:u.id }, { $inc:{bonus:gain}, $set:{investDate:new Date()} });
              }
          }
      } catch(e) { console.error('[CRON]',e); }
  }, 30 * 60 * 1000);

  /* GESTIONNAIRE D'ERREURS */
  app.use((err,req,res,next) => {
      console.error('[ERR]',err);
      res.status(500).send('<h2 style="font-family:sans-serif;color:red">Erreur serveur</h2><pre>'+err.message+'</pre>');
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('[CASHLINK v19.0] Port '+PORT));
  