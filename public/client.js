const socket = io();

let currentState = {
    settings: { serverName: 'Liberty County Roleplay', cadMode: 'Hybrid', erlcApiKey: '' },
    units: [],
    calls: [],
    bolos: [],
    citizens: [],
    penalCode: [],
    panicButtonActive: false,
    panicUnit: null,
    erlcLivePlayers: [],
    erlcLiveVehicles: [],
    apiConnected: false,
    apiError: null
};

socket.on('init_state', (serverState) => {
    currentState = serverState;
    renderAll();
});

socket.on('state_update', (serverState) => {
    currentState = serverState;
    renderAll();
});

function renderAll() {
    renderSettings();
    renderCalls();
    renderUnits();
    renderBolos();
    renderCitizens();
    renderPenalCodes();
    renderPanicState();
    renderMap();
}

function renderSettings() {
    const brandSub = document.getElementById('server-brand-sub');
    if (brandSub && currentState.settings) {
        brandSub.textContent = currentState.settings.serverName;
        document.getElementById('admin-server-name').value = currentState.settings.serverName;
        if (currentState.settings.erlcApiKey) {
            document.getElementById('api-key-input').value = currentState.settings.erlcApiKey;
        }
    }

    const apiStatus = document.getElementById('api-status-text');
    const debugMsg = document.getElementById('api-debug-msg');

    if (currentState.apiConnected) {
        if (apiStatus) {
            apiStatus.textContent = `Connected (Live Players: ${currentState.erlcLivePlayers.length}, Vehicles: ${currentState.erlcLiveVehicles.length})`;
            apiStatus.style.color = '#22c55e';
        }
        if (debugMsg) {
            debugMsg.textContent = `Success! Connected to ER:LC V2 API. Tracking ${currentState.erlcLivePlayers.length} online players.`;
            debugMsg.style.color = '#22c55e';
        }
    } else {
        if (apiStatus) {
            apiStatus.textContent = currentState.apiError ? currentState.apiError : 'Not Connected';
            apiStatus.style.color = '#ef4444';
        }
        if (debugMsg && currentState.apiError) {
            debugMsg.textContent = currentState.apiError;
            debugMsg.style.color = '#ef4444';
        }
    }
}

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

function updateUserIdentity() {
    const name = document.getElementById('global-unit-name').value;
    const dept = document.getElementById('global-dept-select').value;
    const status = document.getElementById('my-status-select').value;
    const location = document.getElementById('unit-loc-input') ? document.getElementById('unit-loc-input').value : 'Main Highway';
    
    socket.emit('update_status', { name, dept, status, location });
}

function renderCalls() {
    const list = document.getElementById('calls-list');
    const countBadge = document.getElementById('active-calls-count');
    if (countBadge) countBadge.textContent = currentState.calls.length;
    if (!list) return;

    if (currentState.calls.length === 0) {
        list.innerHTML = `<p class="placeholder-text">No active calls.</p>`;
        return;
    }

    list.innerHTML = currentState.calls.map(call => `
        <div class="card">
            <div class="card-header">
                <span>[${call.type}] ${call.location}</span>
                <span style="color: #38bdf8;">${call.priority}</span>
            </div>
            <p>${call.description}</p>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button class="btn secondary" onclick="attachToCall(${call.id})">Attach Me</button>
                <button class="btn primary" onclick="closeCall(${call.id})">Clear Call</button>
            </div>
        </div>
    `).join('');
}

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
            <p><strong>Loc:</strong> ${unit.location} | <strong>Dept:</strong> ${unit.dept}</p>
            <small style="color: #64748b;">${unit.notes || ''}</small>
        </div>
    `).join('');
}

function renderMap() {
    const container = document.getElementById('map-markers-container');
    if (!container) return;

    let html = currentState.units.map(u => `
        <div class="map-marker" style="top: ${u.y || 50}%; left: ${u.x || 50}%;">
            🚓 ${u.name} (${u.status})
        </div>
    `).join('');

    container.innerHTML = html;
}

function pingMapLocation() {
    const name = document.getElementById('global-unit-name').value;
    const location = document.getElementById('unit-loc-input').value || 'Downtown';
    const x = Math.floor(Math.random() * 70) + 15;
    const y = Math.floor(Math.random() * 70) + 15;

    socket.emit('update_status', { name, location, x, y, status: '10-8 Available' });
    alert('GPS Coordinate pinned to live map!');
}

function renderBolos() {
    const list = document.getElementById('bolos-list');
    if (!list) return;
    list.innerHTML = currentState.bolos.map(b => `
        <div class="card">
            <div class="card-header"><span>[${b.type}] ${b.title}</span></div>
            <p>${b.description} (Plate: ${b.plate})</p>
            <button class="btn secondary" onclick="deleteBolo(${b.id})">Remove</button>
        </div>
    `).join('');
}

function renderCitizens() {
    const list = document.getElementById('civilian-list');
    if (!list) return;
    list.innerHTML = currentState.citizens.map(c => `
        <div class="card">
            <div class="card-header"><span>${c.name}</span></div>
            <p>DOB: ${c.dob} | Vehicles: ${c.vehicles.join(', ')}</p>
        </div>
    `).join('');
}

function renderPenalCodes() {
    const list = document.getElementById('penal-code-list');
    if (!list) return;
    list.innerHTML = currentState.penalCode.map(pc => `
        <div class="card">
            <div class="card-header"><span>${pc.code}: ${pc.title}</span></div>
            <p>${pc.desc}</p>
        </div>
    `).join('');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

function submitStatusChange() {
    const status = document.getElementById('my-status-select').value;
    const name = document.getElementById('global-unit-name').value;
    socket.emit('update_status', { name, status });
}

function submitFullUnitUpdate() {
    const name = document.getElementById('global-unit-name').value;
    const dept = document.getElementById('global-dept-select').value;
    const status = document.getElementById('my-status-select').value;
    const location = document.getElementById('unit-loc-input').value;
    socket.emit('update_status', { name, dept, status, location });
    alert('MDT Updated!');
}

function submitNewCall() {
    const type = document.getElementById('call-type').value;
    const location = document.getElementById('call-location').value;
    const description = document.getElementById('call-desc').value;
    socket.emit('create_call', { type, priority: 'Normal', location, description, postal: '000' });
    closeModals();
}

function attachToCall(callId) {
    const unitName = document.getElementById('global-unit-name').value;
    socket.emit('attach_unit', { callId, unitName });
}

function closeCall(callId) { socket.emit('close_call', callId); }

function submitCivilianPersona() {
    const name = document.getElementById('civ-name').value;
    const dob = document.getElementById('civ-dob').value;
    const address = document.getElementById('civ-address').value;
    const vehicle = document.getElementById('civ-vehicle').value;
    socket.emit('add_civilian_record', { name, dob, address, license: 'Valid', warrants: 'None', vehicles: [vehicle], weapons: [] });
    closeModals();
    alert('Civilian registered!');
}

function submitNewBolo() {
    const title = document.getElementById('bolo-title').value;
    const plate = document.getElementById('bolo-plate').value;
    const description = document.getElementById('bolo-desc').value;
    socket.emit('add_bolo', { type: 'Vehicle', title, plate, description });
    closeModals();
}

function deleteBolo(id) { socket.emit('delete_bolo', id); }

function saveApiKeySettings() {
    const erlcApiKey = document.getElementById('api-key-input').value;
    const serverName = document.getElementById('admin-server-name').value;
    socket.emit('update_settings', { erlcApiKey, serverName });
    alert('ER:LC API Key saved! Checking connection...');
}

function runDatabaseQuery() {
    const query = document.getElementById('db-search-input').value.toLowerCase();
    const resultsBox = document.getElementById('db-results');
    const match = currentState.citizens.find(c => c.name.toLowerCase().includes(query) || c.vehicles.some(v => v.toLowerCase().includes(query)));
    if (match) {
        resultsBox.innerHTML = `<h4>${match.name}</h4><p>DOB: ${match.dob}</p><p>Vehicles: ${match.vehicles.join(', ')}</p><p>Warrants: ${match.warrants}</p>`;
    } else {
        resultsBox.innerHTML = `<p class="placeholder-text">No record found.</p>`;
    }
}
