/**
   * ==========================================================================
   * CASHLINK GLOBAL CORE v18.2 - PERSISTANCE NEDB + ROUTES COMPLÈTES
   * DÉVELOPPÉ POUR : ANASH MASTER (RDC 2026)
   * ==========================================================================
   */

  const express = require('express');
  const session = require('express-session');
  const bodyParser = require('body-parser');
  const path = require('path');
  const Datastore = require('nedb');

  const app = express();

  // --- CONFIGURATION SYSTÈME ---
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // --- SESSIONS ---
  app.use(session({
      secret: 'cashlink_titan_ultra_secret_2026_anash_master',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  }));

  /* ==========================================================================
     BASE DE DONNÉES PERSISTANTE (NEDB - FICHIERS SUR DISQUE)
     Les données survivent aux redémarrages du serveur.
     ========================================================================== */
  const usersDB = new Datastore({ filename: path.join(__dirname, 'database/users.db'), autoload: true });
  const txDB    = new Datastore({ filename: path.join(__dirname, 'database/transactions.db'), autoload: true });
  const retDB   = new Datastore({ filename: path.join(__dirname, 'database/retraits.db'), autoload: true });

  usersDB.ensureIndex({ fieldName: 'username', unique: true });
  usersDB.ensureIndex({ fieldName: 'phone',    unique: true });

  // Helpers Promesse pour NeDB
  const dbFindOne = (col, q) => new Promise((ok, ko) => col.findOne(q, (e, d) => e ? ko(e) : ok(d)));
  const dbFind    = (col, q) => new Promise((ok, ko) => col.find(q,    (e, d) => e ? ko(e) : ok(d)));
  const dbInsert  = (col, d) => new Promise((ok, ko) => col.insert(d,  (e, r) => e ? ko(e) : ok(r)));
  const dbUpdate  = (col, q, u, o={}) => new Promise((ok, ko) => col.update(q, u, o, (e, n) => e ? ko(e) : ok(n)));
  const dbRemove  = (col, q, o={}) => new Promise((ok, ko) => col.remove(q, o, (e, n) => e ? ko(e) : ok(n)));

  /* ==========================================================================
     CONFIGURATION ÉDITABLE DU SITE
     ========================================================================== */
  let siteContent = {
      brand_name:       "CASH LINK",
      admin_voda:       "810000000",
      admin_airtel:     "970000000",
      admin_orange:     "890000000",
      contact_phone:    "820000000",
      contact_address:  "Gombe, Kinshasa, RDC",
      contact_email:    "support@cashlink.cd",
      puissance_hash:   "104.2 TH/s",
      about_text:       "CashLink est le leader du minage numérique décentralisé en RDC.",
      rules_text:       "1. Un seul pack par utilisateur.\n2. Parrainage 10% cash.\n3. Retraits 1.000 FC min."
  };

  /* ==========================================================================
     LOGIQUE DE CALCULS
     ========================================================================== */
  function getRemainingMs(user) {
      if (!user || !user.investDate || user.pack === 'Aucun') return 0;
      const next = new Date(user.investDate).getTime() + (24 * 60 * 60 * 1000);
      const diff = next - Date.now();
      return diff > 0 ? diff : 0;
  }

  function getProgress(user) {
      if (!user || user.pack === 'Aucun') return 0;
      const ms = getRemainingMs(user);
      if (ms === 0) return 100;
      return Math.floor(((24 * 3600 * 1000 - ms) / (24 * 3600 * 1000)) * 100);
  }

  // Middleware auth
  function authRequired(req, res, next) {
      if (!req.session.userId) return res.redirect('/');
      next();
  }

  /* ==========================================================================
     ROUTES PUBLIQUES
     ========================================================================== */

  app.get('/', (req, res) => {
      if (req.session.userId) return res.redirect('/dashboard');
      res.render('login');
  });

  // INSCRIPTION
  app.post('/register', async (req, res) => {
      try {
          const { username, phone, password, ref, q_naissance, q_pere } = req.body;

          if (!username || !phone || !password) {
              return res.send("<script>alert('Tous les champs sont obligatoires.'); window.history.back();</script>");
          }

          const newUser = {
              id:          'U' + Date.now(),
              username:    username.trim(),
              phone:       String(phone).trim(),
              password,
              q_naissance: q_naissance || '',
              q_pere:      q_pere || '',
              solde:       0,
              bonus:       0,
              pack:        'Aucun',
              referredBy:  ref || null,
              investDate:  null,
              certified:   false,
              role:        'USER',
              createdAt:   new Date()
          };

          const saved = await dbInsert(usersDB, newUser);
          req.session.userId = saved.id;
          req.session.save(() => res.redirect('/dashboard'));

      } catch (e) {
          if (e.errorType === 'uniqueViolated') {
              return res.send("<script>alert('Ce nom ou ce num\u00e9ro est d\u00e9j\u00e0 utilis\u00e9.'); window.history.back();</script>");
          }
          console.error('[REGISTER]', e);
          res.send("<script>alert('Erreur lors de l\'inscription. R\u00e9essayez.'); window.history.back();</script>");
      }
  });

  // CONNEXION
  app.post('/login', async (req, res) => {
      try {
          const { username, password } = req.body;
          if (!username || !password) {
              return res.send("<script>alert('Champs manquants.'); window.history.back();</script>");
          }

          const user = await dbFindOne(usersDB, { username: username.trim(), password });

          if (user) {
              req.session.userId = user.id;
              req.session.save(() => res.redirect('/dashboard'));
          } else {
              res.send("<script>alert('Identifiant ou mot de passe incorrect.'); window.history.back();</script>");
          }
      } catch (e) {
          console.error('[LOGIN]', e);
          res.send("<script>alert('Erreur de connexion. R\u00e9essayez.'); window.history.back();</script>");
      }
  });

  // RÉCUPÉRATION DE COMPTE
  app.post('/recovery', async (req, res) => {
      try {
          const { phone, q_naissance, q_pere } = req.body;
          const user = await dbFindOne(usersDB, {
              phone: String(phone).trim(),
              q_naissance: q_naissance,
              q_pere: q_pere
          });

          if (user) {
              res.send('<script>alert("Votre mot de passe : " + ' + JSON.stringify(user.password) + '); window.history.back();</script>');
          } else {
              res.send("<script>alert('Informations incorrectes. Impossible de r\u00e9cup\u00e9rer le compte.'); window.history.back();</script>");
          }
      } catch (e) {
          console.error('[RECOVERY]', e);
          res.send("<script>alert('Erreur. R\u00e9essayez.'); window.history.back();</script>");
      }
  });

  /* ==========================================================================
     ROUTES PROTÉGÉES (CLIENT)
     ========================================================================== */

  // DASHBOARD
  app.get('/dashboard', authRequired, async (req, res) => {
      try {
          const user = await dbFindOne(usersDB, { id: req.session.userId });
          if (!user) {
              req.session.destroy();
              return res.redirect('/');
          }
          res.render('dashboard', {
              user,
              content: siteContent,
              p:           getProgress(user),
              msRemaining: getRemainingMs(user)
          });
      } catch (e) {
          console.error('[DASHBOARD]', e);
          res.status(500).send('Erreur lors du chargement du tableau de bord : ' + e.message);
      }
  });

  // SOUSCRIPTION PACK (envoi TID)
  app.post('/souscrire-pack', authRequired, async (req, res) => {
      try {
          const user = await dbFindOne(usersDB, { id: req.session.userId });
          await dbInsert(txDB, {
              id:       'TX' + Date.now(),
              username: user.username,
              phone:    user.phone,
              userId:   user.id,
              pack:     req.body.packName,
              montant:  parseInt(req.body.prix) || 0,
              tid:      req.body.reference,
              statut:   'EN_ATTENTE',
              date:     new Date().toLocaleString('fr-FR')
          });
          res.redirect('/dashboard?msg=TID_SENT');
      } catch (e) {
          console.error('[SOUSCRIRE]', e);
          res.redirect('/dashboard?err=1');
      }
  });

  // ACTIVATION DES GAINS (bouton sur pack actif)
  app.post('/activer-gain', authRequired, async (req, res) => {
      try {
          const user = await dbFindOne(usersDB, { id: req.session.userId });
          const daily = { BRONZE: 5000, SILVER: 15000, GOLD: 40000, DIAMOND: 100000 };

          if (user.pack && user.pack !== 'Aucun' && getProgress(user) >= 100) {
              const gain = daily[user.pack] || 0;
              await dbUpdate(usersDB, { id: user.id }, {
                  $inc: { bonus: gain },
                  $set: { investDate: new Date() }
              });
          }
          res.redirect('/dashboard');
      } catch (e) {
          console.error('[ACTIVER-GAIN]', e);
          res.redirect('/dashboard');
      }
  });

  // DEMANDE DE RETRAIT
  app.post('/retrait', authRequired, async (req, res) => {
      try {
          const user = await dbFindOne(usersDB, { id: req.session.userId });
          const m = parseInt(req.body.montant);

          if (!user || user.bonus < m || m < 1000) {
              return res.send("<script>alert('Solde insuffisant ou montant trop bas (min 1.000 FC).'); window.history.back();</script>");
          }

          await dbUpdate(usersDB, { id: user.id }, { $inc: { bonus: -m } });
          await dbInsert(retDB, {
              id:       'RET' + Date.now(),
              username: user.username,
              phone:    user.phone,
              montant:  m,
              statut:   'EN_ATTENTE',
              date:     new Date().toLocaleString('fr-FR')
          });
          res.redirect('/dashboard?msg=RETRAIT_OK');
      } catch (e) {
          console.error('[RETRAIT]', e);
          res.redirect('/dashboard?err=1');
      }
  });

  // DÉCONNEXION
  app.get('/logout', (req, res) => {
      req.session.destroy(() => res.redirect('/'));
  });

  /* ==========================================================================
     PANNEAU ADMIN
     ========================================================================== */
  app.get('/admin', async (req, res) => {
      try {
          const allUsers     = await dbFind(usersDB, {});
          const transactions = await dbFind(txDB, { statut: 'EN_ATTENTE' });
          const retraits     = await dbFind(retDB, { statut: 'EN_ATTENTE' });

          const stats = {
              totalUsers:  allUsers.length,
              enAttente:   transactions.length,
              soldeGlobal: allUsers.reduce((acc, u) => acc + (u.solde || 0), 0)
          };

          res.render('admin', { stats, transactions, retraits, users: allUsers, site: siteContent });
      } catch (e) {
          console.error('[ADMIN]', e);
          res.status(500).send('Erreur admin : ' + e.message);
      }
  });

  // APPROBATION TRANSACTION
  app.post('/admin/approve-tx', async (req, res) => {
      try {
          const tx = await dbFindOne(txDB, { id: req.body.txId });
          if (!tx) return res.redirect('/admin');

          const bonuses = { BRONZE: 5000, SILVER: 9000, GOLD: 40000, DIAMOND: 120000 };
          const bonus   = bonuses[tx.pack] || 0;

          await dbUpdate(usersDB, { id: tx.userId }, {
              $set: { pack: tx.pack, investDate: new Date() },
              $inc: { solde: tx.montant, bonus }
          });

          // Parrainage 10%
          const user = await dbFindOne(usersDB, { id: tx.userId });
          if (user && user.referredBy) {
              const commission = Math.floor(tx.montant * 0.10);
              await dbUpdate(usersDB, { id: user.referredBy }, { $inc: { bonus: commission } });
          }

          await dbUpdate(txDB, { id: tx.id }, { $set: { statut: 'APPROUVE' } });
          res.redirect('/admin');
      } catch (e) {
          console.error('[APPROVE]', e);
          res.redirect('/admin');
      }
  });

  // REJET TRANSACTION
  app.post('/admin/reject-tx', async (req, res) => {
      try {
          await dbUpdate(txDB, { id: req.body.txId }, { $set: { statut: 'REJETE' } });
          res.redirect('/admin');
      } catch (e) {
          res.redirect('/admin');
      }
  });

  // MISE À JOUR CONTENU SITE
  app.post('/admin/update-content', (req, res) => {
      siteContent = { ...siteContent, ...req.body };
      res.redirect('/admin');
  });

  /* ==========================================================================
     MOTEUR AUTOMATIQUE - CRÉDITE LES GAINS QUOTIDIENS
     ========================================================================== */
  const dailyGains = { BRONZE: 5000, SILVER: 15000, GOLD: 40000, DIAMOND: 100000 };

  setInterval(async () => {
      try {
          const activeUsers = await dbFind(usersDB, { pack: { $ne: 'Aucun' } });
          for (const u of activeUsers) {
              if (!u.investDate) continue;
              const elapsed = Date.now() - new Date(u.investDate).getTime();
              if (elapsed >= 24 * 3600 * 1000) {
                  const gain = dailyGains[u.pack] || 0;
                  await dbUpdate(usersDB, { id: u.id }, {
                      $inc: { bonus: gain },
                      $set: { investDate: new Date() }
                  });
                  console.log('[AUTO] +' + gain + ' FC vers\u00e9 \u00e0 ' + u.username);
              }
          }
      } catch (e) {
          console.error('[CRON]', e);
      }
  }, 30 * 60 * 1000);

  /* ==========================================================================
     GESTIONNAIRE D'ERREURS GLOBAL
     ========================================================================== */
  app.use((err, req, res, next) => {
      console.error('[EXPRESS ERROR]', err);
      res.status(500).send('<h2>Erreur serveur</h2><pre>' + err.message + '</pre>');
  });

  // LANCEMENT
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('[MASTER] CASH LINK v18.2 port ' + PORT));
  