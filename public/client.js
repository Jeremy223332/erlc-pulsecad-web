const socket = io();

let currentState = {
    units: [],
    calls: [],
    bolos: []
};

// Listen for state synchronization from server
socket.on('init_state', (serverState) => {
    currentState = serverState;
    renderAll();
});

socket.on('state_update', (serverState) => {
    currentState = serverState;
    renderAll();
});

function renderAll() {
    renderCalls();
    renderUnits();
    renderBolos();
}

function renderCalls() {
    const list = document.getElementById('calls-list');
    if (!list) return;

    if (currentState.calls.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No active dispatch calls.</p>`;
        return;
    }

    list.innerHTML = currentState.calls.map(call => `
        <div class="card">
            <div class="card-header">
                <span>[${call.type}] ${call.location}</span>
                <span style="color: #38bdf8;">${call.status}</span>
            </div>
            <p>${call.description}</p>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
                Assigned Units: ${call.units.length > 0 ? call.units.join(', ') : 'None'}
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn secondary" onclick="attachToCall(${call.id})">Attach Me</button>
                <button class="btn primary" onclick="closeCall(${call.id})">Clear Call</button>
            </div>
        </div>
    `).join('');
}

function renderUnits() {
    const list = document.getElementById('units-list');
    if (!list) return;

    list.innerHTML = currentState.units.map(unit => `
        <div class="card">
            <div class="card-header">
                <span>${unit.name}</span>
                <span style="color: #22c55e;">${unit.status}</span>
            </div>
            <p>Location: ${unit.location || 'Unknown'}</p>
            <small style="color: #64748b;">Dept: ${unit.dept}</small>
        </div>
    `).join('');
}

function renderBolos() {
    const list = document.getElementById('bolos-list');
    if (!list) return;

    if (currentState.bolos.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No active BOLOs recorded.</p>`;
        return;
    }

    list.innerHTML = currentState.bolos.map(bolo => `
        <div class="card">
            <div class="card-header">
                <span>${bolo.type}: ${bolo.plate || 'N/A'}</span>
            </div>
            <p>${bolo.description}</p>
        </div>
    `).join('');
}

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

// MDT Status Updates
function updateMyStatus() {
    const status = document.getElementById('my-status-select').value;
    const unitName = document.getElementById('unit-name-input').value;
    socket.emit('update_status', { name: unitName, status });
}

function submitStatusUpdate() {
    const unitName = document.getElementById('unit-name-input').value;
    const location = document.getElementById('unit-loc-input').value;
    const status = document.getElementById('my-status-select').value;
    socket.emit('update_status', { name: unitName, status, location });
    alert('Unit status and location updated!');
}

// Call management
function openNewCallModal() {
    document.getElementById('call-modal').style.display = 'flex';
}

function closeModals() {
    document.getElementById('call-modal').style.display = 'none';
}

function submitNewCall() {
    const type = document.getElementById('call-type').value;
    const location = document.getElementById('call-location').value;
    const description = document.getElementById('call-desc').value;

    if (!location || !description) {
        alert('Please fill in location and description.');
        return;
    }

    socket.emit('create_call', { type, location, description });
    closeModals();
}

function attachToCall(callId) {
    const unitName = document.getElementById('unit-name-input').value;
    socket.emit('attach_unit', { callId, unitName });
}

function closeCall(callId) {
    socket.emit('close_call', callId);
}

// Database query mock
function runDatabaseQuery() {
    const query = document.getElementById('db-search-input').value.toLowerCase();
    const resultsBox = document.getElementById('db-results');

    if (!query) {
        resultsBox.innerHTML = `<p class="placeholder-text">Please enter a search term.</p>`;
        return;
    }

    // Mock records database
    const mockDB = [
        { name: 'John Doe', dob: '1998-04-12', license: 'Valid', warrants: 'None', vehicle: 'Sedan (ERLC-992)' },
        { name: 'Jane Smith', dob: '2001-09-22', license: 'Suspended', warrants: '1 Active Warrant (10-10)', vehicle: 'SUV (ERLC-441)' }
    ];

    const match = mockDB.find(record => record.name.toLowerCase().includes(query) || record.vehicle.toLowerCase().includes(query));

    if (match) {
        resultsBox.innerHTML = `
            <h4 style="color: #38bdf8; margin-bottom: 8px;">Record Found: ${match.name}</h4>
            <p><strong>DOB:</strong> ${match.dob}</p>
            <p><strong>License Status:</strong> <span style="color: ${match.license === 'Valid' ? '#22c55e' : '#ef4444'};">${match.license}</span></p>
            <p><strong>Warrants:</strong> <span style="color: ${match.warrants === 'None' ? '#22c55e' : '#ef4444'};">${match.warrants}</span></p>
            <p><strong>Registered Vehicle:</strong> ${match.vehicle}</p>
        `;
    } else {
        resultsBox.innerHTML = `<p class="placeholder-text">No records found matching "${query}".</p>`;
    }
}
