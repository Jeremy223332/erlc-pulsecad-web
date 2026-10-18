const socket = io();

let currentState = {
    units: [],
    calls: [],
    bolos: [],
    citizens: [],
    penalCode: [],
    panicButtonActive: false,
    panicUnit: null
};

// Listen for state synchronization
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
    renderCitizens();
    renderPenalCodes();
    renderPanicState();
}

// Panic Banner Handling
function renderPanicState() {
    const banner = document.getElementById('panic-banner');
    const span = document.getElementById('panic-unit-name');
    if (currentState.panicButtonActive) {
        banner.classList.remove('hidden');
        span.textContent = currentState.panicUnit || 'UNKNOWN UNIT';
    } else {
        banner.classList.add('hidden');
    }
}

function triggerPanicButton() {
    const unitName = document.getElementById('global-unit-name').value;
    socket.emit('trigger_panic', unitName);
}

function clearPanic() {
    socket.emit('clear_panic');
}

// User Identity Sync
function updateUserIdentity() {
    const name = document.getElementById('global-unit-name').value;
    const dept = document.getElementById('global-dept-select').value;
    const status = document.getElementById('my-status-select').value;
    const location = document.getElementById('unit-loc-input') ? document.getElementById('unit-loc-input').value : 'Main Street';
    
    socket.emit('update_status', { name, dept, status, location });
}

// Render Calls
function renderCalls() {
    const list = document.getElementById('calls-list');
    const mdtList = document.getElementById('mdt-calls-ref');
    const countBadge = document.getElementById('active-calls-count');

    if (countBadge) countBadge.textContent = currentState.calls.length;

    if (!list) return;

    if (currentState.calls.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No active 911 calls dispatched.</p>`;
        if (mdtList) mdtList.innerHTML = `<p class="placeholder-text">No active calls.</p>`;
        return;
    }

    const htmlContent = currentState.calls.map(call => `
        <div class="card">
            <div class="card-header">
                <span>[${call.type}] ${call.location} (Postal: ${call.postal})</span>
                <span style="color: ${call.priority === 'High' ? '#ef4444' : '#38bdf8'};">${call.priority}</span>
            </div>
            <p>${call.description}</p>
            <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">
                Assigned Units: ${call.units.length > 0 ? call.units.join(', ') : 'None'}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn secondary" onclick="attachToCall(${call.id})">Attach Me</button>
                <button class="btn secondary" onclick="detachFromCall(${call.id})">Detach Me</button>
                <button class="btn primary" onclick="closeCall(${call.id})">Clear Call</button>
            </div>
        </div>
    `).join('');

    list.innerHTML = htmlContent;
    if (mdtList) mdtList.innerHTML = htmlContent;
}

// Render Units
function renderUnits() {
    const list = document.getElementById('units-list');
    const countBadge = document.getElementById('active-units-count');

    if (countBadge) countBadge.textContent = currentState.units.length;
    if (!list) return;

    list.innerHTML = currentState.units.map(unit => `
        <div class="card">
            <div class="card-header">
                <span>${unit.name}</span>
                <span style="color: #22c55e;">${unit.status}</span>
            </div>
            <p><strong>Location:</strong> ${unit.location || 'Unknown'} | <strong>Dept:</strong> ${unit.dept}</p>
            <small style="color: #64748b;">Notes: ${unit.notes || 'None'}</small>
        </div>
    `).join('');
}

// Render BOLOs
function renderBolos() {
    const list = document.getElementById('bolos-list');
    if (!list) return;

    if (currentState.bolos.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No active BOLO alerts in the database.</p>`;
        return;
    }

    list.innerHTML = currentState.bolos.map(bolo => `
        <div class="card">
            <div class="card-header">
                <span>[${bolo.type}] ${bolo.title}</span>
                <span style="color: #ef4444;">Plate: ${bolo.plate}</span>
            </div>
            <p>${bolo.description}</p>
            <button class="btn secondary" onclick="deleteBolo(${bolo.id})">Remove BOLO</button>
        </div>
    `).join('');
}

// Render Citizens
function renderCitizens() {
    const list = document.getElementById('civilian-list');
    if (!list) return;

    if (currentState.citizens.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No civilian personas created yet.</p>`;
        return;
    }

    list.innerHTML = currentState.citizens.map(civ => `
        <div class="card">
            <div class="card-header">
                <span>${civ.name} (DOB: ${civ.dob})</span>
                <span style="color: ${civ.license === 'Valid' ? '#22c55e' : '#ef4444'};">${civ.license}</span>
            </div>
            <p><strong>Address:</strong> ${civ.address}</p>
            <p><strong>Vehicles:</strong> ${civ.vehicles.join(', ')}</p>
            <p><strong>Warrants:</strong> <span style="color: ${civ.warrants === 'None' ? '#22c55e' : '#ef4444'};">${civ.warrants}</span></p>
        </div>
    `).join('');
}

// Render Penal Codes
function renderPenalCodes() {
    const list = document.getElementById('penal-code-list');
    if (!list) return;

    list.innerHTML = currentState.penalCode.map(pc => `
        <div class="card">
            <div class="card-header">
                <span>${pc.code}: ${pc.title}</span>
            </div>
            <p>${pc.desc}</p>
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

// Modals
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// Actions
function submitStatusChange() {
    const status = document.getElementById('my-status-select').value;
    const name = document.getElementById('global-unit-name').value;
    const dept = document.getElementById('global-dept-select').value;
    socket.emit('update_status', { name, dept, status });
}

function submitFullUnitUpdate() {
    const name = document.getElementById('global-unit-name').value;
    const dept = document.getElementById('global-dept-select').value;
    const status = document.getElementById('my-status-select').value;
    const location = document.getElementById('unit-loc-input').value;
    const notes = document.getElementById('unit-notes-input').value;

    socket.emit('update_status', { name, dept, status, location, notes });
    alert('MDT Status & Location successfully updated across dispatch!');
}

function submitNewCall() {
    const type = document.getElementById('call-type').value;
    const priority = document.getElementById('call-priority').value;
    const location = document.getElementById('call-location').value;
    const postal = document.getElementById('call-postal').value;
    const description = document.getElementById('call-desc').value;

    if (!location || !description) {
        alert('Please fill in the location and description.');
        return;
    }

    socket.emit('create_call', { type, priority, location, postal, description });
    closeModals();
}

function attachToCall(callId) {
    const unitName = document.getElementById('global-unit-name').value;
    socket.emit('attach_unit', { callId, unitName });
}

function detachFromCall(callId) {
    const unitName = document.getElementById('global-unit-name').value;
    socket.emit('detach_unit', { callId, unitName });
}

function closeCall(callId) {
    socket.emit('close_call', callId);
}

function submitNewBolo() {
    const type = document.getElementById('bolo-type').value;
    const title = document.getElementById('bolo-title').value;
    const plate = document.getElementById('bolo-plate').value;
    const description = document.getElementById('bolo-desc').value;

    if (!title || !description) {
        alert('Please fill out the BOLO title and description.');
        return;
    }

    socket.emit('add_bolo', { type, title, plate, description });
    closeModals();
}

function deleteBolo(boloId) {
    socket.emit('delete_bolo', boloId);
}

function submitCivilianPersona() {
    const name = document.getElementById('civ-name').value;
    const dob = document.getElementById('civ-dob').value;
    const address = document.getElementById('civ-address').value;
    const vehicle = document.getElementById('civ-vehicle').value;
    const weapons = document.getElementById('civ-weapons').value;

    if (!name || !address) {
        alert('Please provide a name and address.');
        return;
    }

    socket.emit('add_civilian_record', {
        name,
        dob,
        address,
        license: 'Valid',
        warrants: 'None',
        vehicles: [vehicle],
        weapons: [weapons]
    });
    closeModals();
    alert('Civilian persona successfully registered in DMV database!');
}

// Database Query Lookup
function runDatabaseQuery() {
    const query = document.getElementById('db-search-input').value.toLowerCase();
    const resultsBox = document.getElementById('db-results');

    if (!query) {
        resultsBox.innerHTML = `<p class="placeholder-text">Please enter a search query.</p>`;
        return;
    }

    const match = currentState.citizens.find(c => 
        c.name.toLowerCase().includes(query) || 
        c.vehicles.some(v => v.toLowerCase().includes(query)) ||
        c.dob.includes(query)
    );

    if (match) {
        resultsBox.innerHTML = `
            <h4 style="color: #38bdf8; margin-bottom: 12px; font-size: 16px;">Record File: ${match.name}</h4>
            <p><strong>DOB:</strong> ${match.dob}</p>
            <p><strong>Address:</strong> ${match.address}</p>
            <p><strong>Driver License:</strong> <span style="color: ${match.license === 'Valid' ? '#22c55e' : '#ef4444'};">${match.license}</span></p>
            <p><strong>Active Warrants:</strong> <span style="color: ${match.warrants === 'None' ? '#22c55e' : '#ef4444'};">${match.warrants}</span></p>
            <p><strong>Registered Vehicles:</strong> ${match.vehicles.join(', ')}</p>
            <p><strong>Registered Weapons:</strong> ${match.weapons.join(', ')}</p>
        `;
    } else {
        resultsBox.innerHTML = `<p class="placeholder-text">No records found matching "${query}".</p>`;
    }
}
