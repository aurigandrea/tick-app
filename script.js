// Simple Consent App with Netlify Identity
class ConsentApp {
    constructor() {
        this.currentUser = null;
        this.records = [];
        this.storageKey = 'consent_records_shared';
        this.init();
    }

    init() {
        // Always start with login screen
        this.showLoginScreen();
        
        // Wait for Netlify Identity to load
        this.initNetlifyIdentity();
    }

    initNetlifyIdentity() {
        if (window.netlifyIdentity) {
            // Check if user is already logged in
            const user = window.netlifyIdentity.currentUser();
            if (user) {
                this.loginUser(user);
                return;
            }

            // Set up event listeners
            window.netlifyIdentity.on('login', (user) => {
                this.loginUser(user);
                window.netlifyIdentity.close();
            });

            window.netlifyIdentity.on('logout', () => {
                this.logoutUser();
            });

            window.netlifyIdentity.init();
        } else {
            // Retry if Netlify Identity not loaded yet
            setTimeout(() => this.initNetlifyIdentity(), 100);
        }
    }

    loginUser(user) {
        console.log('loginUser called with:', user);
        this.currentUser = user;
        
        console.log('Calling showMainApp...');
        this.showMainApp();
        
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        
        console.log('Loading records...');
        this.loadRecords();
        
        // Update UI with user email
        const userEmailElement = document.getElementById('user-email');
        console.log('User email element found:', !!userEmailElement);
        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        }
        
        console.log('Login process complete');
    }

    logoutUser() {
        console.log('logoutUser called');
        this.currentUser = null;
        this.records = [];
        this.showLoginScreen();
        console.log('Logout complete, should show login screen');
    }

    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        
        if (loginScreen) loginScreen.style.display = 'block';
        if (mainApp) mainApp.style.display = 'none';
    }

    showMainApp() {
        console.log('showMainApp called');
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        
        console.log('Login screen element:', !!loginScreen);
        console.log('Main app element:', !!mainApp);
        
        if (loginScreen) {
            loginScreen.style.display = 'none';
            console.log('Login screen hidden');
        }
        if (mainApp) {
            mainApp.style.display = 'block';
            console.log('Main app shown');
        }
    }

    setupEventListeners() {
        // Tab switching
        const recordTab = document.getElementById('record-tab');
        const viewTab = document.getElementById('view-tab');
        
        if (recordTab) {
            recordTab.addEventListener('click', () => this.switchTab('record'));
        }
        
        if (viewTab) {
            viewTab.addEventListener('click', () => {
                this.switchTab('view');
                this.renderRecords();
            });
        }

        // Form submission
        const consentForm = document.getElementById('consent-form');
        if (consentForm) {
            consentForm.addEventListener('submit', (e) => this.handleConsentSubmission(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        console.log('Logout button found:', !!logoutBtn);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Logout button clicked');
                if (window.netlifyIdentity) {
                    console.log('Calling netlifyIdentity.logout()');
                    window.netlifyIdentity.logout();
                } else {
                    console.log('netlifyIdentity not available');
                }
            });
            console.log('Logout event listener added');
        }

        // Search filter
        const searchFilter = document.getElementById('search-filter');
        if (searchFilter) {
            searchFilter.addEventListener('input', (e) => this.filterRecords(e.target.value));
        }

        // Set today's date
        const consentDate = document.getElementById('consent-date');
        if (consentDate) {
            consentDate.valueAsDate = new Date();
        }
    }

    switchTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        const selectedContent = document.getElementById(`${tabName}-section`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');
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
            submitBtn.disabled = true;
            submitBtn.textContent = 'Recording...';

            const formData = new FormData(form);
            const consentRecord = {
                id: this.generateId(),
                username: formData.get('username'),
                activity: formData.get('activity'),
                date: formData.get('consent-date'),
                timestamp: new Date().toISOString(),
                userEmail: this.currentUser.email,
                ipAddress: await this.getClientIP()
            };

            if (!consentRecord.username || !consentRecord.activity || !consentRecord.date) {
                throw new Error('Please fill in all required fields.');
            }

            this.records.push(consentRecord);
            this.saveRecords();
            this.showMessage('✅ Consent recorded successfully!', 'success');
            form.reset();
            
            // Set date back to today
            const consentDate = document.getElementById('consent-date');
            if (consentDate) {
                consentDate.valueAsDate = new Date();
            }

            // Switch to view tab
            setTimeout(() => {
                this.switchTab('view');
                this.renderRecords();
            }, 1500);

        } catch (error) {
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
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

    encrypt(text) {
        if (!this.currentUser) return text;
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
        if (!recordsList) return;
        
        if (this.records.length === 0) {
            recordsList.innerHTML = `
                <div class="no-records">
                    <h3>📋 No consent records found</h3>
                    <p>No consent records have been submitted yet.</p>
                </div>
            `;
            return;
        }

        const sortedRecords = [...this.records].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        recordsList.innerHTML = sortedRecords.map(record => `
            <div class="record-item">
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
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'block' : 'none';
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
        const existingMessages = document.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.textContent = message;

        const activeContent = document.querySelector('.tab-content.active');
        if (activeContent) {
            activeContent.insertBefore(messageDiv, activeContent.firstChild);
        }

        setTimeout(() => messageDiv.remove(), 5000);
    }
}

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ConsentApp();
});