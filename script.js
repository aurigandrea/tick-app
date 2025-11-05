// Consent App - Main JavaScript File
class ConsentApp {
    constructor() {
        this.currentUser = null;
        this.records = [];
        this.storageKey = 'consent_records_encrypted';
        this.init();
    }

    init() {
        // Start by showing auth section
        this.showAuthSection();
        
        // Initialize Netlify Identity
        if (window.netlifyIdentity) {
            window.netlifyIdentity.on('init', (user) => {
                if (user) {
                    this.handleUserLogin(user);
                } else {
                    this.showAuthSection();
                }
            });

            window.netlifyIdentity.on('login', (user) => {
                this.handleUserLogin(user);
                window.netlifyIdentity.close();
            });

            window.netlifyIdentity.on('logout', () => {
                this.handleUserLogout();
            });

            // Initialize the widget
            window.netlifyIdentity.init();
        } else {
            // No Netlify Identity available - show auth section
            this.showAuthSection();
        }

        this.setupEventListeners();
        // Only load records if user is logged in
        if (this.currentUser) {
            this.loadRecords();
        }
    }

    setupEventListeners() {
        // Tab switching - only if elements exist
        const recordTab = document.getElementById('record-tab');
        const viewTab = document.getElementById('view-tab');
        const consentForm = document.getElementById('consent-form');
        const logoutBtn = document.getElementById('logout-btn');
        const searchFilter = document.getElementById('search-filter');
        const consentDate = document.getElementById('consent-date');

        if (recordTab) {
            recordTab.addEventListener('click', () => {
                this.switchTab('record');
            });
        }

        if (viewTab) {
            viewTab.addEventListener('click', () => {
                this.switchTab('view');
                this.renderRecords();
            });
        }

        // Form submission
        if (consentForm) {
            consentForm.addEventListener('submit', (e) => {
                this.handleConsentSubmission(e);
            });
        }

        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (window.netlifyIdentity) {
                    window.netlifyIdentity.logout();
                }
            });
        }

        // Search filter
        if (searchFilter) {
            searchFilter.addEventListener('input', (e) => {
                this.filterRecords(e.target.value);
            });
        }

        // Set today's date as default
        if (consentDate) {
            consentDate.valueAsDate = new Date();
        }
    }

    handleUserLogin(user) {
        this.currentUser = user;
        document.getElementById('user-email').textContent = user.email;
        this.showAppSection();
        this.loadRecords();
    }

    handleUserLogout() {
        this.currentUser = null;
        this.records = [];
        this.showAuthSection();
    }

    showAuthSection() {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
    }

    showAppSection() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to selected tab and content
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.getElementById(`${tabName}-section`).classList.add('active');
    }

    async handleConsentSubmission(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            this.showMessage('You must be logged in to record consent.', 'error');
            return;
        }

        const form = e.target;
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;

        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Recording...';

            const formData = new FormData(form);
            const consentRecord = {
                id: this.generateId(),
                username: formData.get('username'),
                activity: formData.get('activity'),
                date: formData.get('consent-date'),
                timestamp: new Date().toISOString(),
                userEmail: this.currentUser.email,
                ipAddress: await this.getClientIP(),
                userAgent: navigator.userAgent
            };

            // Validate required fields
            if (!consentRecord.username || !consentRecord.activity || !consentRecord.date) {
                throw new Error('Please fill in all required fields.');
            }

            // Add to records
            this.records.push(consentRecord);
            
            // Save to encrypted storage
            this.saveRecords();

            // Show success message
            this.showMessage('✅ Consent recorded successfully!', 'success');

            // Reset form
            form.reset();
            document.getElementById('consent-date').valueAsDate = new Date();

            // Switch to view tab to show the new record
            setTimeout(() => {
                this.switchTab('view');
                this.renderRecords();
            }, 1500);

        } catch (error) {
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'Unknown';
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Simple encryption for client-side storage (not suitable for highly sensitive data)
    encrypt(text) {
        if (!this.currentUser) return text;
        // Simple base64 encoding with user email as salt (basic obfuscation)
        const salt = btoa(this.currentUser.email).slice(0, 10);
        return btoa(salt + text);
    }

    decrypt(encrypted) {
        if (!this.currentUser) return encrypted;
        try {
            const salt = btoa(this.currentUser.email).slice(0, 10);
            const decoded = atob(encrypted);
            return decoded.slice(salt.length);
        } catch (error) {
            return encrypted;
        }
    }

    saveRecords() {
        if (!this.currentUser) return;
        
        // Save all records (shared between all users)
        const encrypted = this.encrypt(JSON.stringify(this.records));
        localStorage.setItem(this.storageKey, encrypted);
    }

    loadRecords() {
        if (!this.currentUser) {
            this.records = [];
            return;
        }

        try {
            const encrypted = localStorage.getItem(this.storageKey);
            
            if (encrypted) {
                const decrypted = this.decrypt(encrypted);
                this.records = JSON.parse(decrypted) || [];
            } else {
                this.records = [];
            }
        } catch (error) {
            console.warn('Could not load records:', error);
            this.records = [];
        }
    }

    renderRecords() {
        const recordsList = document.getElementById('records-list');
        
        if (this.records.length === 0) {
            recordsList.innerHTML = `
                <div class="no-records">
                    <h3>📋 No consent records found</h3>
                    <p>No consent records have been submitted yet. Start by recording the first consent using the "Record Consent" tab.</p>
                </div>
            `;
            return;
        }

        // Sort records by timestamp (newest first)
        const sortedRecords = [...this.records].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        recordsList.innerHTML = sortedRecords.map(record => `
            <div class="record-item" data-record-id="${record.id}">
                <div class="record-header">
                    <div class="record-name">👤 ${this.escapeHtml(record.username)}</div>
                    <div class="record-date">📅 ${this.formatDate(record.date)}</div>
                </div>
                <div class="record-activity">
                    <strong>Activity:</strong> ${this.escapeHtml(record.activity)}
                </div>
                <div class="record-meta">
                    <span class="record-status">✅ Consented</span>
                    <small style="color: #718096; margin-left: 10px;">
                        Recorded: ${this.formatTimestamp(record.timestamp)}
                    </small>
                    <small style="color: #718096; margin-left: 10px;">
                        By: ${this.escapeHtml(record.userEmail)}
                    </small>
                </div>
            </div>
        `).join('');
    }

    filterRecords(searchTerm) {
        const recordItems = document.querySelectorAll('.record-item');
        const term = searchTerm.toLowerCase();

        recordItems.forEach(item => {
            const name = item.querySelector('.record-name').textContent.toLowerCase();
            const activity = item.querySelector('.record-activity').textContent.toLowerCase();
            const recordMeta = item.querySelector('.record-meta').textContent.toLowerCase();
            
            if (name.includes(term) || activity.includes(term) || recordMeta.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(message, type = 'success') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.textContent = message;

        // Insert at the top of the active tab content
        const activeContent = document.querySelector('.tab-content.active');
        activeContent.insertBefore(messageDiv, activeContent.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ConsentApp();
});

// Handle Netlify Identity widget
if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', (user) => {
        if (!user) {
            window.netlifyIdentity.on('open', () => {
                console.log('Netlify Identity widget opened');
            });
        }
    });
}