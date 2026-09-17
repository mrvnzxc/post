// DOM Elements
const ticketForm = document.getElementById('ticketForm');
const evidenceContainer = document.getElementById('evidenceContainer');
const addEvidenceBtn = document.getElementById('addEvidenceBtn');
const responseMessage = document.getElementById('responseMessage');

let evidenceCount = 0;

// Event Listeners
addEvidenceBtn.addEventListener('click', addEvidenceField);
ticketForm.addEventListener('submit', handleFormSubmit);

// Add Evidence Field
function addEvidenceField() {
    evidenceCount++;
    
    const evidenceItem = document.createElement('div');
    evidenceItem.className = 'evidence-item';
    evidenceItem.id = `evidence-${evidenceCount}`;
    
    evidenceItem.innerHTML = `
        <div class="evidence-header">
            <span class="evidence-number">Evidence #${evidenceCount}</span>
            <button type="button" class="btn-remove" onclick="removeEvidence(${evidenceCount})">Remove</button>
        </div>
        <div class="evidence-form-row">
            <div class="form-group">
                <label for="evidenceName${evidenceCount}">File Name</label>
                <input type="text" id="evidenceName${evidenceCount}" name="evidence_name_${evidenceCount}" placeholder="Screenshot 2026-09-16 140624.png" required>
            </div>
            <div class="form-group">
                <label for="evidenceSize${evidenceCount}">File Size (bytes)</label>
                <input type="number" id="evidenceSize${evidenceCount}" name="evidence_size_${evidenceCount}" placeholder="10115" min="0" required>
            </div>
        </div>
        <div class="evidence-form-row">
            <div class="form-group">
                <label for="evidenceFile${evidenceCount}">Upload File</label>
                <input type="file" id="evidenceFile${evidenceCount}" name="evidence_file_${evidenceCount}" required>
            </div>
            <div class="form-group">
                <label for="evidenceUrl${evidenceCount}">File URL</label>
                <input type="url" id="evidenceUrl${evidenceCount}" name="evidence_url_${evidenceCount}" placeholder="https://api.mobilis.brigada.net/api/public/tickets/evidence/..." required>
            </div>
        </div>
    `;
    
    evidenceContainer.appendChild(evidenceItem);
}

// Remove Evidence Field
function removeEvidence(id) {
    const evidenceItem = document.getElementById(`evidence-${id}`);
    if (evidenceItem) {
        evidenceItem.remove();
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = ticketForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    try {
        // Collect form data
        const formData = new FormData(ticketForm);
        
        // Build the request payload matching the API structure
        const payload = {
            project: {
                name: formData.get('project_name'),
                url: formData.get('project_url'),
                api_url: formData.get('api_url')
            },
            ticket: {
                ticket_no: formData.get('ticket_no'),
                type: formData.get('type'),
                platform: formData.get('platform'),
                module: formData.get('module'),
                submodule: formData.get('submodule'),
                date_detected: formData.get('date_detected'),
                current_state: formData.get('current_state'),
                desired_state: formData.get('desired_state'),
                purpose: formData.get('purpose'),
                status: formData.get('status'),
                remarks: formData.get('remarks') || null,
                page_url: formData.get('page_url'),
                reporter: {
                    name: formData.get('reporter_name'),
                    role: formData.get('reporter_role')
                },
                evidence: collectEvidenceData(formData)
            }
        };
        
        // Send POST request
        const response = await fetch('http://localhost:3000/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(
                `✓ Ticket created successfully! ID: ${result.ticket_id || 'N/A'}`,
                'success'
            );
            ticketForm.reset();
            evidenceContainer.innerHTML = '';
            evidenceCount = 0;
        } else {
            showMessage(
                `✗ Error: ${result.message || 'Failed to create ticket'}`,
                'error'
            );
        }
    } catch (error) {
        showMessage(
            `✗ Network Error: ${error.message}. Make sure the server is running at localhost:3000`,
            'error'
        );
        console.error('Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

// Collect Evidence Data
function collectEvidenceData(formData) {
    const evidence = [];
    const evidenceItems = document.querySelectorAll('.evidence-item');
    
    evidenceItems.forEach((item, index) => {
        const id = index + 1;
        const name = formData.get(`evidence_name_${id}`);
        const size = formData.get(`evidence_size_${id}`);
        const url = formData.get(`evidence_url_${id}`);
        
        if (name && size && url) {
            evidence.push({
                name: name,
                size: parseInt(size),
                uploaded_at: new Date().toISOString(),
                url: url
            });
        }
    });
    
    return evidence;
}

// Show Message
function showMessage(message, type = 'info') {
    responseMessage.className = `response-message ${type}`;
    responseMessage.textContent = message;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            responseMessage.className = 'response-message hidden';
        }, 5000);
    }
}

// Set today's date as default for date_detected
document.getElementById('dateDetected').valueAsDate = new Date();
