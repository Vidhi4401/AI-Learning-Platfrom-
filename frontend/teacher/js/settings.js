const API = "http://127.0.0.1:8000/api/v1";

/* =========================
   TOAST NOTIFICATION
=========================*/
function showToast(msg, type = "success") {
  let toast = document.getElementById("settingsToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "settingsToast";
    toast.style.cssText = `
      position:fixed; bottom:28px; right:28px;
      padding:12px 22px; border-radius:10px;
      font-family:'Inter',sans-serif; font-size:14px; font-weight:500;
      color:white; z-index:9999;
      transform:translateY(80px); opacity:0;
      transition:transform 0.3s ease, opacity 0.3s ease;
      box-shadow:0 8px 24px rgba(0,0,0,0.15);
      display:flex; align-items:center; gap:8px;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>${type === "success" ? "✓" : "✕"}</span> ${msg}`;
  toast.style.background = type === "success" ? "#16a34a" : "#ef4444";
  toast.style.transform  = "translateY(0)";
  toast.style.opacity    = "1";
  setTimeout(() => {
    toast.style.transform = "translateY(80px)";
    toast.style.opacity   = "0";
  }, 3200);
}

/* =========================
   UPDATE SIDEBAR BRANDING
=========================*/
function updateSidebarBranding(name, logoUrl) {
  const brandText = document.getElementById("sidebarPlatformName");
  const brandIcon = document.querySelector(".sidebar-brand-icon");

  if (brandText && name) {
    brandText.textContent = name;
  }

  if (brandIcon) {
    if (logoUrl) {
      brandIcon.innerHTML = `
        <img src="${logoUrl}" alt="${name}"
             style="width:100%;height:100%;object-fit:cover;border-radius:7px;"
             onerror="this.parentElement.textContent='🎓'">
      `;
    } else {
      brandIcon.textContent = "🎓";
    }
  }
}

/* =========================
   UPDATE NAVBAR PROFILE
=========================*/
function updateNavbarProfile(name, email) {
  const profileName  = document.getElementById("navProfileName");
  const profileEmail = document.getElementById("navProfileEmail");
  const avatar       = document.getElementById("navAvatar");

  if (profileName  && name)  profileName.textContent  = name;
  if (profileEmail && email) profileEmail.textContent = email;
  if (avatar && name) avatar.textContent = name.charAt(0).toUpperCase();
}

/* =========================
   FETCH Teacher PROFILE
=========================*/
async function fetchTeacherProfile() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API}/teacher/profile`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch (err) {
    console.error("Profile fetch error:", err);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return { name: user.name, email: user.email };
  }
}

/* =========================
   SAVE Teacher PROFILE
=========================*/
async function saveTeacherProfile() {
  const token    = localStorage.getItem("token");
  const name     = document.getElementById("TeacherName")?.value.trim();
  const email    = document.getElementById("TeacherEmail")?.value.trim();
  const password = document.getElementById("TeacherPassword")?.value.trim();

  if (!name)  { showToast("Name cannot be empty", "error");  return false; }
  if (!email) { showToast("Email cannot be empty", "error"); return false; }

  const formData = new FormData();
  formData.append("name",  name);
  formData.append("email", email);
  if (password) formData.append("password", password);

  try {
    const res = await fetch(`${API}/teacher/profile`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) throw new Error("Save failed");
    const updated = await res.json();

    updateNavbarProfile(updated.name, updated.email);

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.name  = updated.name;
    user.email = updated.email;
    localStorage.setItem("user", JSON.stringify(user));

    const pwdField = document.getElementById("TeacherPassword");
    if (pwdField) pwdField.value = "";

    return true;

  } catch (err) {
    showToast("Failed to update profile", "error");
    return false;
  }
}

/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", async () => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  
  // 1. Load Profile
  const profile = await fetchTeacherProfile();
  const nameInput  = document.getElementById("TeacherName");
  const emailInput = document.getElementById("TeacherEmail");
  if (nameInput) nameInput.value = profile.name;
  if (emailInput) emailInput.value = profile.email;

  // 2. Platform Info (Read-Only)
  const orgRes = await fetch(`${API}/teacher/organization`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  });
  if (orgRes.ok) {
      const org = await orgRes.json();
      const pName = document.getElementById("platformName");
      const uploadBox = document.getElementById("uploadBox");
      
      if (pName) {
          pName.value = org.platform_name || org.org_name;
          pName.disabled = true; // Lock it
      }
      
      if (uploadBox) {
          uploadBox.innerHTML = org.logo 
            ? `<img src="http://127.0.0.1:8000/${org.logo}" style="max-height:80px;border-radius:8px;">`
            : `<span style="font-size:30px;">🎓</span>`;
          uploadBox.style.cursor = "default";
          uploadBox.innerHTML += `<p style="margin-top:10px; font-size:12px; color:#ef4444;">Contact admin to change branding.</p>`;
      }
  }

  // 3. Save Button
  document.getElementById("saveChangesBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveChangesBtn");
    btn.textContent = "Saving…";
    btn.disabled = true;

    const profileSaved = await saveTeacherProfile();

    btn.textContent = "Save Changes";
    btn.disabled = false;

    if (profileSaved) {
      showToast("Profile updated successfully!");
    }
  });
});
