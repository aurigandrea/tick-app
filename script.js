// Simple Consent App with Netlify Identity
class ConsentApp {
    constructor() {
        this.currentUser = null;
        this.records = [];
        this.storageKey = 'consent_records_shared';
        
        // EmailJS configuration
        this.emailJSConfig = {
            publicKey: '4-OUV3n4Z6mgZIkRQ',
            serviceId: 'service_14hq5fh',
            templateId: 'template_yi3fbnr'
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
        } else {
            console.error('Netlify Identity widget not found');
            setTimeout(() => this.initNetlifyIdentity(), 1000);
        }
    }

    loginUser(user) {
        this.currentUser = user;
        this.showMainApp();
        this.setupEventListeners();
        this.loadRecords();
        this.renderReceivedRequests();
        
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
            recordTab.addEventListener('click', () => {
                this.switchTab('record');
                this.renderReceivedRequests();
            });
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

        // Setup dynamic event listeners
        this.setupDynamicEventListeners();

        // Set today's date
        const consentDate = document.getElementById('consent-date');
        if (consentDate) {
            consentDate.valueAsDate = new Date();
        }
    }

    setupDynamicEventListeners() {
        // Event delegation for dynamic buttons
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('accept-btn') && target.dataset.requestId) {
                this.acceptRequest(target.dataset.requestId);
                return;
            }
            
            if (target.classList.contains('cancel-btn') && target.dataset.requestId) {
                this.cancelRequest(target.dataset.requestId);
                return;
            }
            
            if (target.classList.contains('respond-btn') && target.dataset.requestId) {
                const response = target.dataset.response;
                this.respondToRequest(target.dataset.requestId, response);
                return;
            }
            
            if (target.classList.contains('decline-btn') && target.dataset.requestId) {
                this.respondToRequest(target.dataset.requestId, 'decline');
                return;
            }
            
            if (target.classList.contains('withdraw-btn') && target.dataset.recordId) {
                this.withdrawConsent(target.dataset.recordId);
                return;
            }
        });
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
            const requestReference = formData.get('request-reference');
            
            const consentRecord = {
                id: this.generateId(),
                username: formData.get('username'),
                activity: formData.get('activity'),
                date: formData.get('consent-date'),
                timestamp: new Date().toISOString(),
                userEmail: this.currentUser.email,
                ipAddress: await this.getClientIP(),
                requestReference: requestReference && requestReference !== 'other' ? requestReference : null
            };

            if (!consentRecord.username || !consentRecord.activity || !consentRecord.date) {
                throw new Error('Please fill in all required fields.');
            }

            this.records.push(consentRecord);
            this.saveRecords();

            // If this was in response to a specific request, mark it as completed
            if (requestReference && requestReference !== 'other') {
                this.markRequestAsCompleted(requestReference);
            }

            this.showMessage('✅ Consent recorded successfully!', 'success');
            form.reset();
            
            // Reset dropdown and repopulate it
            this.populateConsentRequestDropdown();
            const activityField = document.getElementById('activity');
            if (activityField) {
                activityField.readOnly = false;
                activityField.placeholder = 'Describe what you are giving consent for...';
            }
            
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
                <div class="record-actions">
                    <button data-record-id="${record.id}" class="withdraw-btn">
                        🗑️ Withdraw Consent
                    </button>
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

    // Populate consent request dropdown with pending requests for current user
    populateConsentRequestDropdown() {
        const dropdown = document.getElementById('request-reference');
        if (!dropdown || !this.currentUser) return;

        const allRequests = this.getConsentRequests();
        const userRequests = allRequests.filter(req => 
            req.recipientEmail === this.currentUser.email && req.status === 'pending'
        );

        // Clear existing options except the default ones
        dropdown.innerHTML = `
            <option value="">Select a consent request (or choose "Other" below)</option>
            <option value="other">Other - I'm giving general consent</option>
        `;

        // Add pending requests
        userRequests.forEach(request => {
            const option = document.createElement('option');
            option.value = request.id;
            option.textContent = `${request.requesterName}: ${request.activity.substring(0, 50)}${request.activity.length > 50 ? '...' : ''}`;
            dropdown.appendChild(option);
        });
    }

    // Handle request reference dropdown change
    handleRequestReferenceChange(e) {
        const selectedValue = e.target.value;
        const activityField = document.getElementById('activity');
        
        if (!selectedValue || selectedValue === 'other') {
            // Clear the activity field for manual entry
            activityField.value = '';
            activityField.readOnly = false;
            activityField.placeholder = 'Describe what you are giving consent for...';
            return;
        }

        // Find the selected request and populate the activity field
        const allRequests = this.getConsentRequests();
        const selectedRequest = allRequests.find(req => req.id === selectedValue);
        
        if (selectedRequest) {
            activityField.value = selectedRequest.activity;
            activityField.readOnly = true;
            activityField.placeholder = '';
        }
    }

    // Mark a consent request as completed
    markRequestAsCompleted(requestId) {
        const allRequests = this.getConsentRequests();
        const request = allRequests.find(req => req.id === requestId);
        
        if (request) {
            request.status = 'completed';
            request.completedAt = new Date().toISOString();
            this.saveConsentRequests(allRequests);
        }
    }

    // Email notification method
    async sendConsentRequestEmail(consentRequest) {
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS not loaded');
        }

        const templateParams = {
            to_email: consentRequest.recipientEmail,
            to_name: consentRequest.recipientName,
            from_name: consentRequest.requesterName,
            sender_name: consentRequest.requesterName,
            activity: consentRequest.activity,
            details: consentRequest.details || 'No additional details provided.',
            deadline: consentRequest.deadline || 'No deadline specified',
            app_link: 'https://recordmyconsent.netlify.app',
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
                recipientName: formData.get('request-recipient-name'),
                recipientEmail: formData.get('request-recipient-email'),
                activity: formData.get('request-activity'),
                details: formData.get('request-details'),
                deadline: formData.get('request-deadline'),
                requester: this.currentUser.email,
                requesterName: this.currentUser.user_metadata?.full_name || this.currentUser.email,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            if (!consentRequest.recipientName || !consentRequest.recipientEmail || !consentRequest.activity) {
                throw new Error('Please fill in all required fields.');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(consentRequest.recipientEmail)) {
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

    saveConsentRequests(requests) {
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
                        <div class="pending-recipient">👤 ${this.escapeHtml(request.recipientName || request.recipient)} (${this.escapeHtml(request.recipientEmail || request.recipient)})</div>
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
                        <button data-request-id="${request.id}" class="accept-btn">
                            ✅ Accept Request
                        </button>
                        <button data-request-id="${request.id}" class="cancel-btn">
                            ❌ Cancel Request
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

    async acceptRequest(requestId) {
        const requests = this.getConsentRequests();
        const request = requests.find(req => req.id === requestId);
        
        if (!request) {
            this.showMessage('Request not found.', 'error');
            return;
        }

        try {
            // Create consent record with automatic current date
            const consentRecord = {
                id: this.generateId(),
                username: this.currentUser.user_metadata?.full_name || this.currentUser.email,
                activity: request.activity,
                date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
                timestamp: new Date().toISOString(),
                userEmail: this.currentUser.email,
                ipAddress: await this.getClientIP(),
                requestReference: requestId
            };

            // Add to records
            this.records.push(consentRecord);
            this.saveRecords();

            // Mark request as completed
            this.markRequestAsCompleted(requestId);

            this.showMessage('✅ Request accepted and consent recorded!', 'success');
            this.renderPendingRequests();
        } catch (error) {
            this.showMessage(`❌ Error accepting request: ${error.message}`, 'error');
        }
    }

    // Render received consent requests for current user
    renderReceivedRequests() {
        const receivedList = document.getElementById('received-requests-list');
        if (!receivedList || !this.currentUser) return;

        const allRequests = this.getConsentRequests();
        const receivedRequests = allRequests.filter(req => 
            req.recipientEmail === this.currentUser.email && req.status === 'pending'
        );

        if (receivedRequests.length === 0) {
            receivedList.innerHTML = `
                <div class="no-pending">
                    <h3>📭 No pending requests</h3>
                    <p>You don't have any consent requests waiting for your response.</p>
                </div>
            `;
            return;
        }

        const sortedRequests = receivedRequests.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        receivedList.innerHTML = sortedRequests.map(request => {
            const isUrgent = request.deadline && new Date(request.deadline) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            return `
                <div class="pending-item ${isUrgent ? 'urgent' : ''}">
                    <div class="pending-header">
                        <div class="pending-recipient">📤 From: ${this.escapeHtml(request.requesterName)}</div>
                        <span class="pending-status">⏳ Awaiting Response</span>
                    </div>
                    <div class="pending-activity">
                        <strong>Consent Needed For:</strong> ${this.escapeHtml(request.activity)}
                    </div>
                    ${request.details ? `<div class="pending-details">
                        <strong>Details:</strong> ${this.escapeHtml(request.details)}
                    </div>` : ''}
                    ${request.deadline ? `<div class="pending-deadline">
                        📅 Deadline: ${this.formatDate(request.deadline)}
                    </div>` : ''}
                    <div class="pending-actions">
                        <button data-request-id="${request.id}" class="respond-btn">
                            ✅ Give Consent
                        </button>
                        <button data-request-id="${request.id}" class="decline-btn">
                            ❌ Decline
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Respond to a received consent request
    async respondToRequest(requestId) {
        const requests = this.getConsentRequests();
        const request = requests.find(req => req.id === requestId);
        
        if (!request) {
            this.showMessage('Request not found.', 'error');
            return;
        }

        // Create consent record with automatic current date
        const consentRecord = {
            id: this.generateId(),
            username: this.currentUser.user_metadata?.full_name || this.currentUser.email,
            activity: request.activity,
            date: new Date().toISOString().split('T')[0], // Current date
            timestamp: new Date().toISOString(),
            userEmail: this.currentUser.email,
            ipAddress: await this.getClientIP(),
            requestReference: requestId
        };

        // Add to records
        this.records.push(consentRecord);
        this.saveRecords();

        // Mark request as completed
        this.markRequestAsCompleted(requestId);

        this.showMessage('✅ Consent given successfully!', 'success');
        this.renderReceivedRequests();
    }

    // Decline a received consent request
    declineRequest(requestId) {
        const requests = this.getConsentRequests();
        const request = requests.find(req => req.id === requestId);
        
        if (!request) {
            this.showMessage('Request not found.', 'error');
            return;
        }

        // Mark as declined instead of completed
        request.status = 'declined';
        request.declinedAt = new Date().toISOString();
        this.saveConsentRequests(requests);

        this.showMessage('Request declined.', 'success');
        this.renderReceivedRequests();
    }

    // Withdraw consent - remove a consent record
    withdrawConsent(recordId) {
        if (!confirm('Are you sure you want to withdraw this consent? This action cannot be undone.')) {
            return;
        }

        // Find and remove the record
        const recordIndex = this.records.findIndex(record => record.id === recordId);
        
        if (recordIndex === -1) {
            this.showMessage('Consent record not found.', 'error');
            return;
        }

        // Remove the record
        this.records.splice(recordIndex, 1);
        this.saveRecords();

        this.showMessage('✅ Consent withdrawn successfully.', 'success');
        this.renderRecords();
    }
}

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConsentApp();
});