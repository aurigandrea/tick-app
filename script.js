// Simple Consent App with Netlify Identity
class ConsentApp {
    constructor() {
        this.currentUser = null;
        this.records = [];
        this.storageKey = 'consent_records_shared';
        
        // EmailJS configuration
        this.emailJSConfig = {
            publicKey: '4-OUV3n4Z6mgZIkRQ',       // Your EmailJS public key
            serviceId: 'service_14hq5fh',         // Your EmailJS service ID
            templateId: 'template_yi3fbnr'        // Your EmailJS template ID
        };
        
        this.init();
    }

    init() {
        // Always start with login screen
        this.showLoginScreen();
        
        // Initialize EmailJS
        this.initEmailJS();
        
        // Wait for Netlify Identity to load
        this.initNetlifyIdentity();
    }

    initEmailJS() {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailJSConfig.publicKey);
        }
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
        this.currentUser = user;
        this.showMainApp();
        this.setupEventListeners();
        this.loadRecords();
        
        // Update UI with user email
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        }
    }

    logoutUser() {
        this.currentUser = null;
        this.records = [];
        this.showLoginScreen();
    }

    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        
        if (loginScreen) loginScreen.style.display = 'block';
        if (mainApp) mainApp.style.display = 'none';
    }

    showMainApp() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
    }

    setupEventListeners() {
        // Tab switching
        const recordTab = document.getElementById('record-tab');
        const requestTab = document.getElementById('request-tab');
        const viewTab = document.getElementById('view-tab');
        
        if (recordTab) {
            recordTab.addEventListener('click', () => this.switchTab('record'));
        }
        
        if (requestTab) {
            requestTab.addEventListener('click', () => {
                this.switchTab('request');
                this.renderPendingRequests();
            });
        }
        
        if (viewTab) {
            viewTab.addEventListener('click', () => {
                this.switchTab('view');
                this.renderRecords();
            });
        }

        // Form submissions
        const consentForm = document.getElementById('consent-form');
        if (consentForm) {
            consentForm.addEventListener('submit', (e) => this.handleConsentSubmission(e));
        }

        const requestForm = document.getElementById('request-form');
        if (requestForm) {
            requestForm.addEventListener('submit', (e) => this.handleRequestSubmission(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (window.netlifyIdentity) {
                    window.netlifyIdentity.logout();
                }
            });
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

    // Email notification method
    async sendConsentRequestEmail(consentRequest) {
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS not loaded');
        }

        const templateParams = {
            to_email: consentRequest.recipient,
            to_name: consentRequest.recipient,
            from_name: consentRequest.requesterName,
            from_email: consentRequest.requester,
            activity: consentRequest.activity,
            details: consentRequest.details || 'No additional details provided.',
            deadline: consentRequest.deadline || 'No deadline specified',
            app_link: 'https://tick-app.netlify.app',
            request_id: consentRequest.id
        };

        try {
            const response = await emailjs.send(
                this.emailJSConfig.serviceId,
                this.emailJSConfig.templateId,
                templateParams
            );
            return response;
        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    // New consent request functionality
    async handleRequestSubmission(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            this.showMessage('You must be logged in to send consent requests.', 'error');
            return;
        }

        const form = e.target;
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            const formData = new FormData(form);
            const consentRequest = {
                id: this.generateId(),
                recipient: formData.get('request-recipient'),
                activity: formData.get('request-activity'),
                details: formData.get('request-details'),
                deadline: formData.get('request-deadline'),
                requester: this.currentUser.email,
                requesterName: this.currentUser.user_metadata?.full_name || this.currentUser.email,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            if (!consentRequest.recipient || !consentRequest.activity) {
                throw new Error('Please fill in recipient and activity fields.');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(consentRequest.recipient)) {
                throw new Error('Please enter a valid email address for the recipient.');
            }

            // Save request to localStorage
            this.saveConsentRequest(consentRequest);
            
            // Send email notification
            submitBtn.textContent = 'Sending Email...';
            await this.sendConsentRequestEmail(consentRequest);
            
            this.showMessage('✅ Consent request created and email sent! The recipient will be notified to log in and respond.', 'success');
            form.reset();
            
            setTimeout(() => {
                this.renderPendingRequests();
            }, 1000);

        } catch (error) {
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    saveConsentRequest(request) {
        const requests = this.getConsentRequests();
        requests.push(request);
        localStorage.setItem('consent_requests', JSON.stringify(requests));
    }

    getConsentRequests() {
        try {
            const requests = localStorage.getItem('consent_requests');
            return requests ? JSON.parse(requests) : [];
        } catch (error) {
            return [];
        }
    }

    renderPendingRequests() {
        const pendingList = document.getElementById('pending-list');
        if (!pendingList) return;

        const allRequests = this.getConsentRequests();
        const userRequests = allRequests.filter(req => 
            req.requester === this.currentUser.email && req.status === 'pending'
        );

        if (userRequests.length === 0) {
            pendingList.innerHTML = `
                <div class="no-pending">
                    <h3>📭 No pending requests</h3>
                    <p>You haven't sent any consent requests yet.</p>
                </div>
            `;
            return;
        }

        const sortedRequests = userRequests.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        pendingList.innerHTML = sortedRequests.map(request => {
            const isUrgent = request.deadline && new Date(request.deadline) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            return `
                <div class="pending-item ${isUrgent ? 'urgent' : ''}">
                    <div class="pending-header">
                        <div class="pending-recipient">👤 ${this.escapeHtml(request.recipient)}</div>
                        <span class="pending-status">⏳ Pending</span>
                    </div>
                    <div class="pending-activity">
                        <strong>Activity:</strong> ${this.escapeHtml(request.activity)}
                    </div>
                    ${request.details ? `<div class="pending-details">
                        <strong>Details:</strong> ${this.escapeHtml(request.details)}
                    </div>` : ''}
                    ${request.deadline ? `<div class="pending-deadline">
                        📅 Deadline: ${this.formatDate(request.deadline)}
                    </div>` : ''}
                    <div class="pending-actions">
                        <button onclick="app.cancelRequest('${request.id}')" class="cancel-btn">
                            Cancel Request
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    cancelRequest(requestId) {
        const requests = this.getConsentRequests();
        const updatedRequests = requests.filter(req => req.id !== requestId);
        localStorage.setItem('consent_requests', JSON.stringify(updatedRequests));
        this.renderPendingRequests();
        this.showMessage('Request cancelled successfully.', 'success');
    }
}

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConsentApp();
});