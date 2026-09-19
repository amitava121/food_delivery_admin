/* Admin Google sign-in — Firebase popup → ID token → backend /auth/google → JWT. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBfwAlbUG_BST78rP7RXs5iVsbGWpeQcWc",
  authDomain: "spice-route-kitchen-app.firebaseapp.com",
  projectId: "spice-route-kitchen-app",
  appId: "1:970780329431:web:6f90f1153b60751ce9f792",
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const err = (msg) => {
  const el = document.getElementById("loginErr");
  el.textContent = msg;
  el.hidden = false;
};

document
  .getElementById("googleLoginBtn")
  ?.addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("http://localhost:8000/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.detail === "Not a staff account"
            ? "This Google account has no staff access"
            : data.detail || "Google sign-in failed",
        );
      sessionStorage.setItem("srk_admin_token", data.access_token);
      location.reload();
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") return;
      err(e.message);
    }
  });
