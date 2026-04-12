const API = "http://127.0.0.1:8000/api/v1";
const token = localStorage.getItem("token");

document.addEventListener("DOMContentLoaded", loadCertificates);

async function loadCertificates() {
  const container = document.getElementById("certsContainer");
  if (!container) return;

  try {
    const res = await fetch(`${API}/student/certificates`, {
      headers: { Authorization: "Bearer " + token }
    });
    
    if (!res.ok) {
      container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">Failed to load certificates. Please try again.</div>';
      return;
    }

    const certs = await res.json();

    if (!certs.length) {
      container.innerHTML = `
        <div style="text-align:center; padding: 5rem 2rem; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1;">
          <div style="font-size: 48px; margin-bottom: 16px;">🎓</div>
          <h3 style="margin: 0; color: #1e293b;">No certificates yet</h3>
          <p style="color: #64748b; margin-top: 8px;">Complete courses and their requirements to earn certificates.</p>
        </div>`;
      return;
    }

    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' }) : "—";

    container.innerHTML = certs.map(c => {
      const isIssued = c.issued;
      const statusClass = isIssued ? "badge-success" : (c.status === "rejected" ? "badge-danger" : "badge-warning");
      const statusText = isIssued ? "✅ Issued" : (c.status === "rejected" ? "✕ Rejected" : "⏳ Pending");
      const statusBg = isIssued ? "#dcfce7" : (c.status === "rejected" ? "#fee2e2" : "#fef3c7");
      const statusColor = isIssued ? "#166534" : (c.status === "rejected" ? "#991b1b" : "#92400e");

      return `
        <div class="cert-card">
          <div class="cert-info">
            <h3>📄 ${c.course_title}</h3>
            <p>${isIssued ? `Earned on ${fmtDate(c.issued_at)}` : `Requested on ${fmtDate(c.request_date)}`}</p>
          </div>
          <div class="cert-actions">
            <span class="badge" style="background: ${statusBg}; color: ${statusColor};">${statusText}</span>
            ${isIssued ? `
              <button class="btn-view" onclick="viewCert(${c.id})">👁️ View</button>
              <button class="btn-download" onclick="downloadCert(${c.id}, '${c.course_title.replace(/'/g, "\\'")}')">
                ⬇️ Download PDF
              </button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Certificates load error:", err);
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">An error occurred while loading certificates.</div>';
  }
}

async function downloadCert(certId, courseTitle) {
  try {
    const res = await fetch(`${API}/student/certificates/${certId}/download`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) {
      alert("Certificate not available for download.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate_${courseTitle.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download error:", err);
    alert("Download failed. Please try again.");
  }
}

async function viewCert(certId) {
  try {
    const res = await fetch(`${API}/student/certificates/${certId}/download`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) {
      alert("Certificate not available.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error("View error:", err);
    alert("Could not open certificate.");
  }
}