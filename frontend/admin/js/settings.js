const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadBranding();
    loadProfile();
    
    // Logo Preview Logic
    document.getElementById('logoFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('logoPreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
            }
            reader.readAsDataURL(file);
        }
    });
});

async function loadBranding() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/organization`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        
        document.getElementById("orgName").value = data.org_name;
        document.getElementById("platformName").value = data.platform_name;
        
        if (data.logo) {
            document.getElementById("logoPreview").innerHTML = `<img src="${data.logo}" style="width:100%;height:100%;object-fit:cover;">`;
        }
    } catch (err) {}
}

async function saveBranding() {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("org_name", document.getElementById("orgName").value);
    formData.append("platform_name", document.getElementById("platformName").value);
    
    const logoFile = document.getElementById("logoFile").files[0];
    if (logoFile) formData.append("logo", logoFile);

    try {
        const res = await fetch(`${API}/admin/organization`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            alert("Platform settings updated!");
            
            // Sync with sidebar and storage
            const user = JSON.parse(localStorage.getItem("user"));
            user.platform_name = data.org_name; // prompt says use org_name as branding
            if (data.logo) user.org_logo = data.logo;
            localStorage.setItem("user", JSON.stringify(user));
            
            location.reload(); // Refresh to update layout.js
        }
    } catch (err) { alert("Failed to save branding"); }
}

async function loadProfile() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/profile`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        document.getElementById("adminName").value = data.name;
        document.getElementById("adminEmail").value = data.email;
    } catch (err) {}
}

async function saveProfile() {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("name", document.getElementById("adminName").value);
    formData.append("email", document.getElementById("adminEmail").value);
    
    const curr = document.getElementById("currPass").value;
    const next = document.getElementById("newPass").value;
    
    if (curr && next) {
        formData.append("current_password", curr);
        formData.append("new_password", next);
    }

    const res = await fetch(`${API}/admin/profile`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });

    if (res.ok) {
        alert("Profile updated successfully");
        location.reload();
    } else {
        const err = await res.json();
        alert(err.detail || "Update failed");
    }
}
