const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let state = {
    settings: {
        serverName: process.env.SERVER_NAME || 'Liberty County Roleplay - SunnoPulse Edition',
        cadMode: 'Hybrid Strict',
        erlcApiKey: process.env.ERLC_API_KEY || ''
    },
    units: [
        { id: 1, name: '101 - Officer John', dept: 'LCSO', status: '10-8 Available', location: 'Main Highway', x: 25, y: 30, notes: 'Patrol Lead' },
        { id: 2, name: 'A-12 - Chief Sarah', dept: 'RCFR', status: '10-97 On Scene', location: 'Bank Blvd', x: 45, y: 55, notes: 'Engine 1' }
    ],
    calls: [
        { id: 1, type: '10-10', priority: 'Code 3', location: 'Liberty County Bank', postal: '104', description: 'Active bank robbery in progress', status: 'Active', units: ['101'] }
    ],
    bolos: [
        { id: 1, type: 'Vehicle', title: 'Armed Robbery Suspect', description: 'Blue Sedan fleeing north', plate: 'ERLC-992' }
    ],
    citizens: [
        { id: 1, name: 'John Doe', dob: '1998-04-12', address: '124 Maple St', license: 'Valid', warrants: 'None', vehicles: ['Sedan (ERLC-992)'], weapons: ['Registered Pistol'] }
    ],
    penalCode: [
        { code: 'PC-01', title: 'Grand Theft / Robbery', desc: 'Robbing a commercial store, bank, or gas station.' },
        { code: 'PC-02', title: 'Speeding / Reckless Driving', desc: 'Operating a vehicle in a reckless manner.' },
        { code: 'PC-03', title: 'Felony Evasion', desc: 'Fleeing from law enforcement lights and sirens.' }
    ],
    panicButtonActive: false,
    panicUnit: null,
    erlcLivePlayers: [],
    erlcLiveVehicles: [],
    apiConnected: false,
    apiError: null
};

// Polling ER:LC Official V2 API
async function pollErlcApi() {
    const apiKey = state.settings.erlcApiKey || process.env.ERLC_API_KEY;
    if (!apiKey) {
        state.apiConnected = false;
        return;
    }
    
    try {
        const headers = { 'server-key': apiKey };
        
        const res = await fetch('https://api.erlc.gg/v2/server?include=players,vehicles', { headers });
        
        if (res.ok) {
            const data = await res.json();
            state.apiConnected = true;
            state.apiError = null;

            if (data.players) {
                state.erlcLivePlayers = data.players;
                data.players.forEach(p => {
                    if (p.Callsign && p.Team) {
                        let existing = state.units.find(u => u.name.includes(p.Callsign) || u.name.includes(p.Player.split(':')[0]));
                        if (!existing) {
                            state.units.push({
                                id: p.Player,
                                name: `${p.Callsign} - ${p.Player.split(':')[0]}`,
                                dept: p.Team.includes('Sheriff') ? 'LCSO' : p.Team.includes('Police') ? 'RCPD' : p.Team.includes('Fire') ? 'RCFR' : 'CIV',
                                status: '10-8 Available',
                                location: 'Liberty County',
                                x: Math.floor(Math.random() * 60) + 20,
                                y: Math.floor(Math.random() * 60) + 20,
                                notes: `API Connected (${p.Permission})`
                            });
                        }
                    }
                });
            }

            if (data.vehicles) {
                state.erlcLiveVehicles = data.vehicles;
            }
        } else {
            state.apiConnected = false;
            state.apiError = `API Error: HTTP ${res.status} - Check if your Server Key is correct.`;
        }

        io.emit('state_update', state);
    } catch (err) {
        state.apiConnected = false;
        state.apiError = `Connection Error: ${err.message}`;
        io.emit('state_update', state);
    }
}

// Initial poll check if env var is present
pollErlcApi();
setInterval(pollErlcApi, 5000);

io.on('connection', (socket) => {
    console.log('Client connected to SunnoPulse CAD:', socket.id);
    socket.emit('init_state', state);

    socket.on('update_settings', (newSettings) => {
        state.settings = { ...state.settings, ...newSettings };
        pollErlcApi();
        io.emit('state_update', state);
    });

    socket.on('update_status', (data) => {
        let unit = state.units.find(u => u.name === data.name);
        if (unit) {
            unit.status = data.status;
            if (data.location) unit.location = data.location;
            if (data.dept) unit.dept = data.dept;
            if (data.x !== undefined) unit.x = data.x;
            if (data.y !== undefined) unit.y = data.y;
        } else {
            state.units.push({
                id: Date.now(),
                name: data.name,
                dept: data.dept || 'LCSO',
                status: data.status || '10-8 Available',
                location: data.location || 'Spawn',
                x: data.x || 50,
                y: data.y || 50,
                notes: 'Active Unit'
            });
        }
        io.emit('state_update', state);
    });

    socket.on('create_call', (callData) => {
        state.calls.push({ id: Date.now(), ...callData, status: 'Active', units: [] });
        io.emit('state_update', state);
    });

    socket.on('attach_unit', ({ callId, unitName }) => {
        const c = state.calls.find(item => item.id === callId);
        if (c && !c.units.includes(unitName)) {
            c.units.push(unitName);
            io.emit('state_update', state);
        }
    });

    socket.on('close_call', (callId) => {
        state.calls = state.calls.filter(c => c.id !== callId);
        io.emit('state_update', state);
    });

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

    socket.on('add_civilian_record', (record) => {
        state.citizens.push({ id: Date.now(), ...record });
        io.emit('state_update', state);
    });

    socket.on('add_bolo', (bolo) => {
        state.bolos.push({ id: Date.now(), ...bolo });
        io.emit('state_update', state);
    });

    socket.on('delete_bolo', (id) => {
        state.bolos = state.bolos.filter(b => b.id !== id);
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SunnoPulse Hybrid CAD running on port ${PORT}`);
});
