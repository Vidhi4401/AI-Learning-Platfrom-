// Analytics Page Script

// Mock data for most popular courses
function getMockMostPopularCourses() {
  return {
    labels: ['React Fundamentals', 'Python Basics', 'UI/UX Design', 'Data Science', 'Web Development'],
    data: [580, 520, 480, 440, 380]
  };
}

// Mock data for completion rate by category
function getMockCompletionRate() {
  return {
    labels: ['Web Dev', 'Design', 'Data Science', 'Programming', 'Business'],
    data: [85, 78, 72, 80, 68]
  };
}

// Mock analytics stats
function getMockAnalyticsStats() {
  return {
    totalStudents: {
      value: 2847,
      change: '12% this month'
    },
    totalCourses: {
      value: 42,
      change: '3 new courses'
    },
    mostPopularCourses: getMockMostPopularCourses(),
    completionRate: getMockCompletionRate()
  };
}

// Fetch analytics data from API with fallback to mock data
async function fetchAnalyticsData() {
  try {
    const response = await fetch('/api/analytics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log('API not available, using mock data:', error.message);
    return getMockAnalyticsStats();
  }
}

// Update stats cards
function updateStats(data) {
  // Total Students
  const totalStudentsValue = document.getElementById('totalStudentsValue');
  const totalStudentsChange = document.getElementById('totalStudentsChange');
  if (totalStudentsValue && data.totalStudents) {
    totalStudentsValue.textContent = data.totalStudents.value.toLocaleString();
    totalStudentsChange.textContent = '↑ ' + data.totalStudents.change;
  }

  // Total Courses
  const totalCoursesValue = document.getElementById('totalCoursesValue');
  const totalCoursesChange = document.getElementById('totalCoursesChange');
  if (totalCoursesValue && data.totalCourses) {
    totalCoursesValue.textContent = data.totalCourses.value;
    totalCoursesChange.textContent = '↑ ' + data.totalCourses.change;
  }
}

// Initialize Most Popular Courses Chart
function initMostPopularChart(data) {
  const ctx = document.getElementById('mostPopularChart');
  if (!ctx) return;

  // Clear any existing chart
  if (window.mostPopularChartInstance) {
    window.mostPopularChartInstance.destroy();
  }

  const chartData = data.mostPopularCourses || getMockMostPopularCourses();

  window.mostPopularChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Enrollments',
        data: chartData.data,
        backgroundColor: '#a855f7',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 600,
          ticks: {
            color: '#64748b',
            font: {
              size: 12
            }
          },
          grid: {
            color: '#e5e7eb',
            drawBorder: false
          }
        },
        y: {
          ticks: {
            color: '#64748b',
            font: {
              size: 12
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Initialize Completion Rate Chart
function initCompletionRateChart(data) {
  const ctx = document.getElementById('completionRateChart');
  if (!ctx) return;

  // Clear any existing chart
  if (window.completionRateChartInstance) {
    window.completionRateChartInstance.destroy();
  }

  const chartData = data.completionRate || getMockCompletionRate();

  window.completionRateChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Completion Rate (%)',
        data: chartData.data,
        backgroundColor: '#10b981',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#64748b',
            font: {
              size: 12
            },
            callback: function(value) {
              return value + '%';
            }
          },
          grid: {
            color: '#e5e7eb',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#64748b',
            font: {
              size: 12
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  const analyticsData = await fetchAnalyticsData();

  // Update stats
  updateStats(analyticsData);

  // Initialize charts
  initMostPopularChart(analyticsData);
  initCompletionRateChart(analyticsData);
});
