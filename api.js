/* Shared API client — talks to the FastAPI backend (qr-food-ordering/backend). */
const API = (() => {
  const BASE = "http://localhost:8000";
  const RESTAURANT_NAME = "Spice Route Kitchen";

  async function req(path, { method = "GET", body, token } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401 && token) {
        /* expired/invalid token — drop it and bounce back to the login page */
        sessionStorage.removeItem("srk_admin_token");
        location.href = "index.html";
      }
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return res.status === 204 ? null : res.json();
  }

  async function restaurantId() {
    const list = await req("/menu/restaurants");
    const r = list.find((x) => x.name === RESTAURANT_NAME) || list[0];
    if (!r) throw new Error("No restaurant found");
    return r.id;
  }

  /* Public menu fetch — returns {categories: [{id,name}], items: [...]} */
  async function menu(rid) {
    const [categories, items] = await Promise.all([
      req(`/menu/restaurants/${rid}/categories`),
      req(`/menu/restaurants/${rid}/items?include_unavailable=true`),
    ]);
    return { categories, items };
  }

  /* Auth — returns access_token; throws on bad credentials */
  async function login(email, password) {
    const data = await req("/auth/token", {
      method: "POST",
      body: { username: email, password },
    });
    return data.access_token;
  }

  /* Image upload — file goes backend → worker → R2, returns {url} */
  async function uploadImage(file, token) {
    const res = await fetch(`${BASE}/upload/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: (() => {
        const f = new FormData();
        f.append("file", file);
        return f;
      })(),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return (await res.json()).url;
  }

  /* Delete an uploaded-but-unsaved R2 object by its public URL */
  const deleteImage = (url, token) =>
    req(`/upload/object?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      token,
    });

  /* Admin mutations (token = JWT) */
  const createItem = (rid, item, token) =>
    req(`/menu/restaurants/${rid}/items`, {
      method: "POST",
      body: item,
      token,
    });
  const updateItem = (id, patch, token) =>
    req(`/menu/items/${id}`, { method: "PATCH", body: patch, token });
  const deleteItem = (id, token) =>
    req(`/menu/items/${id}`, { method: "DELETE", token });
  const createCategory = (rid, cat, token) =>
    req(`/menu/restaurants/${rid}/categories`, {
      method: "POST",
      body: cat,
      token,
    });
  const updateCategory = (id, patch, token) =>
    req(`/menu/categories/${id}`, { method: "PATCH", body: patch, token });
  const deleteCategory = (id, token) =>
    req(`/menu/categories/${id}`, { method: "DELETE", token });

  /* Promo banners — admin list includes inactive */
  const banners = (rid, token) =>
    req(`/banners/restaurants/${rid}?include_inactive=true`, { token });
  const createBanner = (rid, banner, token) =>
    req(`/banners/restaurants/${rid}`, { method: "POST", body: banner, token });
  const updateBanner = (id, patch, token) =>
    req(`/banners/${id}`, { method: "PATCH", body: patch, token });
  const deleteBanner = (id, token) =>
    req(`/banners/${id}`, { method: "DELETE", token });

  /* Users (Google sign-ins synced from the customer site) */
  const users = (token) => req("/auth/users", { token });
  const createUser = (body, token) =>
    req("/auth/users", { method: "POST", body, token });
  const updateUser = (id, patch, token) =>
    req(`/auth/users/${id}`, { method: "PATCH", body: patch, token });
  const deleteUser = (id, token) =>
    req(`/auth/users/${id}`, { method: "DELETE", token });

  return {
    BASE,
    RESTAURANT_NAME,
    req,
    restaurantId,
    menu,
    login,
    uploadImage,
    deleteImage,
    createItem,
    updateItem,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
    banners,
    createBanner,
    updateBanner,
    deleteBanner,
    users,
    createUser,
    updateUser,
    deleteUser,
  };
})();
