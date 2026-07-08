const db = require("../config/database");

async function searchRoles(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    const r = await db.query("SELECT id, name FROM roles WHERE name ILIKE $1 ORDER BY name LIMIT 20", [`%${q}%`]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
}

async function searchSkills(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    const r = await db.query(`
      SELECT sk.id, sk.name, sc.name as category FROM skills sk
      LEFT JOIN skill_categories sc ON sk.category_id = sc.id
      WHERE sk.name ILIKE $1 ORDER BY sk.name LIMIT 20`, [`%${q}%`]
    );
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
}

async function searchDegrees(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    const r = await db.query("SELECT id, name FROM degrees WHERE name ILIKE $1 ORDER BY name LIMIT 20", [`%${q}%`]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
}

async function searchSpecializations(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    const r = await db.query("SELECT id, name FROM specializations WHERE name ILIKE $1 ORDER BY name LIMIT 20", [`%${q}%`]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
}

async function searchInstitutions(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 1) return res.json([]);
    const r = await db.query("SELECT id, name FROM institutions WHERE name ILIKE $1 ORDER BY name LIMIT 20", [`%${q}%`]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json([]); }
}

module.exports = { searchRoles, searchSkills, searchDegrees, searchSpecializations, searchInstitutions };
