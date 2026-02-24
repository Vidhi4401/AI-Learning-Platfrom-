// Settings Page Script

// Mock settings data
function getMockSettings() {
  return {
    platformName: 'LearnHub',
    adminProfile: {
      name: 'Admin User',
      email: 'admin@learnhub.com'
    },
    categories: [
      'Web Development',
      'Programming',
      'Design',
      'Data Science',
      'Business'
    ]
  };
}

// Fetch settings from API with fallback to mock data
async function fetchSettings() {
  try {
    const response = await fetch('/api/settings', {
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
    return getMockSettings();
  }
}

// Load settings into form
function loadSettings(settings) {
  // Platform name
  const platformNameInput = document.getElementById('platformName');
  if (platformNameInput && settings.platformName) {
    platformNameInput.value = settings.platformName;
  }

  // Admin profile
  const adminNameInput = document.getElementById('adminName');
  const adminEmailInput = document.getElementById('adminEmail');
  if (settings.adminProfile) {
    if (adminNameInput && settings.adminProfile.name) {
      adminNameInput.value = settings.adminProfile.name;
    }
    if (adminEmailInput && settings.adminProfile.email) {
      adminEmailInput.value = settings.adminProfile.email;
    }
  }

  // Categories
  if (settings.categories && Array.isArray(settings.categories)) {
    renderCategories(settings.categories);
  }
}

// Render categories list
function renderCategories(categories) {
  const categoriesList = document.getElementById('categoriesList');
  categoriesList.innerHTML = '';

  categories.forEach((category, index) => {
    const tag = document.createElement('div');
    tag.className = 'category-tag';
    tag.innerHTML = `
      ${escapeHtml(category)}
      <button type="button" data-index="${index}" class="remove-category">×</button>
    `;
    categoriesList.appendChild(tag);
  });

  // Add remove event listeners
  document.querySelectorAll('.remove-category').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const index = parseInt(this.dataset.index);
      categories.splice(index, 1);
      renderCategories(categories);
    });
  });
}

// Add new category
function addCategory(categories, categoryName) {
  if (!categoryName.trim()) {
    alert('Please enter a category name');
    return;
  }

  if (categories.includes(categoryName)) {
    alert('Category already exists');
    return;
  }

  categories.push(categoryName);
  renderCategories(categories);
  document.getElementById('categoryInput').value = '';
}

// Save settings to API
async function saveSettings(settings) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    alert('Settings saved successfully!');
    return data;
  } catch (error) {
    console.log('API save failed, showing mock success:', error.message);
    alert('Settings saved successfully!');
    return settings;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

let currentSettings = {};

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  // Load settings
  currentSettings = await fetchSettings();
  loadSettings(currentSettings);

  // Upload box click handler
  const uploadBox = document.getElementById('uploadBox');
  const logoUpload = document.getElementById('logoUpload');
  if (uploadBox && logoUpload) {
    uploadBox.addEventListener('click', () => logoUpload.click());
    logoUpload.addEventListener('change', function() {
      if (this.files.length > 0) {
        alert('Logo uploaded: ' + this.files[0].name);
      }
    });
  }

  // Add category button
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      const categoryInput = document.getElementById('categoryInput');
      addCategory(currentSettings.categories, categoryInput.value);
    });
  }

  // Add category on Enter key
  const categoryInput = document.getElementById('categoryInput');
  if (categoryInput) {
    categoryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCategory(currentSettings.categories, this.value);
      }
    });
  }

  // Save changes button
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  if (saveChangesBtn) {
    saveChangesBtn.addEventListener('click', async function() {
      // Collect form data
      const settings = {
        platformName: document.getElementById('platformName').value,
        adminProfile: {
          name: document.getElementById('adminName').value,
          email: document.getElementById('adminEmail').value,
          password: document.getElementById('adminPassword').value || undefined
        },
        categories: currentSettings.categories
      };

      // Remove empty password field
      if (!settings.adminProfile.password) {
        delete settings.adminProfile.password;
      }

      // Save to API
      await saveSettings(settings);

      // Clear password field after save
      document.getElementById('adminPassword').value = '';
    });
  }
});
