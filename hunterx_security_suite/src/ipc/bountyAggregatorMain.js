const { ipcMain, BrowserWindow } = require("electron");
const fetch = require("node-fetch");
const Database = require("better-sqlite3");
const path = require("path");
const CACHE_DB = path.join(__dirname, "..", "..", "bounty_aggregator.sqlite");
const PROGRAM_REFRESH_INTERVAL_MIN = 60; // Minutes, can lower for demo/dev

let db;
function getDb() {
  if (!db) {
    db = new Database(CACHE_DB);
    db.pragma("journal_mode = WAL");
    // Table: id, name, platform, url, description, logo, isPublic, minBounty, maxBounty, scope, updatedAt
    db.exec(`
      CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY,
        name TEXT, platform TEXT, url TEXT, description TEXT, logo TEXT, isPublic INTEGER, 
        minBounty INTEGER, maxBounty INTEGER, 
        scopeTypes TEXT,        -- JSON array ['web','api',...]
        rawScope TEXT,          -- JSON, full original scope data if needed
        updatedAt DATETIME
      );
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_programs_platform ON programs(platform);
    `);
  }
  return db;
}

function normalizeProgram(raw, platform) {
  // Normalize one bug bounty program's info (from any platform) to UI format: id, name, platform, minBounty, maxBounty, scopeTypes[], isPublic, url, description, logo
  // HackerOne: raw -> { id, name, handle, offers_bounties, max_bounty, ... }
  if (platform === "HackerOne") {
    // raw is a program from HackerOne API (directory/programs)
    const scopeTypes = [];
    let scopes = (raw.structured_scopes || []).map(s => s.asset_type ? s.asset_type.toLowerCase() : "other");
    if (scopes.some(x => x.includes("web"))) scopeTypes.push("web");
    if (scopes.some(x => x.includes("api"))) scopeTypes.push("api");
    if (scopes.some(x => x.includes("mobile"))) scopeTypes.push("mobile");
    return {
      id: "h1-" + raw.handle,
      name: raw.name,
      platform: "HackerOne",
      minBounty: raw.min_bounty || 0,
      maxBounty: raw.max_bounty || 0,
      scopeTypes,
      isPublic: raw.submission_state === "open" && raw.offers_bounties,
      url: `https://hackerone.com/${raw.handle}`,
      description: raw.profile || raw.bio || "",
      logo: raw.cover_image_url || raw.profile_picture || "",
      rawScope: JSON.stringify(raw.structured_scopes),
    };
  }
  if (platform === "Bugcrowd") {
    // Bugcrowd: id, name, url, max_rewards, rewards, brief, etc
    const types = [];
    const s = raw.target_groups || [];
    if (s.some(g => g.name && g.name.toLowerCase().includes("web"))) types.push("web");
    if (s.some(g => g.name && g.name.toLowerCase().includes("api"))) types.push("api");
    if (s.some(g => g.name && g.name.toLowerCase().includes("mobile"))) types.push("mobile");
    let maxBounty = 0, minBounty = 0;
    if (raw.max_rewards && raw.max_rewards.length)
      maxBounty = Number(raw.max_rewards[0].value || 0);
    if (raw.rewards && raw.rewards.length)
      minBounty = Number(raw.rewards[0].value || 0);

    return {
      id: "bc-" + raw.id || ("bc-" + Math.random()),
      name: raw.name,
      platform: "Bugcrowd",
      minBounty,
      maxBounty,
      scopeTypes: types,
      isPublic: raw.public || false,
      url: raw.url || `https://bugcrowd.com/programs/${raw.slug || raw.id}`,
      description: raw.brief || "",
      logo: raw.logo_url || "",
      rawScope: JSON.stringify(s),
    };
  }
  if (platform === "Intigriti") {
    // Intigriti: id, name, companyHandle, status, rewards, in_scope, out_scope
    const inScope = raw.in_scope || [];
    const types = [];
    if (inScope.some(g => g.asset_type && g.asset_type.toLowerCase().includes("web"))) types.push("web");
    if (inScope.some(g => g.asset_type && g.asset_type.toLowerCase().includes("api"))) types.push("api");
    if (inScope.some(g => g.asset_type && g.asset_type.toLowerCase().includes("mobile"))) types.push("mobile");
    let maxBounty = 0, minBounty = 0;
    if (raw.max_bounty) maxBounty = raw.max_bounty;
    if (raw.min_bounty) minBounty = raw.min_bounty;

    return {
      id: "ig-" + (raw.company_handle || raw.id),
      name: raw.name,
      platform: "Intigriti",
      minBounty,
      maxBounty,
      scopeTypes: types,
      isPublic: raw.public || false,
      url: `https://app.intigriti.com/programs/${raw.company_handle}`,
      description: raw.description || "",
      logo: raw.logo_image_url || "",
      rawScope: JSON.stringify(inScope),
    };
  }
  // Fallback for unknowns
  return {
    id: platform + "-" + (raw.id || "" + Math.random()),
    name: raw.name || "Unknown",
    platform,
    minBounty: 0,
    maxBounty: 0,
    scopeTypes: [],
    isPublic: false,
    url: "#",
    description: "",
    logo: "",
    rawScope: JSON.stringify(raw),
  };
}

async function fetchHackerOnePrograms(page = 1, acc = []) {
  // Open API: https://api.hackerone.com/v1/hackers/programs?page=1&page_size=100
  // NB: Open directory is public, but not all scope rewards are visible.
  let resultArr = acc;
  let url = `https://hackerone.com/hacktivity.json?filter=public&limit=100&page=${page}`;
  // (Not an official API; for demo, use /programs/data)
  url = `https://api.hackerone.com/v1/hackers/programs?page=${page}&page_size=100`;
  const res = await fetch(url, { headers: {} });
  if (!res.ok) throw new Error("HackerOne API error: " + res.status);
  const json = await res.json();
  if (json.data && Array.isArray(json.data)) {
    resultArr = resultArr.concat(json.data.map(d => d.attributes));
    if (json.links && json.links.next) {
      // Pagination - fetch next page up to reasonable limit
      if (page < 5) return fetchHackerOnePrograms(page + 1, resultArr);
    }
  }
  return resultArr;
}
async function fetchBugcrowdPrograms(page = 1, acc = []) {
  // https://bugcrowd.com/programs.json?page=1
  const url = `https://bugcrowd.com/programs.json?page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Bugcrowd API error: " + res.status);
  const json = await res.json();
  if (Array.isArray(json.programs)) {
    acc = acc.concat(json.programs);
    if (json.current_page < json.total_pages && page < 5) {
      return fetchBugcrowdPrograms(page + 1, acc);
    }
  }
  return acc;
}
async function fetchIntigritiPrograms(page = 1, acc = []) {
  // Official API is auth only; some endpoints public (https://www.intigriti.com/api/public/program/list)
  const url = `https://www.intigriti.com/api/public/program/list?page=${page}`;
  // Fallback test endpoint
  const res = await fetch(url);
  if (!res.ok) throw new Error("Intigriti API error: " + res.status);
  const json = await res.json();
  if (Array.isArray(json.data)) {
    acc = acc.concat(json.data);
    if (json.meta && json.meta.next_page && page < 5) {
      return fetchIntigritiPrograms(page + 1, acc);
    }
  }
  return acc;
}

async function fetchAndCachePrograms(win) {
  const db = getDb();
  let allPrograms = [];
  let errors = [];
  try {
    // HackerOne
    const h1Raw = await fetchHackerOnePrograms().catch(e => { errors.push("HackerOne: " + e.message); return []; });
    allPrograms = allPrograms.concat(h1Raw.map(p => normalizeProgram(p, "HackerOne")));
    // Bugcrowd
    const bcRaw = await fetchBugcrowdPrograms().catch(e => { errors.push("Bugcrowd: " + e.message); return []; });
    allPrograms = allPrograms.concat(bcRaw.map(p => normalizeProgram(p, "Bugcrowd")));
    // Intigriti
    const igRaw = await fetchIntigritiPrograms().catch(e => { errors.push("Intigriti: " + e.message); return []; });
    allPrograms = allPrograms.concat(igRaw.map(p => normalizeProgram(p, "Intigriti")));
    // Save to SQLite
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO programs (id, name, platform, url, description, logo, isPublic, minBounty, maxBounty, scopeTypes, rawScope, updatedAt)
      VALUES (@id, @name, @platform, @url, @description, @logo, @isPublic, @minBounty, @maxBounty, @scopeTypes, @rawScope, datetime('now'))
    `);
    db.transaction(() => {
      allPrograms.forEach(p => {
        stmt.run({ ...p, scopeTypes: JSON.stringify(p.scopeTypes), rawScope: p.rawScope });
      });
    })();
  } catch (err) {
    errors.push(err.message || err.toString());
  }
  // Notify renderer of refresh completion
  if (win) win.webContents.send("bountyaggregator:refreshStatus", { ok: errors.length === 0, errors });
  return { ok: errors.length === 0, errors, count: allPrograms.length };
}

function getCachedPrograms({ platform, min, max, scopeTypes, search }) {
  // Basic local query (filterable)
  const db = getDb();
  let q = "SELECT * FROM programs WHERE 1=1";
  let params = {};
  if (platform) { q += " AND platform = @platform"; params.platform = platform; }
  if (typeof min === "number") { q += " AND maxBounty >= @min"; params.min = min; }
  if (typeof max === "number") { q += " AND minBounty <= @max"; params.max = max; }
  if (search) {
    q += " AND (LOWER(name) LIKE @search OR LOWER(description) LIKE @search)";
    params.search = `%${search.toLowerCase()}%`;
  }
  // Scope type filtering - scan JSON field
  if (scopeTypes && Array.isArray(scopeTypes) && scopeTypes.length > 0) {
    q += " AND (" + scopeTypes.map((t, i) => `scopeTypes LIKE @type_${i}`).join(" OR ") + ")";
    scopeTypes.forEach((t, i) => { params["type_" + i] = `%${t}%`; });
  }
  q += " ORDER BY platform, name";
  const rows = db.prepare(q).all(params);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    platform: row.platform,
    minBounty: row.minBounty,
    maxBounty: row.maxBounty,
    scopeTypes: JSON.parse(row.scopeTypes || "[]"),
    isPublic: !!row.isPublic,
    url: row.url,
    description: row.description,
    logo: row.logo,
    updatedAt: row.updatedAt,
  }));
}

function setupBountyAggregatorIpc(mainWindow) {
  let lastRefresh = 0;

  ipcMain.handle("bountyaggregator:fetchPrograms", async (event, { force }) => {
    // Only refresh from remote if forced or cache is stale
    const now = Date.now();
    if (force || (now - lastRefresh > PROGRAM_REFRESH_INTERVAL_MIN * 60000)) {
      lastRefresh = now;
      const res = await fetchAndCachePrograms(mainWindow);
      return res;
    } else {
      return { ok: true, errors: [], cached: true };
    }
  });

  ipcMain.handle("bountyaggregator:getPrograms", (event, filters) => {
    try {
      const data = getCachedPrograms(filters || {});
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Notification relay for status
  // Usage: win.webContents.send("bountyaggregator:refreshStatus", {...})

  // Add-to-Recon integration stub (could bridge to Recon DB)
  ipcMain.handle("bountyaggregator:addToRecon", (event, { program }) => {
    // In real version, forward program scope to recon cache, here just stub
    // (maybe call recon DB/storage method here)
    // Return ok:true for now
    return { ok: true };
  });
}

module.exports = {
  setupBountyAggregatorIpc,
  fetchAndCachePrograms,
  getCachedPrograms,
};
