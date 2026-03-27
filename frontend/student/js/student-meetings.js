const API_URL = "http://127.0.0.1:8000/api/v1";
const token = localStorage.getItem("token");

async function fetchStudentMeetings() {
  try {
    // 1. Fetch enrolled courses to know which meetings to show
    const coursesRes = await fetch(`${API_URL}/student/my-courses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const enrolledCourses = await coursesRes.json();
    const container = document.getElementById("meetingsList");
    
    if (enrolledCourses.length === 0) {
      container.innerHTML = '<div class="no-meetings">You are not enrolled in any courses yet.</div>';
      return;
    }

    container.innerHTML = "";
    let totalMeetings = 0;

    // 2. For each course, fetch its meetings
    for (const course of enrolledCourses) {
      const meetRes = await fetch(`${API_URL}/meetings/course/${course.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meetings = await meetRes.json();

      meetings.forEach(m => {
        totalMeetings++;
        const date = new Date(m.meeting_date).toLocaleString();
        container.innerHTML += `
          <div class="meeting-card">
            <span class="course-badge">${course.title}</span>
            <h3>${m.title}</h3>
            <div class="meeting-meta">📅 ${date}</div>
            <p style="margin-bottom:15px; font-size:0.9em; color:#475569;">${m.description || "No additional info."}</p>
            <a href="${m.meeting_link}" target="_blank" class="btn-join">Join Session</a>
          </div>
        `;
      });
    }

    if (totalMeetings === 0) {
      container.innerHTML = '<div class="no-meetings">No live meetings scheduled for your courses at the moment.</div>';
    }
  } catch (err) {
    console.error("Error fetching student meetings:", err);
    document.getElementById("meetingsList").innerHTML = '<div class="no-meetings">Error loading meetings. Please try again later.</div>';
  }
}

fetchStudentMeetings();
