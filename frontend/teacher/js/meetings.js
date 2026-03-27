const API_URL = "http://127.0.0.1:8000/api/v1";
const token = localStorage.getItem("token");

if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "../auth.html";
}

async function fetchCourses() {
  try {
    const res = await fetch(`${API_URL}/teacher/courses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch courses");
    const courses = await res.json();
    const select = document.getElementById("meetingCourse");
    select.innerHTML = '<option value="">Select a course</option>';
    courses.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.title}</option>`;
    });
  } catch (err) {
    console.error("Error fetching courses:", err);
    alert("Error loading courses. Please refresh the page.");
  }
}

async function fetchMeetings() {
  try {
    const res = await fetch(`${API_URL}/meetings/teacher`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch meetings");
    const meetings = await res.json();
    const container = document.getElementById("meetingsList");
    container.innerHTML = "";

    if (meetings.length === 0) {
        container.innerHTML = "<p>No meetings scheduled yet.</p>";
        return;
    }

    // Get all courses to map ID to title
    const coursesRes = await fetch(`${API_URL}/teacher/courses`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const courses = await coursesRes.json();
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c.title);

    meetings.forEach(m => {
      const date = new Date(m.meeting_date).toLocaleString();
      container.innerHTML += `
        <div class="meeting-card">
          <h3>${m.title}</h3>
          <span class="course">${courseMap[m.course_id] || "Course #" + m.course_id}</span>
          <div class="date">📅 ${date}</div>
          <p>${m.description || "No description provided."}</p>
          <div class="meeting-actions">
            <a href="${m.meeting_link}" target="_blank" class="btn-join">Join Meeting</a>
            <button onclick="deleteMeeting(${m.id})" class="btn-delete">Delete</button>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error fetching meetings:", err);
  }
}

document.getElementById("meetingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const courseId = parseInt(document.getElementById("meetingCourse").value);
  const title = document.getElementById("meetingTitle").value;
  const meetingDate = document.getElementById("meetingDate").value;
  const meetingLink = document.getElementById("meetingLink").value;
  const description = document.getElementById("meetingDesc").value;

  if (!courseId) {
      alert("Please select a course.");
      return;
  }
  if (!meetingDate) {
      alert("Please select a date and time.");
      return;
  }

  const data = {
    title: title,
    course_id: courseId,
    meeting_date: meetingDate,
    meeting_link: meetingLink,
    description: description
  };

  try {
    const res = await fetch(`${API_URL}/meetings/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      alert("Meeting scheduled successfully!");
      document.getElementById("meetingForm").reset();
      fetchMeetings();
    } else {
      const err = await res.json();
      console.error("Backend Error:", err);
      let errorMsg = "Failed to schedule meeting";
      if (err.detail) {
          if (Array.isArray(err.detail)) {
              errorMsg = err.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n');
          } else {
              errorMsg = err.detail;
          }
      }
      alert("Error: " + errorMsg);
    }
  } catch (err) {
    console.error("Network Error:", err);
    alert("Network error. Please check if the backend is running.");
  }
});

window.deleteMeeting = async (id) => {
  if (!confirm("Are you sure you want to delete this meeting?")) return;
  try {
    const res = await fetch(`${API_URL}/meetings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      fetchMeetings();
    } else {
        const err = await res.json();
        alert("Delete failed: " + (err.detail || "Unknown error"));
    }
  } catch (err) {
    console.error("Error deleting meeting:", err);
    alert("Connection error.");
  }
};

fetchCourses();
fetchMeetings();
