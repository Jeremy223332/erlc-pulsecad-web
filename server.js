const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Full PulseCAD state store for ER:LC
let state = {
    units: [
        { id: 1, name: '101 - Officer John', dept: 'LCSO', status: '10-8 Available', location: 'Main Highway', notes: 'Patrol Lead' },
        { id: 2, name: 'A-12 - Chief Sarah', dept: 'RCFR', status: '10-97 On Scene', location: 'Liberty County Bank', notes: 'Engine 1' },
        { id: 3, name: '901 - Trooper Alex', dept: 'TPS', status: '10-41 On Duty', location: 'Highway 10', notes: 'Speed Enforcement' }
    ],
    calls: [
        { id: 1, type: '10-10', priority: 'High', location: 'Liberty County Bank', postal: '104', description: 'Active bank robbery in progress, multiple suspects', status: 'Active', units: ['A-12', '101'] }
    ],
    bolos: [
        { id: 1, type: 'Vehicle', title: 'Armed Robbery Suspect Vehicle', description: 'Blue Sedan, tinted windows, fleeing toward spawn', plate: 'ERLC-992' },
        { id: 2, type: 'Person', title: 'Wanted on Felony Warrants', description: 'Male, wearing black hoodie, hostile', plate: 'N/A' }
    ],
    citizens: [
        { name: 'John Doe', dob: '1998-04-12', address: '124 Maple St', license: 'Valid', warrants: 'None', vehicles: ['Sedan (ERLC-992)'], weapons: ['Registered Pistol'] },
        { name: 'Jane Smith', dob: '2001-09-22', address: '89 Oak Ave', license: 'Suspended', warrants: '1 Active Warrant (10-10)', vehicles: ['SUV (ERLC-441)'], weapons: ['None'] },
        { name: 'Alex Miller', dob: '1995-11-04', address: '502 Pine Rd', license: 'Valid', warrants: 'None', vehicles: ['Truck (ERLC-773)'], weapons: ['None'] }
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
    console.log('User connected to PulseCAD core:', socket.id);

    // Send full state on connect
    socket.emit('init_state', state);

    // Update Unit Status & Location
    socket.on('update_status', (data) => {
        const unit = state.units.find(u => u.name === data.name || u.id === data.unitId);
        if (unit) {
            unit.status = data.status;
            if (data.location) unit.location = data.location;
            if (data.notes) unit.notes = data.notes;
            io.emit('state_update', state);
        }
    });

    // Create 911 Call
    socket.on('create_call', (callData) => {
        const newCall = {
            id: Date.now(),
            type: callData.type || '10-31',
            priority: callData.priority || 'Normal',
            location: callData.location,
            postal: callData.postal || '000',
            description: callData.description,
            status: 'Active',
            units: []
        };
        state.calls.push(newCall);
        io.emit('state_update', state);
    });

    // Attach / Detach Unit to Call
    socket.on('attach_unit', ({ callId, unitName }) => {
        const call = state.calls.find(c => c.id === callId);
        if (call && !call.units.includes(unitName)) {
            call.units.push(unitName);
            io.emit('state_update', state);
        }
    });

    socket.on('detach_unit', ({ callId, unitName }) => {
        const call = state.calls.find(c => c.id === callId);
        if (call) {
            call.units = call.units.filter(u => u !== unitName);
            io.emit('state_update', state);
        }
    });

    // Close Call
    socket.on('close_call', (callId) => {
        state.calls = state.calls.filter(c => c.id !== callId);
        io.emit('state_update', state);
    });

    // BOLOs
    socket.on('add_bolo', (boloData) => {
        state.bolos.push({
            id: Date.now(),
            type: boloData.type,
            title: boloData.title,
            description: boloData.description,
            plate: boloData.plate || 'N/A'
        });
        io.emit('state_update', state);
    });

    socket.on('delete_bolo', (boloId) => {
        state.bolos = state.bolos.filter(b => b.id !== boloId);
        io.emit('state_update', state);
    });

    // Panic Button Trigger
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

    // Create / Update Citizen DB
    socket.on('add_civilian_record', (record) => {
        state.citizens.push(record);
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`PulseCAD full suite running on port ${PORT}`);
});
