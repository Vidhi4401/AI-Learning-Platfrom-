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
   UPDATE SIDEBAR BRANDING (instant, no reload)
=========================*/
function updateSidebarBranding(name, logoUrl) {
  const brandText = document.getElementById("sidebarPlatformName");
  const brandIcon = document.querySelector(".sidebar-brand-icon");

  if (brandText && name) {
    brandText.textContent = name;
    document.title = `${name} — Admin`;
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
   UPDATE NAVBAR PROFILE (instant, no reload)
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
   FETCH ORG INFO
=========================*/
async function fetchOrgSettings() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API}/admin/organization`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch (err) {
    console.error("Org fetch error:", err);
    return null;
  }
}

/* =========================
   LOAD ORG INTO FORM
=========================*/
function loadOrgIntoForm(org) {
  if (!org) return;

  // Org name — read only
  const orgNameInput = document.getElementById("orgName");
  if (orgNameInput && org.org_name) orgNameInput.value = org.org_name;

  // Platform name — editable
  const platformInput = document.getElementById("platformName");
  if (platformInput) {
    platformInput.value = org.platform_name || org.org_name || "";
  }

  // Logo preview
  if (org.logo) {
    const uploadBox = document.getElementById("uploadBox");
    if (uploadBox) {
      uploadBox.innerHTML = `
        <img src="${org.logo}" alt="Logo"
             style="max-height:80px;border-radius:8px;margin-bottom:8px;object-fit:contain;">
        <p style="font-size:13px;color:#6b7280;">Click to change logo</p>
        <input type="file" id="logoUpload" accept="image/*" style="display:none;">
      `;
      uploadBox.addEventListener("click", () =>
        document.getElementById("logoUpload")?.click()
      );
    }
  }
}

/* =========================
   SAVE ORG SETTINGS
=========================*/
async function saveOrgSettings() {
  const token        = localStorage.getItem("token");
  const platformName = document.getElementById("platformName")?.value.trim();

  // ── USE GLOBAL VAR instead of input.files ──
  const logoFile = selectedLogoFile;

  if (!platformName) {
    showToast("Platform name cannot be empty", "error");
    return false;
  }

  const formData = new FormData();
  formData.append("platform_name", platformName);
  if (logoFile) {
    formData.append("logo", logoFile);
    console.log("Sending logo:", logoFile.name); // ← confirm file is attached
  } else {
    console.log("No logo file selected");        // ← if this shows, file is lost
  }

  try {
    const res = await fetch(`${API}/admin/organization`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) throw new Error("Save failed");
    const updated = await res.json();
    console.log("Response:", updated);           // ← confirm logo in response

    const logoUrl = updated.logo
      ? `http://127.0.0.1:8000/${updated.logo}`
      : null;
    updateSidebarBranding(updated.platform_name, logoUrl);

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.platform_name = updated.platform_name;
    if (updated.logo) user.org_logo = updated.logo;
    localStorage.setItem("user", JSON.stringify(user));

    // ── Reset after successful save ──
    selectedLogoFile = null;

    return true;

  } catch (err) {
    console.error("Org save error:", err);
    showToast("Failed to save platform settings", "error");
    return false;
  }
}
/* =========================
   FETCH ADMIN PROFILE
=========================*/
async function fetchAdminProfile() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API}/admin/profile`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch (err) {
    console.error("Profile fetch error:", err);
    // fallback to localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return { name: user.name, email: user.email };
  }
}

/* =========================
   LOAD PROFILE INTO FORM
=========================*/
function loadProfileIntoForm(profile) {
  if (!profile) return;
  const nameInput  = document.getElementById("adminName");
  const emailInput = document.getElementById("adminEmail");
  if (nameInput  && profile.name)  nameInput.value  = profile.name;
  if (emailInput && profile.email) emailInput.value = profile.email;
}

/* =========================
   SAVE ADMIN PROFILE
=========================*/
async function saveAdminProfile() {
  const token    = localStorage.getItem("token");
  const name     = document.getElementById("adminName")?.value.trim();
  const email    = document.getElementById("adminEmail")?.value.trim();
  const password = document.getElementById("adminPassword")?.value.trim();

  if (!name)  { showToast("Name cannot be empty", "error");  return false; }
  if (!email) { showToast("Email cannot be empty", "error"); return false; }

  const formData = new FormData();
  formData.append("name",  name);
  formData.append("email", email);
  if (password) formData.append("password", password);

  try {
    const res = await fetch(`${API}/admin/profile`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) throw new Error("Save failed");
    const updated = await res.json();

    // Update navbar instantly
    updateNavbarProfile(updated.name, updated.email);

    // Save to localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.name  = updated.name;
    user.email = updated.email;
    localStorage.setItem("user", JSON.stringify(user));

    // Clear password
    const pwdField = document.getElementById("adminPassword");
    if (pwdField) pwdField.value = "";

    return true;

  } catch (err) {
    console.error("Profile save error:", err);
    showToast("Failed to update profile", "error");
    return false;
  }
}

/* =========================
   CATEGORIES
=========================*/
let currentCategories = ['Web Development','Programming','Design','Data Science','Business'];

function renderCategories(categories) {
  const list = document.getElementById("categoriesList");
  if (!list) return;
  list.innerHTML = "";

  categories.forEach((category, index) => {
    const tag = document.createElement("div");
    tag.className = "category-tag";
    tag.innerHTML = `
      ${escapeHtml(category)}
      <button type="button" data-index="${index}" class="remove-category">×</button>
    `;
    list.appendChild(tag);
  });

  document.querySelectorAll(".remove-category").forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      const index = parseInt(this.dataset.index);
      currentCategories.splice(index, 1);
      renderCategories(currentCategories);
    });
  });
}

function addCategory(categoryName) {
  if (!categoryName.trim()) {
    showToast("Please enter a category name", "error");
    return;
  }
  if (currentCategories.includes(categoryName.trim())) {
    showToast("Category already exists", "error");
    return;
  }
  currentCategories.push(categoryName.trim());
  renderCategories(currentCategories);
  const input = document.getElementById("categoryInput");
  if (input) input.value = "";
}

function escapeHtml(text) {
  const map = { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" };
  return text.replace(/[&<>"']/g, m => map[m]);
}



function setupLogoUpload() {
  const uploadBox  = document.getElementById("uploadBox");
  const logoUpload = document.getElementById("logoUpload");

  if (!uploadBox || !logoUpload) return;

  uploadBox.addEventListener("click", () =>
    document.getElementById("logoUpload")?.click()
  );

  logoUpload.addEventListener("change", function() {
    if (this.files.length > 0) {
      selectedLogoFile = this.files[0];  // ← store file globally

      const reader = new FileReader();
      reader.onload = e => {
        uploadBox.innerHTML = `
          <img src="${e.target.result}" alt="Preview"
               style="max-height:80px;border-radius:8px;margin-bottom:8px;object-fit:contain;">
          <p style="font-size:13px;color:#6b7280;">${selectedLogoFile.name}</p>
          <input type="file" id="logoUpload" accept="image/*" style="display:none;">
        `;
        // re-attach click after innerHTML replaced
        uploadBox.addEventListener("click", () =>
          document.getElementById("logoUpload")?.click()
        );
        // re-attach change on new input
        document.getElementById("logoUpload")?.addEventListener("change", function() {
          if (this.files.length > 0) {
            selectedLogoFile = this.files[0];  // ← update if they pick again
          }
        });
      };
      reader.readAsDataURL(this.files[0]);
    }
  });
}
/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", async () => {

  // Apply branding instantly from localStorage before API call
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  if (storedUser.platform_name) {
    updateSidebarBranding(
      storedUser.platform_name,
      storedUser.org_logo ? `http://127.0.0.1:8000/${storedUser.org_logo}` : null
    );
  }
  if (storedUser.name) {
    updateNavbarProfile(storedUser.name, storedUser.email);
  }

  // Load org info from API
  const org = await fetchOrgSettings();
  loadOrgIntoForm(org);

  // Load admin profile from API
  const profile = await fetchAdminProfile();
  loadProfileIntoForm(profile);

  // Setup logo upload
  setupLogoUpload();

  // Render categories
  renderCategories(currentCategories);

  // Add category button
  document.getElementById("addCategoryBtn")?.addEventListener("click", () => {
    addCategory(document.getElementById("categoryInput")?.value || "");
  });

  // Add category on Enter
  document.getElementById("categoryInput")?.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategory(this.value);
    }
  });

  // Save all changes button
  document.getElementById("saveChangesBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveChangesBtn");
    btn.textContent = "Saving…";
    btn.disabled = true;

    const orgSaved     = await saveOrgSettings();
    const profileSaved = await saveAdminProfile();

    btn.textContent = "Save Changes";
    btn.disabled = false;

    if (orgSaved && profileSaved) {
      showToast("All settings saved successfully!");
    } else if (orgSaved) {
      showToast("Platform settings saved!");
    } else if (profileSaved) {
      showToast("Profile updated successfully!");
    }
  });
});