async function fetchStudents() {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch("http://127.0.0.1:8000/api/v1/admin/students", {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch students");
    }

    const data = await response.json();

    console.log("Backend response:", data);

    // Handle different possible formats
    let studentsArray = [];

    if (Array.isArray(data)) {
      studentsArray = data;
    } else if (data.students) {
      studentsArray = data.students;
    } else if (data.data) {
      studentsArray = data.data;
    }

    return studentsArray.map(student => ({
      id: student.id,
      name: student.name,
      email: student.email,
      enrolledCourses: student.enrolled_courses ?? 0,
      progress: student.progress ?? 0,
      certificateStatus: student.certificate_status ?? "Pending"
    }));

  } catch (error) {
    console.error("Error loading students:", error);
    return [];
  }
}
