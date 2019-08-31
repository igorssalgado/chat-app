const path = require('path');
const http = require('http');
const express = require('express');
const sockedio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app); //allows to create a web server for socket.io
const io = sockedio(server); // to configure socket.io with a given server

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => { // connection is going to fire whenever the socked.io server gets a new connection
    console.log('New WebSocket connection')

    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({
            id: socket.id,
            username,
            room
        })

        if (error) {
            return callback(error);
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', `Welcome ${user.username}!`));
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin',`${user.username} has joined`))

        io.to(user.room).emit('roomData', { 
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback();
    })

    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter();
        const user = getUser(socket.id);

        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed!')
        }

        if (msg.trim() === '') {
            return callback('Message cannot be empty!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, msg));
        callback();
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
        callback();
    })

    socket.on('disconnect', () => { // () this code is going to run whenever a user is disconnected
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin',`${user.username} has left!`))
            io.to(user.room).emit('roomData', { 
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server running on port ${port}!`);
})