const API = "http://127.0.0.1:8000/api/v1";
const grid = document.getElementById("coursesGrid");
let allCourses = [];

function goToAdd() {
  window.location.href = "add-course.html";
}

/* ── ADD COURSE BUTTON ── */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("addCourseBtn");
  if (btn) btn.addEventListener("click", goToAdd);
  
  const searchInput = document.getElementById("courseSearch");
  if (searchInput) searchInput.addEventListener("input", renderCourses);
  
  loadCourses();
});

/* ── LOAD & RENDER ── */
async function loadCourses() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/teacher/courses`, {
    headers: { Authorization: "Bearer " + token }
  });

  allCourses = await res.json();
  renderCourses();
}

function renderCourses() {
  const searchTerm = document.getElementById("courseSearch")?.value.toLowerCase() || "";
  const statusFilter = document.getElementById("statusFilter")?.value || "all";
  
  grid.innerHTML = "";

  const filtered = allCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm) || 
                          (course.description && course.description.toLowerCase().includes(searchTerm));
    
    const isPublished = !!course.status;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "published" && isPublished) || 
                         (statusFilter === "draft" && !isPublished);
    
    return matchesSearch && matchesStatus;
  });

  if (!filtered || filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span>📚</span>
        <p>No courses match your filters.</p>
      </div>`;
    return;
  }

  filtered.forEach(course => {
    const imageUrl = getFileUrl(course.logo) || "https://via.placeholder.com/400x200";

    const isPublished = !!course.status;
    const difficulty  = course.difficulty || "General";

    const card = document.createElement("div");
    card.className = "course-card";
    card.setAttribute("onclick", `viewCourse(${course.id})`);

    card.innerHTML = `
      <div class="course-image">
        <img src="${imageUrl}" alt="${course.title}" loading="lazy" />
        <span class="difficulty-pill">${difficulty}</span>
      </div>

      <div class="course-content">
        <div class="course-title">${course.title}</div>
        <div class="course-description">${course.description || ""}</div>

        <div class="course-footer">
          <span class="badge ${isPublished ? "published" : "draft"}">
            ${isPublished ? "Published" : "Draft"}
          </span>

          <div class="actions" onclick="event.stopPropagation()">
            <button class="btn-ghost" title="View" onclick="viewCourse(${course.id})">👁️</button>
            <button class="btn-ghost" title="Edit" onclick="editCourse(${course.id})">✏️</button>
            <button class="btn-ghost" style="color:#ef4444;" title="Delete" onclick="deleteCourse(${course.id})">🗑️</button>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ── VIEW (new) ── */
function viewCourse(id) {
  window.location.href = `course-detail.html?id=${id}`;
}

/* ── DELETE (unchanged) ── */
async function deleteCourse(id) {
  const token = localStorage.getItem("token");

  await fetch(`${API}/teacher/courses/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  loadCourses();
}

/* ── EDIT (unchanged) ── */
function editCourse(id) {
  window.location.href = `add-course.html?id=${id}`;
}
