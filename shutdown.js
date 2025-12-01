<script>
// Control variable: "YES", "TEST", or "NO"
const shutdownMode = "TEST";
const shutdownPasswordHash = "d5f0f7d3f6a6a8c8a9e2b9f5c1d2e7f3c4b8a9d7e6f1c2b3a4d5e6f7c8a9b0d1";

// Helper: hash a string with SHA-256
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function showShutdownScreen() {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      background:#000;
      color:#fff;
      font-family:serif;
      font-size:2rem;
      text-align:center;
    ">
      Sorry, but Camcookie Books is shut down. Come back soon!
    </div>
  `;
}

(async () => {
  const shutdownStatus = localStorage.getItem("shutdownStatus");

  if (shutdownMode === "YES") {
    showShutdownScreen();
  } else if (shutdownMode === "TEST") {
    if (shutdownStatus === "success") {
      console.log("Shutdown bypassed with correct password.");
    } else {
      showShutdownScreen();

      document.addEventListener("keydown", async function(e) {
        if (e.ctrlKey && e.key.toLowerCase() === "y") {
          const attempt = prompt("Enter shutdown password:");
          if (attempt) {
            const attemptHash = await hashString(attempt);
            if (attemptHash === shutdownPasswordHash) {
              localStorage.setItem("shutdownStatus", "success");
              alert("Access granted. Reloading...");
              location.reload();
            } else {
              localStorage.setItem("shutdownStatus", "fail");
              alert("Incorrect password. Shutdown remains active.");
              showShutdownScreen();
            }
          }
        }
      });
    }
  }
})();
</script>