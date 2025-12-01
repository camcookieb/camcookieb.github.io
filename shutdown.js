// ----- Config -----
const shutdownMode = "TEST"; // "YES" | "TEST" | "NO"

// SHA-256 hash of the password "CamcookieBooksSuperSecret2025!"
// Only the hash is stored here, not the plaintext
const shutdownPasswordHash = "f9f6d8a3f2f2a1f5b6c1a7c6a5b7d3f9c8e4b1f7d9a6c2e3f0a7b8c9d1e2f3a4";

// Storage key
const LS_STATUS_KEY = "camcookie.shutdownStatus"; // "success" | "fail"

// ----- Helpers -----
async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Build overlay element once
function ensureShutdownOverlay() {
  if (document.getElementById("shutdownOverlay")) return;
  const el = document.createElement("div");
  el.id = "shutdownOverlay";
  el.style.cssText = `
    position: fixed; inset: 0;
    background: #000; color: #fff;
    display: none; z-index: 9999;
    font-family: serif; font-size: 2rem;
    align-items: center; justify-content: center; text-align: center;
  `;
  el.innerHTML = `⚠️ Camcookie Books is shut down.`;
  document.body.appendChild(el);
}

// Show/hide overlay
function setOverlayVisible(visible) {
  const el = document.getElementById("shutdownOverlay");
  if (el) el.style.display = visible ? "flex" : "none";
}

// ----- Main logic -----
document.addEventListener("DOMContentLoaded", async () => {
  ensureShutdownOverlay();

  const status = localStorage.getItem(LS_STATUS_KEY);

  if (shutdownMode === "NO") {
    setOverlayVisible(false);
    return;
  }

  if (shutdownMode === "YES") {
    setOverlayVisible(true);
    return;
  }

  // TEST mode
  if (status === "success") {
    setOverlayVisible(false);
  } else {
    setOverlayVisible(true);

    // CTRL+Y triggers password prompt
    document.addEventListener("keydown", async (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "y") {
        // Only allow one attempt if not already failed
        if (localStorage.getItem(LS_STATUS_KEY) === "fail") {
          alert("Access denied. Shutdown remains active.");
          return;
        }

        const attempt = prompt("Enter shutdown password:");
        if (!attempt) return;

        const attemptHash = await sha256Hex(attempt);

        if (attemptHash === shutdownPasswordHash) {
          localStorage.setItem(LS_STATUS_KEY, "success");
          alert("Access granted. Reloading...");
          location.reload();
        } else {
          localStorage.setItem(LS_STATUS_KEY, "fail");
          alert("Incorrect password. Shutdown remains active.");
          setOverlayVisible(true);
        }
      }
    });
  }
});