const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Complete PulseCAD Multi-Tenant ER:LC Core State
let state = {
    settings: {
        serverName: 'Liberty County Roleplay - Official ER:LC',
        cadMode: 'Strict RP',
        dispatchAlertWebhook: ''
    },
    units: [
        { id: 1, name: '101 - Officer John', dept: 'LCSO', status: '10-8 Available', location: 'Main Highway / Postal 101', notes: 'Patrol Lead' },
        { id: 2, name: 'A-12 - Chief Sarah', dept: 'RCFR', status: '10-97 On Scene', location: 'Liberty County Bank / Postal 104', notes: 'Engine 1' },
        { id: 3, name: '901 - Trooper Alex', dept: 'TPS', status: '10-41 On Duty', location: 'Highway 10 / Postal 202', notes: 'Speed Enforcement' },
        { id: 4, name: 'T-01 - Tow Operator Mark', dept: 'DOT', status: '10-8 Available', location: 'Spawn / Postal 001', notes: 'Roadside Assistance' }
    ],
    calls: [
        { 
            id: 1, 
            type: '10-10', 
            priority: 'Code 3', 
            location: 'Liberty County Bank', 
            postal: '104', 
            description: 'Active bank robbery in progress, multiple suspects armed with firearms.', 
            status: 'Active', 
            units: ['A-12', '101'],
            narratives: [
                { time: '16:00:12', text: '911 call received from bank teller.' },
                { time: '16:01:00', text: 'Unit 101 and A-12 dispatched.' }
            ]
        }
    ],
    bolos: [
        { id: 1, type: 'Vehicle', title: 'Armed Robbery Suspect Vehicle', description: 'Blue Sedan, tinted windows, fleeing toward spawn', plate: 'ERLC-992' },
        { id: 2, type: 'Person', title: 'Wanted on Felony Warrants', description: 'Male, wearing black hoodie, hostile', plate: 'N/A' }
    ],
    citizens: [
        { id: 1, name: 'John Doe', dob: '1998-04-12', address: '124 Maple St', license: 'Valid', warrants: 'None', vehicles: ['Sedan (ERLC-992)'], weapons: ['Registered Pistol'] },
        { id: 2, name: 'Jane Smith', dob: '2001-09-22', address: '89 Oak Ave', license: 'Suspended', warrants: '1 Active Warrant (10-10)', vehicles: ['SUV (ERLC-441)'], weapons: ['None'] }
    ],
    records: [],
    courtCases: [
        { id: 1, defendant: 'Jane Smith', charge: 'Felony Evasion & Robbery', judge: 'Judge Miller', status: 'Pending Trial', sentence: 'None' }
    ],
    penalCode: [
        { code: '10-10 / PC-01', title: 'Grand Theft / Robbery', desc: 'Robbing a commercial store, bank, or gas station.' },
        { code: 'PC-02', title: 'Speeding / Reckless Driving', desc: 'Operating a vehicle in a manner that endangers others.' },
        { code: 'PC-03', title: 'Failure to Yield / Felony Evasion', desc: 'Fleeing from law enforcement lights and sirens.' },
        { code: 'PC-04', title: 'Assault on LEO', desc: 'Physical attack or shooting at emergency personnel.' },
        { code: 'PC-05', title: 'Obstruction of Justice', desc: 'Interfering with an active police investigation or traffic stop.' }
    ],
    panicButtonActive: false,
    panicUnit: null
};

io.on('connection', (socket) => {
    console.log('User connected to complete PulseCAD suite:', socket.id);
    socket.emit('init_state', state);

    // Unit Status & MDT Sync
    socket.on('update_status', (data) => {
        let unit = state.units.find(u => u.name === data.name);
        if (unit) {
            unit.status = data.status;
            if (data.location) unit.location = data.location;
            if (data.notes) unit.notes = data.notes;
            if (data.dept) unit.dept = data.dept;
        } else {
            state.units.push({
                id: Date.now(),
                name: data.name,
                dept: data.dept || 'LCSO',
                status: data.status || '10-8 Available',
                location: data.location || 'Main Highway',
                notes: data.notes || 'Unit'
            });
        }
        io.emit('state_update', state);
    });

    // Calls management
    socket.on('create_call', (callData) => {
        const newCall = {
            id: Date.now(),
            type: callData.type || '10-31',
            priority: callData.priority || 'Normal',
            location: callData.location,
            postal: callData.postal || '000',
            description: callData.description,
            status: 'Active',
            units: [],
            narratives: [{ time: new Date().toLocaleTimeString(), text: 'Call created by dispatch.' }]
        };
        state.calls.push(newCall);
        io.emit('state_update', state);
    });

    socket.on('attach_unit', ({ callId, unitName }) => {
        const call = state.calls.find(c => c.id === callId);
        if (call && !call.units.includes(unitName)) {
            call.units.push(unitName);
            call.narratives.push({ time: new Date().toLocaleTimeString(), text: `Unit ${unitName} attached to call.` });
            io.emit('state_update', state);
        }
    });

    socket.on('detach_unit', ({ callId, unitName }) => {
        const call = state.calls.find(c => c.id === callId);
        if (call) {
            call.units = call.units.filter(u => u !== unitName);
            call.narratives.push({ time: new Date().toLocaleTimeString(), text: `Unit ${unitName} detached from call.` });
            io.emit('state_update', state);
        }
    });

    socket.on('close_call', (callId) => {
        state.calls = state.calls.filter(c => c.id !== callId);
        io.emit('state_update', state);
    });

    // BOLOs
    socket.on('add_bolo', (boloData) => {
        state.bolos.push({ id: Date.now(), ...boloData });
        io.emit('state_update', state);
    });

    socket.on('delete_bolo', (boloId) => {
        state.bolos = state.bolos.filter(b => b.id !== boloId);
        io.emit('state_update', state);
    });

    // Panic Button
    socket.on('trigger_panic', (unitName) => {
        state.panicButtonActive = true;
        state.panicUnit = unitName;
        io.emit('state_update', state);
    });

    socket.on('clear_panic', () => {
        state.panicButtonActive = false;
        state.panicUnit = null;
        io.emit('state_update', state);
    });

    // Civilian Registration
    socket.on('add_civilian_record', (record) => {
        state.citizens.push({ id: Date.now(), ...record });
        io.emit('state_update', state);
    });

    // RMS Reports (Citations, Arrests, Warnings)
    socket.on('submit_rms_report', (report) => {
        state.records.unshift({ id: Date.now(), timestamp: new Date().toLocaleString(), ...report });
        io.emit('state_update', state);
    });

    // DOJ Court Cases
    socket.on('add_court_case', (courtCase) => {
        state.courtCases.push({ id: Date.now(), ...courtCase });
        io.emit('state_update', state);
    });

    socket.on('update_court_status', ({ caseId, status, sentence }) => {
        const c = state.courtCases.find(item => item.id === caseId);
        if (c) {
            c.status = status;
            c.sentence = sentence;
            io.emit('state_update', state);
        }
    });

    // Admin Settings
    socket.on('update_settings', (newSettings) => {
        state.settings = { ...state.settings, ...newSettings };
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Complete PulseCAD full suite running on port ${PORT}`);
});
