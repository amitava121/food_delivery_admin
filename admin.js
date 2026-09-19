/* Admin panel — dish CRUD + offers, driven entirely by the FastAPI backend.
   Shared by the three pages: index (dashboard), menu.html, banners.html.
   Page-specific sections are guarded by element presence. */
const $ = (id) => document.getElementById(id);
const PAGE = document.body.dataset.page || "dashboard";
let token = sessionStorage.getItem("srk_admin_token") || "";
let rid = null;
let categories = [];
let items = [];
let filter = "";
let editingId = null;
let currentImageUrl = "";
let pendingUpload = "";
let banners = [];
let editingBannerId = null;
let bannerImageUrl = "";
let bannerPending = "";

const CAT_EMOJI = {
  pizza: "🍕",
  burgers: "🍔",
  "biryani-rice": "🍛",
  "north-indian": "🍲",
  desserts: "🍰",
  beverages: "🥤",
  drinks: "🥤",
};
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2000);
}

function showAdmin() {
  const lv = $("loginView");
  if (lv) lv.hidden = true;
  $("adminLayout").hidden = false;
  $("adminNavRight").hidden = false;
  $("drawerBtn").hidden = false;
}
function showLogin() {
  const lv = $("loginView");
  if (lv) lv.hidden = false;
  $("adminLayout").hidden = true;
  $("adminNavRight").hidden = true;
  $("drawerBtn").hidden = true;
}

/* ---- drawer ---- */
function openDrawer() {
  document.body.classList.add("drawer-open");
}
function closeDrawer() {
  document.body.classList.remove("drawer-open");
}

async function refresh() {
  try {
    rid = rid || (await API.restaurantId());
    const [data, b] = await Promise.all([
      API.menu(rid),
      $("bannerList") ? API.banners(rid, token) : Promise.resolve([]),
    ]);
    categories = data.categories;
    items = data.items;
    if ($("adminStats")) renderStats();
    if ($("dishRows")) renderTable();
    if ($("catList")) renderCats();
    if ($("userList")) await loadUsers();
    if ($("bannerList")) {
      banners = b;
      renderBanners();
    }
  } catch (e) {
    toast("API error: " + e.message);
  }
}

function renderStats() {
  const live = items.filter((i) => i.is_available).length;
  const offers = items.filter((i) => i.offer_pct).length;
  $("adminStats").innerHTML = [
    [items.length, "Total dishes"],
    [live, "Live on menu"],
    [offers, "With offers"],
    [categories.length, "Categories"],
  ]
    .map(
      ([v, l]) => `<div class="stat-card"><b>${v}</b><span>${l}</span></div>`,
    )
    .join("");
}

function catName(id) {
  const c = categories.find((x) => x.id === id);
  return c ? c.name : "—";
}

function renderTable() {
  const q = filter.trim().toLowerCase();
  const rows = items.filter(
    (i) =>
      !q || (i.name + " " + catName(i.category_id)).toLowerCase().includes(q),
  );
  $("dishRows").innerHTML = rows
    .map(
      (d) => `
    <tr class="${d.is_available ? "" : "off"}" data-id="${d.id}">
      <td><div class="dish-cell">
        ${
          d.image_url
            ? `<img class="dish-thumb" src="${esc(d.image_url)}" alt="" onerror="this.outerHTML='<span class=&quot;dish-thumb dish-thumb-fallback&quot;>${CAT_EMOJI[slug(catName(d.category_id))] || "🍽️"}</span>'" />`
            : `<span class="dish-thumb dish-thumb-fallback">${CAT_EMOJI[slug(catName(d.category_id))] || "🍽️"}</span>`
        }
        <span>${esc(d.name)}</span>
      </div></td>
      <td>${esc(catName(d.category_id))}</td>
      <td><span class="diet-mark ${d.is_veg ? "" : "nonveg"}"></span></td>
      <td>₹${d.price}</td>
      <td>
        <input class="offer-input" type="number" min="0" max="90" value="${d.offer_pct ?? ""}"
          placeholder="—" onchange="saveOffer(${d.id}, this.value)" title="Discount %" />
        ${d.offer_pct ? `<span class="offer-badge">${d.offer_pct}% OFF</span>` : ""}
      </td>
      <td>${esc(d.tag || "—")}</td>
      <td><label class="veg-toggle avail-toggle"><input type="checkbox" ${d.is_available ? "checked" : ""} onchange="toggleAvail(${d.id}, this.checked)" /><span class="veg-box"></span></label></td>
      <td><div class="row-actions">
        <button onclick="openEdit(${d.id})" title="Edit">✏️</button>
        <button class="del" onclick="delDish(${d.id})" title="Delete">🗑️</button>
      </div></td>
    </tr>`,
    )
    .join("");
  $("tableEmpty").hidden = rows.length > 0;
}

/* ============ Row actions (exposed for inline handlers) ============ */
async function saveOffer(id, val) {
  const pct = val === "" ? null : Math.min(90, Math.max(0, parseInt(val) || 0));
  try {
    await API.updateItem(id, { offer_pct: pct }, token);
    toast(pct ? `Offer ${pct}% applied` : "Offer removed");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

async function toggleAvail(id, on) {
  try {
    await API.updateItem(id, { is_available: on }, token);
    toast(on ? "Dish is live" : "Dish hidden (sold out)");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

async function delDish(id) {
  const d = items.find((x) => x.id === id);
  if (!confirm(`Delete "${d.name}" from the menu?`)) return;
  try {
    await API.deleteItem(id, token);
    toast("Dish deleted");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

/* ============ Dish form ============ */
function fillCatSelect(selectedId) {
  $("catSelect").innerHTML = categories
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
}

function openEdit(id) {
  const d = items.find((x) => x.id === id);
  if (!d) return;
  editingId = id;
  $("dishFormTitle").textContent = "Edit dish";
  const f = $("dishForm");
  f.name.value = d.name;
  f.price.value = d.price;
  f.offer_pct.value = d.offer_pct ?? "";
  f.tag.value = d.tag || "";
  f.description.value = d.description || "";
  setPreview(d.image_url);
  pendingUpload = "";
  f.is_veg.checked = !!d.is_veg;
  f.is_available.checked = !!d.is_available;
  fillCatSelect(d.category_id);
  $("formErr").hidden = true;
  $("dishModal").classList.add("open");
}

function openAdd() {
  editingId = null;
  $("dishFormTitle").textContent = "Add dish";
  $("dishForm").reset();
  $("dishForm").is_veg.checked = true;
  $("dishForm").is_available.checked = true;
  setPreview(null);
  pendingUpload = "";
  fillCatSelect(categories[0]?.id);
  $("formErr").hidden = true;
  $("dishModal").classList.add("open");
}

function closeModal() {
  if (pendingUpload) {
    API.deleteImage(pendingUpload, token).catch(() => {});
    pendingUpload = "";
  }
  $("dishModal").classList.remove("open");
}

function setPreview(url) {
  currentImageUrl = url || "";
  const img = $("imgPreview");
  img.hidden = !url;
  if (url) img.src = url;
  $("imgRemove").hidden = !url;
  $("uploadStatus").textContent = "";
}

/* Transcode to WebP before upload — max 800px wide, q=0.85 ≈ visually lossless
   at dish-card sizes while cutting bytes ~60-80% vs JPEG/PNG. */
async function toWebp(file, maxW = 800, quality = 0.85) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxW / bmp.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) =>
      canvas.toBlob(res, "image/webp", quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", {
      type: "image/webp",
    });
  } catch {
    return file; // decode failed (rare format) — upload original
  }
}

async function handleImagePick(e) {
  const raw = e.target.files[0];
  if (!raw) return;
  const status = $("uploadStatus");
  status.textContent = "Optimizing…";
  try {
    const file = await toWebp(raw);
    status.textContent = `Uploading… (${Math.round(file.size / 1024)} KB webp)`;
    const url = await API.uploadImage(file, token);
    if (pendingUpload) API.deleteImage(pendingUpload, token).catch(() => {});
    pendingUpload = url;
    setPreview(url);
    status.textContent = "Uploaded ✓";
    toast("Image uploaded to R2");
  } catch (e2) {
    status.textContent = "Upload failed: " + e2.message;
  }
}

async function submitDish(e) {
  e.preventDefault();
  const f = e.target;
  const payload = {
    category_id: Number(f.category_id.value),
    name: f.name.value.trim(),
    description: f.description.value.trim() || null,
    price: Number(f.price.value),
    image_url: currentImageUrl || null,
    is_veg: f.is_veg.checked,
    tag: f.tag.value || null,
    offer_pct:
      f.offer_pct.value === ""
        ? null
        : Math.min(90, Math.max(0, parseInt(f.offer_pct.value) || 0)),
    is_available: f.is_available.checked,
    stock: 50,
  };
  try {
    if (editingId) {
      await API.updateItem(editingId, payload, token);
      toast("Dish updated");
    } else {
      await API.createItem(rid, payload, token);
      toast("Dish added");
    }
    pendingUpload = "";
    closeModal();
    refresh();
  } catch (e2) {
    $("formErr").textContent = e2.message;
    $("formErr").hidden = false;
  }
}

/* ============ Banners ============ */
function renderBanners() {
  $("bannerList").innerHTML = banners.length
    ? banners
        .map(
          (b) => `<div class="banner-row ${b.is_active ? "" : "off"}">
        <span class="b-swatch" style="background:${esc(b.bg_color)}"></span>
        ${b.image_url ? `<img class="b-thumb" src="${esc(b.image_url)}" alt="" />` : ""}
        <div class="b-text"><b>${esc(b.title)}</b><span>${esc(b.subtitle || "")}${b.cta_text ? " · " + esc(b.cta_text) : ""}</span></div>
        <label class="veg-toggle avail-toggle"><input type="checkbox" ${b.is_active ? "checked" : ""} onchange="toggleBanner(${b.id}, this.checked)" /><span class="veg-box"></span></label>
        <div class="row-actions">
          <button onclick="openBannerEdit(${b.id})" title="Edit">✏️</button>
          <button class="del" onclick="delBanner(${b.id})" title="Delete">🗑️</button>
        </div>
      </div>`,
        )
        .join("")
    : `<p class="banners-hint">No banners yet — the site top stays neutral until you add one.</p>`;
}

function setBannerPreview(url) {
  bannerImageUrl = url || "";
  const img = $("bImgPreview");
  img.hidden = !url;
  if (url) img.src = url;
  $("bImgRemove").hidden = !url;
  $("bUploadStatus").textContent = "";
}

function openBannerAdd() {
  editingBannerId = null;
  $("bannerFormTitle").textContent = "Add banner";
  $("bannerForm").reset();
  $("bannerForm").bg_color.value = "#f6e3b4";
  $("bannerForm").is_active.checked = true;
  setBannerPreview(null);
  bannerPending = "";
  $("bannerFormErr").hidden = true;
  $("bannerModal").classList.add("open");
}

function openBannerEdit(id) {
  const b = banners.find((x) => x.id === id);
  if (!b) return;
  editingBannerId = id;
  $("bannerFormTitle").textContent = "Edit banner";
  const f = $("bannerForm");
  f.title.value = b.title;
  f.subtitle.value = b.subtitle || "";
  f.cta_text.value = b.cta_text || "";
  f.bg_color.value = b.bg_color || "#f6e3b4";
  f.sort_order.value = b.sort_order ?? 0;
  f.is_active.checked = !!b.is_active;
  setBannerPreview(b.image_url);
  bannerPending = "";
  $("bannerFormErr").hidden = true;
  $("bannerModal").classList.add("open");
}

function closeBannerModal() {
  if (bannerPending) {
    API.deleteImage(bannerPending, token).catch(() => {});
    bannerPending = "";
  }
  $("bannerModal").classList.remove("open");
}

async function handleBannerPick(e) {
  const raw = e.target.files[0];
  if (!raw) return;
  const status = $("bUploadStatus");
  status.textContent = "Optimizing…";
  try {
    const file = await toWebp(raw);
    status.textContent = `Uploading… (${Math.round(file.size / 1024)} KB webp)`;
    const url = await API.uploadImage(file, token);
    if (bannerPending) API.deleteImage(bannerPending, token).catch(() => {});
    bannerPending = url;
    setBannerPreview(url);
    status.textContent = "Uploaded ✓";
    toast("Image uploaded to R2");
  } catch (e2) {
    status.textContent = "Upload failed: " + e2.message;
  }
}

async function submitBanner(e) {
  e.preventDefault();
  const f = e.target;
  const payload = {
    title: f.title.value.trim(),
    subtitle: f.subtitle.value.trim() || null,
    cta_text: f.cta_text.value.trim() || null,
    image_url: bannerImageUrl || null,
    bg_color: f.bg_color.value,
    sort_order: Number(f.sort_order.value) || 0,
    is_active: f.is_active.checked,
  };
  try {
    if (editingBannerId) {
      await API.updateBanner(editingBannerId, payload, token);
      toast("Banner updated");
    } else {
      await API.createBanner(rid, payload, token);
      toast("Banner added");
    }
    bannerPending = "";
    closeBannerModal();
    refresh();
  } catch (e2) {
    $("bannerFormErr").textContent = e2.message;
    $("bannerFormErr").hidden = false;
  }
}

async function toggleBanner(id, on) {
  try {
    await API.updateBanner(id, { is_active: on }, token);
    toast(on ? "Banner live" : "Banner hidden");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

async function delBanner(id) {
  const b = banners.find((x) => x.id === id);
  if (!confirm(`Delete banner "${b ? b.title : ""}"?`)) return;
  try {
    await API.deleteBanner(id, token);
    toast("Banner deleted");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

/* ============ Categories page ============ */
let editingCatId = null;
let catImageUrl = "";
let catPending = "";

function renderCats() {
  $("catList").innerHTML = categories.length
    ? categories
        .map(
          (c) => `<div class="banner-row">
        ${c.image_url ? `<img class="b-thumb" src="${esc(c.image_url)}" alt="" />` : `<span class="b-swatch cat-ic">${CAT_EMOJI[slug(c.name)] || "🍽️"}</span>`}
        <div class="b-text"><b>${esc(c.name)}</b><span>${items.filter((i) => i.category_id === c.id).length} dishes</span></div>
        <div class="row-actions">
          <button onclick="openCatEdit(${c.id})" title="Edit">✏️</button>
          <button class="del" onclick="delCat(${c.id})" title="Delete">🗑️</button>
        </div>
      </div>`,
        )
        .join("")
    : `<p class="banners-hint">No categories yet — add one to start grouping dishes.</p>`;
}

function setCatPreview(url) {
  catImageUrl = url || "";
  const img = $("cImgPreview");
  img.hidden = !url;
  if (url) img.src = url;
  $("cImgRemove").hidden = !url;
  $("cUploadStatus").textContent = "";
}

function openCatAdd() {
  editingCatId = null;
  $("catFormTitle").textContent = "Add category";
  $("catForm").reset();
  setCatPreview(null);
  catPending = "";
  $("catFormErr").hidden = true;
  $("catModal").classList.add("open");
}

function openCatEdit(id) {
  const c = categories.find((x) => x.id === id);
  if (!c) return;
  editingCatId = id;
  $("catFormTitle").textContent = "Edit category";
  $("catForm").name.value = c.name;
  setCatPreview(c.image_url);
  catPending = "";
  $("catFormErr").hidden = true;
  $("catModal").classList.add("open");
}

function closeCatModal() {
  if (catPending) {
    API.deleteImage(catPending, token).catch(() => {});
    catPending = "";
  }
  $("catModal").classList.remove("open");
}

async function handleCatPick(e) {
  const raw = e.target.files[0];
  if (!raw) return;
  const status = $("cUploadStatus");
  status.textContent = "Optimizing…";
  try {
    const file = await toWebp(raw);
    status.textContent = `Uploading… (${Math.round(file.size / 1024)} KB webp)`;
    const url = await API.uploadImage(file, token);
    if (catPending) API.deleteImage(catPending, token).catch(() => {});
    catPending = url;
    setCatPreview(url);
    status.textContent = "Uploaded ✓";
    toast("Image uploaded to R2");
  } catch (e2) {
    status.textContent = "Upload failed: " + e2.message;
  }
}

async function submitCat(e) {
  e.preventDefault();
  const f = e.target;
  const payload = {
    name: f.name.value.trim(),
    image_url: catImageUrl || null,
  };
  try {
    if (editingCatId) {
      await API.updateCategory(editingCatId, payload, token);
      toast("Category updated");
    } else {
      await API.createCategory(rid, payload, token);
      toast("Category added");
    }
    catPending = "";
    closeCatModal();
    refresh();
  } catch (e2) {
    $("catFormErr").textContent = e2.message;
    $("catFormErr").hidden = false;
  }
}

async function delCat(id) {
  const c = categories.find((x) => x.id === id);
  if (!confirm(`Delete category "${c ? c.name : ""}"?`)) return;
  try {
    await API.deleteCategory(id, token);
    toast("Category deleted");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

/* ============ Users page ============ */
let users = [];
let userFilter = "all";
let editingUserId = null;
let myRoles = [];
let editUserRoles = new Set();

const ROLE_LABEL = {
  admin: "Admin",
  kitchen: "Chef",
  customer: "User",
};

async function loadUsers() {
  const [me, list] = await Promise.all([
    API.req("/auth/me", { token }),
    API.users(token),
  ]);
  myRoles = me.roles || [];
  users = list;
  renderUsers();
}

function setUserFilter(f) {
  userFilter = f;
  $("userFilterLabel").textContent = f === "admin" ? "Admin only" : "All";
  $("filterModal").classList.remove("open");
  renderUsers();
}

function renderUsers() {
  const list =
    userFilter === "admin"
      ? users.filter((u) => (u.roles || []).includes("admin"))
      : users;
  $("userList").innerHTML = list.length
    ? list
        .map(
          (u) => `<div class="banner-row ${u.is_blocked ? "user-blocked" : ""}">
        ${u.photo_url ? `<img class="b-thumb" src="${esc(u.photo_url)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;b-swatch cat-ic&quot;>👤</span>'" />` : `<span class="b-swatch cat-ic">👤</span>`}
        <div class="b-text">
          <b>${esc(u.name)} ${(u.roles || []).map((r) => `<span class="role-badge role-${r}">${ROLE_LABEL[r] || r}</span>`).join(" ")}${u.is_blocked ? ' <span class="user-badge">blocked</span>' : ""}</b>
          <span>${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""}</span>
        </div>
        <div class="row-actions">
          <button onclick="openUserEdit(${u.id})" title="Edit name">✏️</button>
          <button class="${u.is_blocked ? "" : "del"}" onclick="toggleBlock(${u.id})" title="${u.is_blocked ? "Unblock" : "Block"}">${u.is_blocked ? "🔓" : "🚫"}</button>
          <button class="del" onclick="delUser(${u.id})" title="Delete">🗑️</button>
        </div>
      </div>`,
        )
        .join("")
    : `<p class="banners-hint">${
        userFilter === "admin"
          ? "No admin users."
          : "No users yet — they appear here after signing in on the site."
      }</p>`;
}

function openUserEdit(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  editingUserId = id;
  $("userForm").name.value = u.name;
  $("userFormErr").hidden = true;
  editUserRoles = new Set(u.roles || ["customer"]);
  $("userEmailCur").textContent = u.email;
  $("userRoleCur").textContent = (u.roles || [])
    .map((r) => ROLE_LABEL[r] || r)
    .join(", ");
  /* only admins may change roles */
  const canEditRole = myRoles.includes("admin");
  $("editRolePicker").style.display = canEditRole ? "" : "none";
  document
    .querySelectorAll("#editRolePicker .role-opt")
    .forEach((b) =>
      b.classList.toggle("sel", editUserRoles.has(b.dataset.role)),
    );
  $("userModal").classList.add("open");
}

async function submitUser(e) {
  e.preventDefault();
  const canEditRole = myRoles.includes("admin");
  const patch = { name: e.target.name.value.trim() };
  const orig = users.find((x) => x.id === editingUserId);
  if (canEditRole && orig) {
    const next = [...editUserRoles];
    if (
      JSON.stringify(next.sort()) !==
      JSON.stringify([...(orig.roles || [])].sort())
    )
      patch.roles = next;
  }
  try {
    await API.updateUser(editingUserId, patch, token);
    toast("User updated");
    $("userModal").classList.remove("open");
    loadUsers();
  } catch (e2) {
    $("userFormErr").textContent = e2.message;
    $("userFormErr").hidden = false;
  }
}

async function toggleBlock(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  try {
    await API.updateUser(id, { is_blocked: !u.is_blocked }, token);
    toast(u.is_blocked ? "User unblocked" : "User blocked");
    loadUsers();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

async function delUser(id) {
  const u = users.find((x) => x.id === id);
  if (!confirm(`Delete user "${u ? u.name : ""}"?`)) return;
  try {
    await API.deleteUser(id, token);
    toast("User deleted");
    loadUsers();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

let newUserRoles = new Set(["customer"]);

function openAddUser() {
  $("addUserForm").reset();
  newUserRoles = new Set(["customer"]);
  document
    .querySelectorAll("#rolePicker .role-opt")
    .forEach((b) =>
      b.classList.toggle("sel", newUserRoles.has(b.dataset.role)),
    );
  $("addUserErr").hidden = true;
  $("addUserModal").classList.add("open");
}

function toggleNewRole(r) {
  newUserRoles.has(r) ? newUserRoles.delete(r) : newUserRoles.add(r);
  if (!newUserRoles.size) newUserRoles.add("customer");
  document
    .querySelectorAll("#rolePicker .role-opt")
    .forEach((b) =>
      b.classList.toggle("sel", newUserRoles.has(b.dataset.role)),
    );
}

async function submitAddUser(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await API.createUser(
      {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        password: f.password.value,
        roles: [...newUserRoles],
      },
      token,
    );
    toast("User created");
    $("addUserModal").classList.remove("open");
    loadUsers();
  } catch (e2) {
    $("addUserErr").textContent = e2.message;
    $("addUserErr").hidden = false;
  }
}

/* ============ Auth ============ */
async function doLogin(e) {
  e.preventDefault();
  $("loginErr").hidden = true;
  try {
    token = await API.login($("loginEmail").value.trim(), $("loginPass").value);
    sessionStorage.setItem("srk_admin_token", token);
    showAdmin();
    refresh();
  } catch (e2) {
    $("loginErr").textContent =
      e2.message === "Incorrect credentials"
        ? "Wrong email or password"
        : e2.message;
    $("loginErr").hidden = false;
  }
}

async function addCategory() {
  const name = prompt("New category name:");
  if (!name || !name.trim()) return;
  try {
    await API.createCategory(rid, { name: name.trim() }, token);
    toast("Category added");
    refresh();
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

/* ============ Events ============ */
$("drawerBtn").addEventListener("click", openDrawer);
$("drawerScrim").addEventListener("click", closeDrawer);
$("drawerClose").addEventListener("click", closeDrawer);
if ($("loginForm")) {
  $("loginForm").addEventListener("submit", doLogin);
}
/* menu page */
if ($("dishForm")) {
  $("dishForm").addEventListener("submit", submitDish);
  $("addDishBtn").addEventListener("click", openAdd);
  $("addCatBtn").addEventListener("click", addCategory);
  $("dishCancel").addEventListener("click", closeModal);
  $("dishModal").addEventListener("click", (e) => {
    if (e.target === $("dishModal")) closeModal();
  });
  $("adminSearch").addEventListener("input", (e) => {
    filter = e.target.value;
    renderTable();
  });
  $("dishForm").image_file.addEventListener("change", handleImagePick);
  $("imgRemove").addEventListener("click", () => {
    if (pendingUpload) {
      API.deleteImage(pendingUpload, token).catch(() => {});
      pendingUpload = "";
    }
    setPreview(null);
    $("dishForm").image_file.value = "";
  });
}
/* categories page */
if ($("catForm")) {
  $("addCatBtn2").addEventListener("click", openCatAdd);
  $("catForm").addEventListener("submit", submitCat);
  $("catCancel").addEventListener("click", closeCatModal);
  $("catModal").addEventListener("click", (e) => {
    if (e.target === $("catModal")) closeCatModal();
  });
  $("catForm")
    .querySelector('[name="c_image_file"]')
    .addEventListener("change", handleCatPick);
  $("cImgRemove").addEventListener("click", () => {
    if (catPending) {
      API.deleteImage(catPending, token).catch(() => {});
      catPending = "";
    }
    setCatPreview(null);
  });
}
/* users page */
if ($("userForm")) {
  $("userFilterBtn").addEventListener("click", () => {
    document
      .querySelectorAll(".filter-opt")
      .forEach((b) =>
        b.classList.toggle("sel", b.dataset.filter === userFilter),
      );
    $("filterModal").classList.add("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-wrap"))
      $("filterModal")?.classList.remove("open");
  });
  $("addUserBtn").addEventListener("click", openAddUser);
  $("addUserForm").addEventListener("submit", submitAddUser);
  $("addUserCancel").addEventListener("click", () =>
    $("addUserModal").classList.remove("open"),
  );
  $("addUserModal").addEventListener("click", (e) => {
    if (e.target === $("addUserModal"))
      $("addUserModal").classList.remove("open");
  });
  document
    .querySelectorAll("#rolePicker .role-opt")
    .forEach((b) =>
      b.addEventListener("click", () => toggleNewRole(b.dataset.role)),
    );
  document.querySelectorAll("#editRolePicker .role-opt").forEach((b) =>
    b.addEventListener("click", () => {
      const r = b.dataset.role;
      editUserRoles.has(r) ? editUserRoles.delete(r) : editUserRoles.add(r);
      if (!editUserRoles.size) editUserRoles.add("customer");
      document
        .querySelectorAll("#editRolePicker .role-opt")
        .forEach((x) =>
          x.classList.toggle("sel", editUserRoles.has(x.dataset.role)),
        );
    }),
  );
  $("userForm").addEventListener("submit", submitUser);
  $("userCancel").addEventListener("click", () =>
    $("userModal").classList.remove("open"),
  );
  $("userModal").addEventListener("click", (e) => {
    if (e.target === $("userModal")) $("userModal").classList.remove("open");
  });
}
/* banners page */
if ($("bannerForm")) {
  $("addBannerBtn").addEventListener("click", openBannerAdd);
  $("bannerForm").addEventListener("submit", submitBanner);
  $("bannerCancel").addEventListener("click", closeBannerModal);
  $("bannerModal").addEventListener("click", (e) => {
    if (e.target === $("bannerModal")) closeBannerModal();
  });
  $("bannerForm")
    .querySelector('[name="b_image_file"]')
    .addEventListener("change", handleBannerPick);
  $("bImgRemove").addEventListener("click", () => {
    if (bannerPending) {
      API.deleteImage(bannerPending, token).catch(() => {});
      bannerPending = "";
    }
    setBannerPreview(null);
  });
}
$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("srk_admin_token");
  token = "";
  if ($("loginView")) showLogin();
  else location.href = "index.html";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    $("userModal")?.classList.remove("open");
    $("addUserModal")?.classList.remove("open");
    $("filterModal")?.classList.remove("open");
  }
});

/* ============ Live updates ============ */
/* WebSocket pushes {"type":"menu_changed"} on every menu write — refreshes
   the dashboard instantly, debounced, auto-reconnects. No polling. */
(function connectMenuSocket() {
  let t = null;
  const ws = new WebSocket(API.BASE.replace(/^http/, "ws") + "/ws/menu");
  ws.onmessage = (e) => {
    if (!token || $("dishModal")?.classList.contains("open")) return;
    const type = JSON.parse(e.data || "{}").type;
    clearTimeout(t);
    t = setTimeout(() => {
      if (type === "users_changed") {
        if ($("userList")) loadUsers();
      } else refresh();
    }, 250);
  };
  ws.onclose = () => setTimeout(connectMenuSocket, 3000);
  ws.onerror = () => ws.close();
})();

/* ============ Boot ============ */
if (token) {
  showAdmin();
  refresh();
} else if (PAGE === "dashboard") {
  showLogin();
} else {
  location.href = "index.html";
}
