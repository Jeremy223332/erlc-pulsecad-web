const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store for the prototype
let state = {
    units: [
        { id: 1, name: '101 - John D.', dept: 'LCSO', status: '10-8 Available', location: 'Main Highway' },
        { id: 2, name: 'A-12 - Sarah M.', dept: 'RCFR', status: '10-97 On Scene', location: 'Liberty County Bank' }
    ],
    calls: [
        { id: 1, type: '10-10', location: 'Bank Blvd', description: 'Active robbery alarm at the Liberty County Bank', status: 'Active', units: ['A-12'] }
    ],
    bolos: [
        { id: 1, type: 'Vehicle', description: 'Blue Sedan, reckless driving, fleeing toward spawn', plate: 'ERLC-992' }
    ]
};

// WebSocket connection for live CAD sync
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send initial state
    socket.emit('init_state', state);

    // Unit status update
    socket.on('update_status', (data) => {
        const unit = state.units.find(u => u.id === data.unitId || u.name === data.name);
        if (unit) {
            unit.status = data.status;
            unit.location = data.location || unit.location;
            io.emit('state_update', state);
        }
    });

    // Create new active call
    socket.on('create_call', (callData) => {
        const newCall = {
            id: state.calls.length + 1,
            type: callData.type || '10-31',
            location: callData.location,
            description: callData.description,
            status: 'Active',
            units: []
        };
        state.calls.push(newCall);
        io.emit('state_update', state);
    });

    // Attach unit to call
    socket.on('attach_unit', ({ callId, unitName }) => {
        const call = state.calls.find(c => c.id === callId);
        if (call && !call.units.includes(unitName)) {
            call.units.push(unitName);
            io.emit('state_update', state);
        }
    });

    // Close call
    socket.on('close_call', (callId) => {
        state.calls = state.calls.filter(c => c.id !== callId);
        io.emit('state_update', state);
    });

    // Add BOLO
    socket.on('add_bolo', (boloData) => {
        state.bolos.push({ id: state.bolos.length + 1, ...boloData });
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`PulseCAD web server running on port ${PORT}`);
});
