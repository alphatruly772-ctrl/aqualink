/**
 * ================================
 *  AQUALINK - COMPLETE APP
 *  Just this ONE file needed!
 * 
 *  HOW TO START:
 *  1. Open terminal in this folder
 *  2. Type: node server.js
 *  3. Open browser: localhost:3000
 * 
 *  LOGIN:
 *  Email:    admin@aqualink.org
 *  Password: admin123
 * ================================
 */

var http   = require('http');
var fs     = require('fs');
var path   = require('path');
var crypto = require('crypto');

var PORT = process.env.PORT || 3000;
var SECRET = 'aqualink2026';
var DBFILE = path.join(__dirname, 'database.json');

// ─── DATABASE ─────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DBFILE)) {
    return { users: [], bookings: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DBFILE, 'utf8'));
  } catch (e) {
    return { users: [], bookings: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DBFILE, JSON.stringify(db, null, 2));
}

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

function hashPassword(pw) {
  return crypto.createHmac('sha256', SECRET).update(pw).digest('hex');
}

function makeToken(user) {
  var data = JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 7 * 86400000 });
  var payload = Buffer.from(data).toString('base64');
  var sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64');
  return payload + '.' + sig;
}

function checkToken(tok) {
  if (!tok) return null;
  var parts = tok.split('.');
  if (parts.length !== 2) return null;
  var payload = parts[0];
  var sig = parts[1];
  var expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64');
  if (sig !== expected) return null;
  try {
    var d = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (d.exp < Date.now()) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function getToken(req) {
  var auth = req.headers['authorization'] || '';
  return auth.replace('Bearer ', '') || null;
}

function getBody(req) {
  return new Promise(function (resolve) {
    var body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { resolve({}); }
    });
  });
}

function nextBookingId() {
  var db = loadDB();
  var max = 0;
  db.bookings.forEach(function (b) {
    var n = parseInt((b.id || 'AQL-0').replace('AQL-', '')) || 0;
    if (n > max) max = n;
  });
  return 'AQL-' + String(max + 1).padStart(5, '0');
}

// ─── SEED DEMO DATA ───────────────────────────────────
function seedData() {
  var db = loadDB();
  if (db.users.length > 0) return;

  var adminId = makeId();
  var ngoId   = makeId();

  db.users = [
    {
      id: adminId,
      name: 'Admin User',
      email: 'admin@aqualink.org',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      organization: 'AquaLink HQ',
      country: 'Global',
      createdAt: new Date().toISOString()
    },
    {
      id: ngoId,
      name: 'WaterAid Nigeria',
      email: 'ngo@wateraid.org',
      passwordHash: hashPassword('test123'),
      role: 'ngo',
      organization: 'WaterAid',
      country: 'Nigeria',
      createdAt: new Date().toISOString()
    }
  ];

  db.bookings = [
    { id: 'AQL-00001', userId: ngoId, destination: 'Lagos, Nigeria',    waterType: 'Potable',      volumeLitres: 50000,  priority: 'Emergency', status: 'active',  requestorType: 'NGO',        requiredBy: '2026-05-02', notes: 'Flood relief', createdAt: new Date().toISOString() },
    { id: 'AQL-00002', userId: ngoId, destination: 'Nairobi, Kenya',    waterType: 'Potable',      volumeLitres: 120000, priority: 'Urgent',    status: 'transit', requestorType: 'Government', requiredBy: '2026-05-05', notes: '',             createdAt: new Date().toISOString() },
    { id: 'AQL-00003', userId: ngoId, destination: 'Dhaka, Bangladesh', waterType: 'Agricultural', volumeLitres: 800000, priority: 'Standard',  status: 'pending', requestorType: 'Government', requiredBy: '2026-05-10', notes: 'Irrigation',   createdAt: new Date().toISOString() }
  ];

  saveDB(db);
  console.log('Demo data created!');
}

// ─── RESPONSE HELPERS ─────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

function sendJSON(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendHTML(res, html) {
  setCORS(res);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// ─── THE FULL APP HTML ────────────────────────────────
var HTML = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
'<title>AquaLink - Global Water Platform</title>' +
'<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">' +
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0}' +
':root{--ink:#010b14;--navy:#062040;--sky:#1578c8;--glow:#00e5ff;--ice:#c8f0ff;--gold:#ffd166;--coral:#ff6b6b;--green:#06d6a0;--muted:#4a7a9b;--foam:#38b6ff}' +
'body{font-family:"Outfit",sans-serif;background:var(--ink);color:var(--ice);min-height:100vh}' +
'#login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(21,120,200,0.15),transparent 70%)}' +
'.login-card{background:rgba(6,32,64,0.95);border:1px solid rgba(0,229,255,0.2);border-radius:24px;padding:44px;width:90%;max-width:420px;box-shadow:0 40px 80px rgba(0,0,0,0.5)}' +
'.logo{font-family:"Bebas Neue",sans-serif;font-size:2.2rem;letter-spacing:4px;color:#fff;display:flex;align-items:center;gap:12px;margin-bottom:6px}' +
'.logo-mark{width:32px;height:32px;background:linear-gradient(135deg,var(--sky),var(--glow));clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);animation:spin 8s linear infinite}' +
'@keyframes spin{to{transform:rotate(360deg)}}' +
'.login-sub{color:var(--muted);font-size:.88rem;margin-bottom:28px}' +
'.tabs{display:flex;background:rgba(1,11,20,0.6);border-radius:12px;padding:4px;margin-bottom:24px}' +
'.tab{flex:1;padding:10px;text-align:center;border-radius:9px;font-weight:600;font-size:.88rem;cursor:pointer;color:var(--muted);transition:all .2s}' +
'.tab.on{background:linear-gradient(135deg,var(--sky),var(--glow));color:var(--ink)}' +
'.field{margin-bottom:14px}' +
'.field label{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600;margin-bottom:7px}' +
'.inp{width:100%;padding:13px 16px;background:rgba(1,11,20,0.8);border:1.5px solid rgba(0,229,255,0.2);border-radius:12px;color:#fff;font-family:"Outfit",sans-serif;font-size:.9rem;outline:none;transition:border-color .2s}' +
'.inp:focus{border-color:var(--glow)}' +
'.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
'.main-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--sky),var(--glow));border:none;border-radius:14px;color:var(--ink);font-family:"Bebas Neue",sans-serif;font-size:1.2rem;letter-spacing:2px;cursor:pointer;margin-top:6px;transition:all .2s}' +
'.main-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,229,255,0.4)}' +
'.main-btn:disabled{opacity:.5;transform:none;cursor:not-allowed}' +
'.hint{text-align:center;font-size:.75rem;color:var(--muted);margin-top:12px}' +
'.msg{border-radius:10px;padding:10px 14px;font-size:.83rem;margin-bottom:14px;display:none}' +
'.msg.err{background:rgba(255,107,107,0.12);border:1px solid rgba(255,107,107,0.25);color:var(--coral)}' +
'.msg.ok{background:rgba(6,214,160,0.1);border:1px solid rgba(6,214,160,0.2);color:var(--green)}' +
'#app{display:none}' +
'.topbar{background:rgba(1,11,20,0.95);border-bottom:1px solid rgba(0,229,255,0.1);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);flex-wrap:wrap;gap:10px}' +
'.topbar-logo{font-family:"Bebas Neue",sans-serif;font-size:1.6rem;letter-spacing:3px;display:flex;align-items:center;gap:10px}' +
'.nav{display:flex;gap:6px;flex-wrap:wrap}' +
'.nb{padding:8px 16px;border-radius:100px;font-size:.82rem;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,229,255,0.18);color:var(--muted);background:transparent;font-family:"Outfit",sans-serif;transition:all .2s}' +
'.nb:hover,.nb.on{border-color:var(--glow);color:var(--glow);background:rgba(0,229,255,0.07)}' +
'.user-area{display:flex;align-items:center;gap:10px}' +
'.av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--sky),var(--glow));display:flex;align-items:center;justify-content:center;font-family:"Bebas Neue",sans-serif;font-size:.9rem;color:var(--ink)}' +
'.uname{font-size:.85rem;font-weight:600}' +
'.logout-btn{padding:7px 14px;border-radius:100px;border:1px solid rgba(255,107,107,0.3);color:var(--coral);background:transparent;font-size:.78rem;cursor:pointer;font-family:"Outfit",sans-serif;transition:all .2s}' +
'.logout-btn:hover{background:rgba(255,107,107,0.1)}' +
'.page{display:none;padding:32px;max-width:1100px;margin:0 auto}' +
'.page.on{display:block}' +
'.ptitle{font-family:"Bebas Neue",sans-serif;font-size:2.2rem;letter-spacing:2px;color:#fff;margin-bottom:6px}' +
'.psub{color:var(--muted);font-size:.88rem;margin-bottom:28px}' +
'.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}' +
'.card{background:rgba(6,32,64,0.7);border:1px solid rgba(0,229,255,0.12);border-radius:16px;padding:20px;transition:transform .2s}' +
'.card:hover{transform:translateY(-3px)}' +
'.clabel{font-size:.68rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600;margin-bottom:8px}' +
'.cval{font-family:"Bebas Neue",sans-serif;font-size:2.2rem;letter-spacing:1px;color:#fff;line-height:1}' +
'.ctag{font-size:.72rem;color:var(--green);margin-top:6px}' +
'.panel{background:rgba(6,32,64,0.5);border:1px solid rgba(0,229,255,0.1);border-radius:16px;padding:24px;margin-bottom:20px}' +
'.ptit{font-family:"Bebas Neue",sans-serif;font-size:1.15rem;letter-spacing:1.5px;color:#fff;margin-bottom:18px}' +
'.tscroll{overflow-x:auto}' +
'table{width:100%;border-collapse:collapse;font-size:.87rem}' +
'th{text-align:left;padding:10px 13px;font-size:.67rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600;border-bottom:1px solid rgba(0,229,255,0.08)}' +
'td{padding:13px;color:var(--ice);border-bottom:1px solid rgba(0,229,255,0.04)}' +
'tr:hover td{background:rgba(0,229,255,0.03)}' +
'.bid{font-family:"Bebas Neue",sans-serif;font-size:.93rem;letter-spacing:1px;color:var(--glow)}' +
'.badge{display:inline-block;padding:3px 9px;border-radius:100px;font-size:.68rem;font-weight:700}' +
'.b-active{background:rgba(6,214,160,0.12);color:var(--green);border:1px solid rgba(6,214,160,0.2)}' +
'.b-pending{background:rgba(255,209,102,0.1);color:var(--gold);border:1px solid rgba(255,209,102,0.2)}' +
'.b-transit{background:rgba(0,229,255,0.1);color:var(--glow);border:1px solid rgba(0,229,255,0.2)}' +
'.b-complete{background:rgba(74,122,155,0.15);color:var(--muted);border:1px solid rgba(74,122,155,0.2)}' +
'.b-crit{background:rgba(255,107,107,0.12);color:var(--coral);border:1px solid rgba(255,107,107,0.2)}' +
'.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}' +
'.fg{display:flex;flex-direction:column;gap:6px}' +
'.fg label{font-size:.7rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600}' +
'.fg input,.fg select,.fg textarea{padding:12px 15px;background:rgba(1,11,20,0.8);border:1.5px solid rgba(0,229,255,0.15);border-radius:12px;color:#fff;font-family:"Outfit",sans-serif;font-size:.88rem;outline:none;transition:border-color .2s}' +
'.fg input:focus,.fg select:focus{border-color:var(--glow)}' +
'.fg select option{background:#021525}' +
'.fg textarea{resize:vertical;min-height:72px}' +
'.full{grid-column:1/-1}' +
'.btn{padding:11px 26px;border-radius:100px;font-family:"Outfit",sans-serif;font-weight:700;font-size:.87rem;cursor:pointer;border:none;transition:all .2s}' +
'.btn-p{background:linear-gradient(135deg,var(--sky),var(--glow));color:var(--ink)}' +
'.btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 26px rgba(0,229,255,0.3)}' +
'.btn-p:disabled{opacity:.5;transform:none}' +
'.btn-g{background:transparent;border:1.5px solid rgba(0,229,255,0.25);color:var(--ice)}' +
'.btn-g:hover{border-color:var(--glow);color:var(--glow)}' +
'.btn-d{background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.25);color:var(--coral)}' +
'.btn-d:hover{background:rgba(255,107,107,0.2)}' +
'.btn-row{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap}' +
'.pills{display:flex;gap:8px;flex-wrap:wrap}' +
'.pill{padding:7px 15px;border-radius:100px;font-size:.79rem;font-weight:600;border:1.5px solid rgba(0,229,255,0.18);color:var(--muted);background:transparent;cursor:pointer;font-family:"Outfit",sans-serif;transition:all .2s}' +
'.pill.on,.pill:hover{border-color:var(--glow);color:var(--glow);background:rgba(0,229,255,0.08)}' +
'.vol-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}' +
'.vol-lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600}' +
'.vol-val{font-family:"Bebas Neue",sans-serif;font-size:1.5rem;letter-spacing:1px;color:var(--glow)}' +
'input[type=range]{width:100%;height:5px;-webkit-appearance:none;background:rgba(0,229,255,0.12);border-radius:100px;outline:none}' +
'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--sky),var(--glow));cursor:pointer;box-shadow:0 0 10px rgba(0,229,255,0.4)}' +
'.ssel{padding:5px 10px;background:rgba(1,11,20,0.8);border:1px solid rgba(0,229,255,0.15);border-radius:8px;color:#fff;font-size:.78rem;cursor:pointer;outline:none}' +
'.ssel option{background:#021525}' +
'.frow{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}' +
'.frow input,.frow select{padding:9px 13px;background:rgba(1,11,20,0.7);border:1.5px solid rgba(0,229,255,0.15);border-radius:12px;color:#fff;font-size:.83rem;outline:none;font-family:"Outfit",sans-serif}' +
'.frow select option{background:#021525}' +
'.empty{text-align:center;padding:40px;color:var(--muted)}' +
'.empty-ico{font-size:2.5rem;margin-bottom:10px}' +
'.success-wrap{text-align:center;padding:40px 20px}' +
'.success-wrap .big{font-size:3.5rem;margin-bottom:14px}' +
'.success-wrap h3{font-family:"Bebas Neue",sans-serif;font-size:1.9rem;color:var(--green);letter-spacing:2px;margin-bottom:8px}' +
'.success-wrap p{color:var(--muted);font-size:.88rem;line-height:1.7}' +
'.id-chip{font-family:"Bebas Neue",sans-serif;font-size:1.7rem;letter-spacing:2px;color:var(--glow);background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:10px 18px;margin:14px 0;display:inline-block}' +
'.bar-item{margin-bottom:13px}' +
'.bar-head{display:flex;justify-content:space-between;font-size:.79rem;margin-bottom:5px}' +
'.bar-track{height:5px;background:rgba(0,229,255,0.08);border-radius:100px;overflow:hidden}' +
'.bar-fill{height:100%;background:linear-gradient(90deg,var(--sky),var(--glow));border-radius:100px}' +
'.toast{position:fixed;bottom:24px;right:24px;z-index:9999;background:rgba(6,32,64,0.97);border:1px solid rgba(0,229,255,0.3);border-radius:14px;padding:13px 18px;display:flex;align-items:center;gap:10px;transform:translateY(70px);opacity:0;transition:all .4s;backdrop-filter:blur(14px);font-size:.87rem;color:var(--ice);max-width:320px}' +
'.toast.show{transform:translateY(0);opacity:1}' +
'.spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(1,11,20,0.3);border-top-color:var(--ink);border-radius:50%;animation:rot .6s linear infinite;vertical-align:middle;margin-right:5px}' +
'@keyframes rot{to{transform:rotate(360deg)}}' +
'@media(max-width:700px){.cards{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}.page{padding:16px}}' +
'</style>' +
'</head>' +
'<body>' +

'<div id="login-wrap">' +
'<div class="login-card">' +
'<div class="logo"><div class="logo-mark"></div>AQUALINK</div>' +
'<p class="login-sub">Global Water Distribution Platform</p>' +
'<div class="tabs">' +
'<div class="tab on" onclick="switchTab(\'login\',this)">Login</div>' +
'<div class="tab" onclick="switchTab(\'register\',this)">Register</div>' +
'</div>' +
'<div id="msg" class="msg"></div>' +
'<div id="f-login">' +
'<div class="field"><label>Email Address</label><input class="inp" id="l-email" type="email" value="admin@aqualink.org" placeholder="your@email.com"></div>' +
'<div class="field"><label>Password</label><input class="inp" id="l-pass" type="password" value="admin123" placeholder="Password" onkeydown="if(event.key===\'Enter\')doLogin()"></div>' +
'<button class="main-btn" id="l-btn" onclick="doLogin()">LOGIN</button>' +
'<p class="hint">Demo: admin@aqualink.org / admin123</p>' +
'</div>' +
'<div id="f-register" style="display:none">' +
'<div class="two-col">' +
'<div class="field"><label>Full Name</label><input class="inp" id="r-name" type="text" placeholder="Your name"></div>' +
'<div class="field"><label>Email</label><input class="inp" id="r-email" type="email" placeholder="you@org.com"></div>' +
'</div>' +
'<div class="two-col">' +
'<div class="field"><label>Password</label><input class="inp" id="r-pass" type="password" placeholder="Min 6 chars"></div>' +
'<div class="field"><label>Country</label><input class="inp" id="r-country" type="text" placeholder="Your country"></div>' +
'</div>' +
'<div class="field"><label>Organization</label><input class="inp" id="r-org" type="text" placeholder="Organization name"></div>' +
'<button class="main-btn" id="r-btn" onclick="doRegister()" style="margin-top:6px">CREATE ACCOUNT</button>' +
'</div>' +
'</div>' +
'</div>' +

'<div id="app">' +
'<div class="topbar">' +
'<div class="topbar-logo"><div class="logo-mark" style="width:24px;height:24px"></div>AQUALINK</div>' +
'<div class="nav">' +
'<button class="nb on" onclick="goPage(\'dashboard\',this)">Dashboard</button>' +
'<button class="nb" onclick="goPage(\'book\',this)">Book Water</button>' +
'<button class="nb" onclick="goPage(\'bookings\',this)">My Bookings</button>' +
'<button class="nb" onclick="goPage(\'sources\',this)">Sources</button>' +
'<button class="nb" id="users-btn" onclick="goPage(\'users\',this)">Users</button>' +
'</div>' +
'<div class="user-area">' +
'<div class="av" id="av">A</div>' +
'<span class="uname" id="uname"></span>' +
'<button class="logout-btn" onclick="doLogout()">Logout</button>' +
'</div>' +
'</div>' +

'<div class="page on" id="pg-dashboard">' +
'<div class="ptitle">Dashboard</div>' +
'<p class="psub" id="dash-sub">Welcome! Here is your live network overview.</p>' +
'<div class="cards">' +
'<div class="card"><div class="clabel">Total Bookings</div><div class="cval" id="s-total">-</div><div class="ctag">All time</div></div>' +
'<div class="card"><div class="clabel">Total Users</div><div class="cval" id="s-users">-</div><div class="ctag">Registered</div></div>' +
'<div class="card"><div class="clabel">Litres Requested</div><div class="cval" id="s-litres">-</div><div class="ctag">Total volume</div></div>' +
'<div class="card"><div class="clabel">Pending Orders</div><div class="cval" id="s-pending">-</div><div class="ctag">Needs attention</div></div>' +
'</div>' +
'<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:20px">' +
'<div class="panel"><div class="ptit">Recent Bookings</div><div class="tscroll"><table><thead><tr><th>ID</th><th>Destination</th><th>Volume</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead><tbody id="recent-rows"></tbody></table></div></div>' +
'<div class="panel"><div class="ptit">By Status</div><div id="status-bars"></div></div>' +
'</div>' +
'</div>' +

'<div class="page" id="pg-book">' +
'<div class="ptitle">Book Water Supply</div>' +
'<p class="psub">Request clean water delivery anywhere in the world.</p>' +
'<div id="book-success" class="success-wrap" style="display:none"><div class="big">💧</div><h3>BOOKING CONFIRMED!</h3><div class="id-chip" id="s-id">AQL-XXXXX</div><p id="s-msg"></p><button class="btn btn-p" style="margin-top:22px" onclick="goPage(\'bookings\',document.querySelectorAll(\'.nb\')[2])">VIEW MY BOOKINGS</button></div>' +
'<div class="panel" id="book-form">' +
'<div class="form-grid">' +
'<div class="fg"><label>Destination Country *</label><select id="b-country"><option value="">Select country...</option><option>Nigeria</option><option>Kenya</option><option>Ethiopia</option><option>Somalia</option><option>South Africa</option><option>Ghana</option><option>Egypt</option><option>Sudan</option><option>Niger</option><option>Mali</option><option>Chad</option><option>DR Congo</option><option>India</option><option>Bangladesh</option><option>Pakistan</option><option>Afghanistan</option><option>Yemen</option><option>Syria</option><option>Brazil</option><option>Colombia</option><option>Haiti</option><option>Venezuela</option><option>Indonesia</option><option>Philippines</option><option>Myanmar</option><option>Mexico</option></select></div>' +
'<div class="fg"><label>City / Region</label><input type="text" id="b-city" placeholder="e.g. Lagos, Kano"></div>' +
'<div class="fg full"><label>Water Type</label><div class="pills"><button class="pill on" onclick="pickPill(this)">Potable</button><button class="pill" onclick="pickPill(this)">Agricultural</button><button class="pill" onclick="pickPill(this)">Industrial</button><button class="pill" onclick="pickPill(this)">Emergency</button></div></div>' +
'<div class="fg full"><div class="vol-row"><span class="vol-lbl">Volume Required</span><span class="vol-val" id="vol-disp">5,000 L</span></div><input type="range" id="vol-slide" min="100" max="500000" step="100" value="5000" oninput="updVol(this.value)"></div>' +
'<div class="fg"><label>Requestor Type</label><select id="b-rtype"><option>Government / Ministry</option><option>NGO / Humanitarian</option><option>Community Leader</option><option>Industrial / Commercial</option><option>Individual / Family</option></select></div>' +
'<div class="fg"><label>Priority Level</label><select id="b-pri"><option value="Standard">Standard - 7 to 14 days</option><option value="Urgent">Urgent - 2 to 4 days</option><option value="Emergency">Emergency - 24 to 48 hours</option></select></div>' +
'<div class="fg"><label>Required By Date</label><input type="date" id="b-date"></div>' +
'<div class="fg"><label>Notes</label><input type="text" id="b-notes" placeholder="Any special instructions..."></div>' +
'</div>' +
'<div id="b-err" style="background:rgba(255,107,107,0.12);border:1px solid rgba(255,107,107,0.25);border-radius:10px;padding:10px 14px;color:var(--coral);font-size:.83rem;margin-top:14px;display:none"></div>' +
'<div class="btn-row"><button class="btn btn-p" id="b-btn" onclick="submitBook()">CONFIRM BOOKING</button><button class="btn btn-g" onclick="resetBook()">Clear</button></div>' +
'</div>' +
'</div>' +

'<div class="page" id="pg-bookings">' +
'<div class="ptitle">My Bookings</div>' +
'<p class="psub">All your water booking requests.</p>' +
'<div class="frow"><input type="text" id="f-search" placeholder="Search..." oninput="loadBookings()" style="flex:1;min-width:150px"><select id="f-status" onchange="loadBookings()"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="transit">In Transit</option><option value="complete">Complete</option></select><button class="btn btn-g" style="padding:9px 16px;font-size:.8rem" onclick="loadBookings()">Refresh</button></div>' +
'<div class="panel" style="padding:0;overflow:hidden"><div class="tscroll"><table><thead><tr><th>ID</th><th>Destination</th><th>Type</th><th>Volume</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody id="bk-rows"></tbody></table></div><div id="bk-empty" class="empty" style="display:none"><div class="empty-ico">💧</div><span id="bk-msg">No bookings yet.</span></div></div>' +
'</div>' +

'<div class="page" id="pg-sources">' +
'<div class="ptitle">Water Sources</div>' +
'<p class="psub">Global certified water distribution nodes.</p>' +
'<div class="panel" style="padding:0;overflow:hidden"><div class="tscroll"><table><thead><tr><th>Name</th><th>Country</th><th>City</th><th>Type</th><th>Available (L)</th><th>Status</th></tr></thead><tbody>' +
'<tr><td style="font-weight:600">Lagos Water Hub</td><td>Nigeria</td><td>Lagos</td><td style="color:var(--muted)">Potable</td><td style="font-family:Bebas Neue,sans-serif;color:var(--glow)">5,000,000</td><td><span class="badge b-active">Active</span></td></tr>' +
'<tr><td style="font-weight:600">Nairobi Central Depot</td><td>Kenya</td><td>Nairobi</td><td style="color:var(--muted)">Potable</td><td style="font-family:Bebas Neue,sans-serif;color:var(--glow)">3,200,000</td><td><span class="badge b-active">Active</span></td></tr>' +
'<tr><td style="font-weight:600">Cairo Distribution Node</td><td>Egypt</td><td>Cairo</td><td style="color:var(--muted)">Potable</td><td style="font-family:Bebas Neue,sans-serif;color:var(--glow)">8,000,000</td><td><span class="badge b-active">Active</span></td></tr>' +
'<tr><td style="font-weight:600">Mumbai Reserve Tank</td><td>India</td><td>Mumbai</td><td style="color:var(--muted)">Agricultural</td><td style="font-family:Bebas Neue,sans-serif;color:var(--glow)">12,000,000</td><td><span class="badge b-active">Active</span></td></tr>' +
'<tr><td style="font-weight:600">Accra Emergency Hub</td><td>Ghana</td><td>Accra</td><td style="color:var(--muted)">Emergency</td><td style="font-family:Bebas Neue,sans-serif;color:var(--glow)">1,500,000</td><td><span class="badge b-active">Active</span></td></tr>' +
'</tbody></table></div></div>' +
'</div>' +

'<div class="page" id="pg-users">' +
'<div class="ptitle">All Users</div>' +
'<p class="psub">Registered AquaLink accounts.</p>' +
'<div class="panel" style="padding:0;overflow:hidden"><div class="tscroll"><table><thead><tr><th>Name</th><th>Email</th><th>Organization</th><th>Country</th><th>Role</th><th>Joined</th></tr></thead><tbody id="user-rows"></tbody></table></div><div id="u-note" class="empty" style="display:none"><div class="empty-ico">🔒</div>Admin access required.</div></div>' +
'</div>' +

'</div>' +
'<div class="toast" id="toast"><span id="t-i">✅</span>&nbsp;<span id="t-m"></span></div>' +

'<script>' +
'var TOKEN = localStorage.getItem("aq_token");' +
'var ME = null;' +

'async function api(method, path, data) {' +
'  var opts = { method: method, headers: { "Content-Type": "application/json" } };' +
'  if (TOKEN) opts.headers["Authorization"] = "Bearer " + TOKEN;' +
'  if (data) opts.body = JSON.stringify(data);' +
'  try { var r = await fetch("/api" + path, opts); return await r.json(); }' +
'  catch(e) { return { error: "Cannot reach server." }; }' +
'}' +

'function switchTab(tab, el) {' +
'  document.querySelectorAll(".tab").forEach(function(t){ t.classList.remove("on"); });' +
'  el.classList.add("on");' +
'  document.getElementById("f-login").style.display    = tab==="login"    ? "block" : "none";' +
'  document.getElementById("f-register").style.display = tab==="register" ? "block" : "none";' +
'  hideMsg();' +
'}' +

'function showMsg(type, text) {' +
'  var el = document.getElementById("msg");' +
'  el.className = "msg " + type;' +
'  el.textContent = text;' +
'  el.style.display = "block";' +
'}' +
'function hideMsg() { document.getElementById("msg").style.display = "none"; }' +

'async function doLogin() {' +
'  hideMsg();' +
'  var email = document.getElementById("l-email").value.trim();' +
'  var pass  = document.getElementById("l-pass").value;' +
'  if (!email || !pass) { showMsg("err", "Please enter your email and password."); return; }' +
'  var btn = document.getElementById("l-btn");' +
'  btn.disabled = true; btn.textContent = "Logging in...";' +
'  var r = await api("POST", "/login", { email: email, password: pass });' +
'  btn.disabled = false; btn.textContent = "LOGIN";' +
'  if (r.error) { showMsg("err", r.error); return; }' +
'  TOKEN = r.token; ME = r.user;' +
'  localStorage.setItem("aq_token", TOKEN);' +
'  showMsg("ok", "Welcome back, " + ME.name + "!");' +
'  setTimeout(startApp, 800);' +
'}' +

'async function doRegister() {' +
'  hideMsg();' +
'  var name  = document.getElementById("r-name").value.trim();' +
'  var email = document.getElementById("r-email").value.trim();' +
'  var pass  = document.getElementById("r-pass").value;' +
'  if (!name||!email||!pass) { showMsg("err","Name, email and password are required."); return; }' +
'  if (pass.length<6) { showMsg("err","Password must be at least 6 characters."); return; }' +
'  var btn = document.getElementById("r-btn");' +
'  btn.disabled=true; btn.textContent="Creating...";' +
'  var r = await api("POST", "/register", { name:name, email:email, password:pass, country:document.getElementById("r-country").value, organization:document.getElementById("r-org").value, role:"user" });' +
'  btn.disabled=false; btn.textContent="CREATE ACCOUNT";' +
'  if (r.error) { showMsg("err", r.error); return; }' +
'  TOKEN=r.token; ME=r.user; localStorage.setItem("aq_token",TOKEN);' +
'  showMsg("ok", r.message); setTimeout(startApp, 800);' +
'}' +

'function doLogout() {' +
'  TOKEN=null; ME=null; localStorage.removeItem("aq_token");' +
'  document.getElementById("app").style.display="none";' +
'  document.getElementById("login-wrap").style.display="flex";' +
'  hideMsg(); toast("👋","Logged out!");' +
'}' +

'function startApp() {' +
'  document.getElementById("login-wrap").style.display="none";' +
'  document.getElementById("app").style.display="block";' +
'  document.getElementById("av").textContent = ME.name[0].toUpperCase();' +
'  document.getElementById("uname").textContent = ME.name.split(" ")[0];' +
'  document.getElementById("dash-sub").textContent = "Welcome, " + ME.name + "! Here is your live network overview.";' +
'  if (ME.role !== "admin") document.getElementById("users-btn").style.display="none";' +
'  document.getElementById("b-date").value = new Date(Date.now()+7*864e5).toISOString().slice(0,10);' +
'  loadDashboard();' +
'}' +

'function goPage(pg, btn) {' +
'  document.querySelectorAll(".page").forEach(function(p){ p.classList.remove("on"); });' +
'  document.querySelectorAll(".nb").forEach(function(b){ b.classList.remove("on"); });' +
'  document.getElementById("pg-"+pg).classList.add("on");' +
'  if (btn) btn.classList.add("on");' +
'  if (pg==="dashboard") loadDashboard();' +
'  if (pg==="bookings")  loadBookings();' +
'  if (pg==="users")     loadUsers();' +
'}' +

'async function loadDashboard() {' +
'  if (!ME) return;' +
'  if (ME.role==="admin") {' +
'    var r = await api("GET","/stats");' +
'    if (r.error) return;' +
'    document.getElementById("s-total").textContent   = r.totalBookings;' +
'    document.getElementById("s-users").textContent   = r.totalUsers;' +
'    var l=r.totalLitres; document.getElementById("s-litres").textContent = l>=1e6?(l/1e6).toFixed(1)+"M":l>=1000?(l/1000).toFixed(0)+"K":l;' +
'    document.getElementById("s-pending").textContent = r.byStatus.pending;' +
'    document.getElementById("recent-rows").innerHTML = (r.recentBookings||[]).map(function(b){ return "<tr><td class=bid>"+b.id+"</td><td>"+b.destination+"</td><td>"+fv(b.volumeLitres)+"</td><td><span class=\'badge "+pc(b.priority)+"\'>"+b.priority+"</span></td><td><span class=\'badge "+sc(b.status)+"\'>"+b.status+"</span></td><td style=\'color:var(--muted);font-size:.8rem\'>"+b.createdAt.slice(0,10)+"</td></tr>"; }).join("") || "<tr><td colspan=6 style=\'text-align:center;color:var(--muted);padding:20px\'>No bookings yet.</td></tr>";' +
'    var total=r.totalBookings||1; document.getElementById("status-bars").innerHTML=Object.entries(r.byStatus).map(function(e){ return "<div class=bar-item><div class=bar-head><span style=\'color:var(--ice);text-transform:capitalize\'>"+e[0]+"</span><span style=\'color:var(--glow)\'>"+e[1]+"</span></div><div class=bar-track><div class=bar-fill style=\'width:"+(e[1]/total*100)+"%\'></div></div></div>"; }).join("");' +
'  } else {' +
'    var r = await api("GET","/bookings");' +
'    document.getElementById("s-total").textContent   = r.total||0;' +
'    document.getElementById("s-users").textContent   = "-";' +
'    var tl=(r.bookings||[]).reduce(function(s,b){return s+b.volumeLitres;},0); document.getElementById("s-litres").textContent=tl>=1e6?(tl/1e6).toFixed(1)+"M":tl>=1000?(tl/1000).toFixed(0)+"K":tl;' +
'    document.getElementById("s-pending").textContent=(r.bookings||[]).filter(function(b){return b.status==="pending";}).length;' +
'    document.getElementById("recent-rows").innerHTML=(r.bookings||[]).slice(0,5).map(function(b){ return "<tr><td class=bid>"+b.id+"</td><td>"+b.destination+"</td><td>"+fv(b.volumeLitres)+"</td><td><span class=\'badge "+pc(b.priority)+"\'>"+b.priority+"</span></td><td><span class=\'badge "+sc(b.status)+"\'>"+b.status+"</span></td><td style=\'color:var(--muted);font-size:.8rem\'>"+b.createdAt.slice(0,10)+"</td></tr>"; }).join("") || "<tr><td colspan=6 style=\'text-align:center;color:var(--muted);padding:20px\'>No bookings yet.</td></tr>";' +
'  }' +
'}' +

'async function loadBookings() {' +
'  var search=document.getElementById("f-search").value, status=document.getElementById("f-status").value;' +
'  var qs="?status="+status; if(search) qs+="&search="+encodeURIComponent(search);' +
'  var r=await api("GET","/bookings"+qs);' +
'  var tbody=document.getElementById("bk-rows"), empty=document.getElementById("bk-empty");' +
'  if(!r.bookings||r.bookings.length===0){tbody.innerHTML="";empty.style.display="block";document.getElementById("bk-msg").innerHTML="No bookings yet.";return;}' +
'  empty.style.display="none";' +
'  tbody.innerHTML=r.bookings.map(function(b){' +
'    var sc2=ME&&ME.role==="admin"?"<select class=ssel onchange=\'updStatus("+JSON.stringify(b.id)+",this.value)\'><option value=pending"+(b.status==="pending"?" selected":"")+">Pending</option><option value=active"+(b.status==="active"?" selected":"")+">Active</option><option value=transit"+(b.status==="transit"?" selected":"")+">In Transit</option><option value=complete"+(b.status==="complete"?" selected":"")+">Complete</option></select>":"<span class=\'badge "+sc(b.status)+"\'>"+b.status+"</span>";' +
'    return "<tr><td class=bid>"+b.id+"</td><td>"+b.destination+"</td><td style=\'color:var(--muted)\'>"+b.waterType+"</td><td style=\'font-weight:600\'>"+fv(b.volumeLitres)+"</td><td><span class=\'badge "+pc(b.priority)+"\'>"+b.priority+"</span></td><td>"+sc2+"</td><td style=\'color:var(--muted);font-size:.8rem\'>"+b.createdAt.slice(0,10)+"</td><td><button class=\'btn btn-d\' style=\'padding:5px 11px;font-size:.75rem\' onclick=\'cancelB("+JSON.stringify(b.id)+")\'>Cancel</button></td></tr>";' +
'  }).join("");' +
'}' +

'async function updStatus(id,status){var r=await api("PUT","/bookings/"+id+"/status",{status:status});if(r.error){toast("❌",r.error);return;}toast("✅","Booking "+id+" updated to "+status);}' +
'async function cancelB(id){if(!confirm("Cancel booking "+id+"?"))return;var r=await api("DELETE","/bookings/"+id);if(r.error){toast("❌",r.error);return;}toast("🗑️","Cancelled.");loadBookings();}' +

'function pickPill(el){el.closest(".pills").querySelectorAll(".pill").forEach(function(p){p.classList.remove("on");});el.classList.add("on");}' +
'function updVol(v){var n=parseInt(v);document.getElementById("vol-disp").textContent=n>=1e6?(n/1e6).toFixed(1)+"M L":n>=1000?(n/1000).toFixed(0)+"K L":n+" L";}' +

'async function submitBook(){' +
'  document.getElementById("b-err").style.display="none";' +
'  var country=document.getElementById("b-country").value;' +
'  if(!country){var e=document.getElementById("b-err");e.textContent="Please select a destination country.";e.style.display="block";return;}' +
'  var pill=document.querySelector(".pill.on");' +
'  var type=pill?pill.textContent.trim():"Potable";' +
'  var btn=document.getElementById("b-btn");btn.disabled=true;btn.textContent="Confirming...";' +
'  var r=await api("POST","/bookings",{destination:country,city:document.getElementById("b-city").value,waterType:type,volumeLitres:parseInt(document.getElementById("vol-slide").value),priority:document.getElementById("b-pri").value,requestorType:document.getElementById("b-rtype").value,requiredBy:document.getElementById("b-date").value,notes:document.getElementById("b-notes").value});' +
'  btn.disabled=false;btn.textContent="CONFIRM BOOKING";' +
'  if(r.error){var e=document.getElementById("b-err");e.textContent=r.error;e.style.display="block";return;}' +
'  document.getElementById("book-form").style.display="none";' +
'  document.getElementById("book-success").style.display="block";' +
'  document.getElementById("s-id").textContent=r.booking.id;' +
'  document.getElementById("s-msg").textContent=r.message;' +
'  toast("✅","Booking "+r.booking.id+" confirmed!");' +
'}' +

'function resetBook(){document.getElementById("book-success").style.display="none";document.getElementById("book-form").style.display="block";["b-country","b-city","b-notes"].forEach(function(id){document.getElementById(id).value="";});document.getElementById("vol-slide").value=5000;document.getElementById("vol-disp").textContent="5,000 L";}' +

'async function loadUsers(){var r=await api("GET","/users");var note=document.getElementById("u-note");if(r.error){note.style.display="block";return;}note.style.display="none";document.getElementById("user-rows").innerHTML=(r.users||[]).map(function(u){return "<tr><td style=\'font-weight:600\'>"+u.name+"</td><td style=\'color:var(--muted)\'>"+u.email+"</td><td>"+(u.organization||"-")+"</td><td>"+(u.country||"-")+"</td><td><span class=\'badge "+(u.role==="admin"?"b-crit":u.role==="ngo"?"b-transit":"b-pending")+"\'>"+u.role+"</span></td><td style=\'color:var(--muted);font-size:.8rem\'>"+u.createdAt.slice(0,10)+"</td></tr>";}).join("");}' +

'function fv(l){return l>=1e6?(l/1e6).toFixed(1)+"M L":l>=1000?(l/1000).toFixed(0)+"K L":l+" L";}' +
'function pc(p){return p==="Emergency"?"b-crit":p==="Urgent"?"b-pending":"b-complete";}' +
'function sc(s){return s==="active"?"b-active":s==="pending"?"b-pending":s==="transit"?"b-transit":"b-complete";}' +
'function toast(ico,msg){document.getElementById("t-i").textContent=ico;document.getElementById("t-m").textContent=msg;var t=document.getElementById("toast");t.classList.add("show");setTimeout(function(){t.classList.remove("show");},4000);}' +

'(async function boot(){' +
'  if(TOKEN){var r=await api("GET","/me");if(!r.error){ME=r.user;startApp();return;}localStorage.removeItem("aq_token");TOKEN=null;}' +
'})();' +
'<\/script>' +
'</body></html>';

// ─── START SERVER ─────────────────────────────────────
seedData();

http.createServer(async function (req, res) {
  var method = req.method;
  var rawUrl = req.url.split('?')[0];
  var qs     = req.url.split('?')[1] || '';
  var query  = {};
  qs.split('&').forEach(function (p) {
    var kv = p.split('=');
    if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });

  setCORS(res);
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve HTML for all non-API routes
  if (!rawUrl.startsWith('/api')) {
    sendHTML(res, HTML);
    return;
  }

  var route = rawUrl.replace('/api', '') || '/';

  // POST /api/register
  if (route === '/register' && method === 'POST') {
    var data = await getBody(req);
    if (!data.name || !data.email || !data.password) return sendJSON(res, 400, { error: 'Name, email and password are required.' });
    if (data.password.length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
    var db = loadDB();
    if (db.users.find(function (u) { return u.email === data.email; })) return sendJSON(res, 409, { error: 'Email already registered. Please log in.' });
    var user = { id: makeId(), name: data.name, email: data.email, passwordHash: hashPassword(data.password), role: data.role || 'user', organization: data.organization || '', country: data.country || '', createdAt: new Date().toISOString() };
    db.users.push(user);
    saveDB(db);
    var safe = { id: user.id, name: user.name, email: user.email, role: user.role, organization: user.organization, country: user.country, createdAt: user.createdAt };
    return sendJSON(res, 201, { message: 'Welcome to AquaLink, ' + user.name + '!', user: safe, token: makeToken(user) });
  }

  // POST /api/login
  if (route === '/login' && method === 'POST') {
    var data = await getBody(req);
    if (!data.email || !data.password) return sendJSON(res, 400, { error: 'Email and password are required.' });
    var db = loadDB();
    var user = db.users.find(function (u) { return u.email === data.email; });
    if (!user || hashPassword(data.password) !== user.passwordHash) return sendJSON(res, 401, { error: 'Wrong email or password. Try: admin@aqualink.org / admin123' });
    var safe = { id: user.id, name: user.name, email: user.email, role: user.role, organization: user.organization, country: user.country, createdAt: user.createdAt };
    return sendJSON(res, 200, { message: 'Welcome back, ' + user.name + '!', user: safe, token: makeToken(user) });
  }

  // GET /api/me
  if (route === '/me' && method === 'GET') {
    var auth = checkToken(getToken(req));
    if (!auth) return sendJSON(res, 401, { error: 'Please log in.' });
    var db = loadDB();
    var user = db.users.find(function (u) { return u.id === auth.id; });
    if (!user) return sendJSON(res, 404, { error: 'User not found.' });
    var safe = { id: user.id, name: user.name, email: user.email, role: user.role, organization: user.organization, country: user.country, createdAt: user.createdAt };
    return sendJSON(res, 200, { user: safe });
  }

  // GET /api/bookings
  if (route === '/bookings' && method === 'GET') {
    var auth = checkToken(getToken(req));
    if (!auth) return sendJSON(res, 401, { error: 'Please log in.' });
    var db = loadDB();
    var list = auth.role === 'admin' ? db.bookings : db.bookings.filter(function (b) { return b.userId === auth.id; });
    if (query.status && query.status !== 'all') list = list.filter(function (b) { return b.status === query.status; });
    if (query.search) { var s = query.search.toLowerCase(); list = list.filter(function (b) { return b.destination.toLowerCase().indexOf(s) > -1 || b.id.toLowerCase().indexOf(s) > -1; }); }
    list = list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return sendJSON(res, 200, { bookings: list, total: list.length });
  }

  // POST /api/bookings
  if (route === '/bookings' && method === 'POST') {
    var auth = checkToken(getToken(req));
    if (!auth) return sendJSON(res, 401, { error: 'Please log in.' });
    var data = await getBody(req);
    if (!data.destination || !data.waterType || !data.volumeLitres) return sendJSON(res, 400, { error: 'Destination, water type and volume are required.' });
    var db = loadDB();
    var days = data.priority === 'Emergency' ? 2 : data.priority === 'Urgent' ? 4 : 14;
    var booking = {
      id: nextBookingId(), userId: auth.id,
      destination: data.city ? data.city + ', ' + data.destination : data.destination,
      waterType: data.waterType, volumeLitres: parseInt(data.volumeLitres),
      priority: data.priority || 'Standard', status: 'pending',
      requestorType: data.requestorType || 'Individual',
      requiredBy: data.requiredBy || '', notes: data.notes || '',
      createdAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    };
    db.bookings.push(booking);
    saveDB(db);
    return sendJSON(res, 201, { message: 'Booking ' + booking.id + ' confirmed! Est. delivery: ' + booking.estimatedDelivery, booking: booking });
  }

  // PUT /api/bookings/:id/status
  var smatch = route.match(/^\/bookings\/(.+)\/status$/);
  if (smatch && method === 'PUT') {
    var auth = checkToken(getToken(req));
    if (!auth || auth.role !== 'admin') return sendJSON(res, 403, { error: 'Admin only.' });
    var data = await getBody(req);
    var db = loadDB();
    var idx = db.bookings.findIndex(function (b) { return b.id === smatch[1]; });
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found.' });
    db.bookings[idx].status = data.status;
    saveDB(db);
    return sendJSON(res, 200, { message: 'Updated!', booking: db.bookings[idx] });
  }

  // DELETE /api/bookings/:id
  var dmatch = route.match(/^\/bookings\/(.+)$/);
  if (dmatch && method === 'DELETE') {
    var auth = checkToken(getToken(req));
    if (!auth) return sendJSON(res, 401, { error: 'Please log in.' });
    var db = loadDB();
    var idx = db.bookings.findIndex(function (b) { return b.id === dmatch[1]; });
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found.' });
    if (auth.role !== 'admin' && db.bookings[idx].userId !== auth.id) return sendJSON(res, 403, { error: 'Access denied.' });
    db.bookings.splice(idx, 1);
    saveDB(db);
    return sendJSON(res, 200, { message: 'Booking cancelled.' });
  }

  // GET /api/stats
  if (route === '/stats' && method === 'GET') {
    var auth = checkToken(getToken(req));
    if (!auth || auth.role !== 'admin') return sendJSON(res, 403, { error: 'Admin only.' });
    var db = loadDB();
    return sendJSON(res, 200, {
      totalBookings: db.bookings.length,
      totalUsers: db.users.length,
      totalLitres: db.bookings.reduce(function (s, b) { return s + (b.volumeLitres || 0); }, 0),
      byStatus: {
        pending:  db.bookings.filter(function (b) { return b.status === 'pending'; }).length,
        active:   db.bookings.filter(function (b) { return b.status === 'active'; }).length,
        transit:  db.bookings.filter(function (b) { return b.status === 'transit'; }).length,
        complete: db.bookings.filter(function (b) { return b.status === 'complete'; }).length
      },
      byPriority: {
        Emergency: db.bookings.filter(function (b) { return b.priority === 'Emergency'; }).length,
        Urgent:    db.bookings.filter(function (b) { return b.priority === 'Urgent'; }).length,
        Standard:  db.bookings.filter(function (b) { return b.priority === 'Standard'; }).length
      },
      recentBookings: db.bookings.slice(-5).reverse()
    });
  }

  // GET /api/users
  if (route === '/users' && method === 'GET') {
    var auth = checkToken(getToken(req));
    if (!auth || auth.role !== 'admin') return sendJSON(res, 403, { error: 'Admin only.' });
    var users = loadDB().users.map(function (u) {
      return { id: u.id, name: u.name, email: u.email, role: u.role, organization: u.organization, country: u.country, createdAt: u.createdAt };
    });
    return sendJSON(res, 200, { users: users, total: users.length });
  }

  sendJSON(res, 404, { error: 'Not found.' });

}).listen(PORT, function () {
  console.log('');
  console.log('========================================');
  console.log('   AQUALINK IS RUNNING!');
  console.log('========================================');
  console.log('   Open:     http://localhost:3000');
  console.log('   Email:    admin@aqualink.org');
  console.log('   Password: admin123');
  console.log('========================================');
  console.log('');
});