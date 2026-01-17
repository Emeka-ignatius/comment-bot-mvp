const elApiBase = document.getElementById("apiBase");
const elToken = document.getElementById("token");
const elAccountName = document.getElementById("accountName");
const elCookieStore = document.getElementById("cookieStore");
const elStatus = document.getElementById("status");
const btnCapture = document.getElementById("capture");
const btnSave = document.getElementById("save");
const loginLink = document.getElementById("loginLink");

function setStatus(msg) {
  elStatus.textContent = msg;
}

function normalizeBaseUrl(url) {
  const trimmed = (url || "").trim().replace(/\/+$/, "");
  return trimmed;
}

async function loadSaved() {
  const saved = await chrome.storage.local.get([
    "apiBase",
    "accountName",
    "cookieStoreId",
  ]);
  if (saved.apiBase) elApiBase.value = saved.apiBase;
  if (saved.accountName) elAccountName.value = saved.accountName;
  if (saved.cookieStoreId && elCookieStore) elCookieStore.value = saved.cookieStoreId;
}

async function saveSettings() {
  const apiBase = normalizeBaseUrl(elApiBase.value);
  const accountName = (elAccountName.value || "").trim();
  const cookieStoreId = elCookieStore ? elCookieStore.value : "";
  await chrome.storage.local.set({ apiBase, accountName, cookieStoreId });
  setStatus("Saved.");
}

function cookiesToHeaderString(cookies) {
  // Deduplicate by name, keep the longest value (helps when multiple domains exist)
  const map = new Map();
  for (const c of cookies) {
    const existing = map.get(c.name);
    if (!existing || String(c.value).length > String(existing.value).length) {
      map.set(c.name, c);
    }
  }
  return Array.from(map.values())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function captureRumbleCookies() {
  // Capture cookies for rumble.com and subdomains
  const storeId = elCookieStore ? elCookieStore.value : "";
  const cookies = await chrome.cookies.getAll({
    domain: "rumble.com",
    ...(storeId ? { storeId } : {}),
  });
  if (!cookies || cookies.length === 0) {
    throw new Error("No rumble.com cookies found. Are you logged in?");
  }
  return cookiesToHeaderString(cookies);
}

async function populateCookieStores() {
  if (!elCookieStore) return;
  const stores = await chrome.cookies.getAllCookieStores();
  // This is a heuristic; Chrome returns one store for regular and one per incognito profile.
  elCookieStore.innerHTML = "";
  for (const s of stores) {
    const tabUrls = (s.tabIds || []).length;
    const label = `storeId=${s.id}${tabUrls ? ` (tabs: ${tabUrls})` : ""}`;
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = label;
    elCookieStore.appendChild(opt);
  }
  // Default to first store if nothing selected
  if (!elCookieStore.value && stores[0]) {
    elCookieStore.value = stores[0].id;
  }
}

async function trpcMutation(apiBase, path, input) {
  // Use NON-batch tRPC call to avoid batch-shape mismatches
  const url = `${apiBase}/api/trpc/${path}`;
  const body = JSON.stringify({ json: input });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    // tRPC errors often come back with 200, but handle non-2xx too
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const err = json?.error;
  if (err) {
    const msg = err?.message || JSON.stringify(err);
    throw new Error(msg);
  }
  return json?.result?.data;
}

async function captureAndSend() {
  const apiBase = normalizeBaseUrl(elApiBase.value);
  const token = (elToken.value || "").trim();
  const accountName = (elAccountName.value || "").trim();

  if (!apiBase) throw new Error("App URL is required.");
  if (!/^https?:\/\//i.test(apiBase)) {
    throw new Error("App URL must start with http:// or https://");
  }
  if (!token) throw new Error("Connect token is required.");

  setStatus("Capturing cookies...");
  const cookieString = await captureRumbleCookies();
  const storeId = elCookieStore ? elCookieStore.value : "";
  setStatus(
    `Captured cookies (${cookieString.length} chars) from storeId=${storeId || "default"}. Sending...`
  );

  const payload = {
    connectToken: token,
    platform: "rumble",
    accountName: accountName || undefined,
    cookies: cookieString,
  };

  await trpcMutation(apiBase, "accounts.connectComplete", payload);
  setStatus("Success! Account saved. You can close this popup.");
}

btnSave.addEventListener("click", () => {
  saveSettings().catch((e) => setStatus(String(e.message || e)));
});

btnCapture.addEventListener("click", () => {
  btnCapture.disabled = true;
  captureAndSend()
    .catch((e) => setStatus(`Error: ${String(e.message || e)}`))
    .finally(() => {
      btnCapture.disabled = false;
    });
});

loginLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://rumble.com/account/signin" });
});

populateCookieStores()
  .catch((e) => setStatus(`Error loading cookie stores: ${String(e.message || e)}`))
  .finally(() => {
    loadSaved().catch(() => {});
  });

