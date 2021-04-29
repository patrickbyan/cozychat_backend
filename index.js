const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const http = require('http')
const socket = require('socket.io')

const app = express()
app.use(express.json())
app.use(cors())
const httpApp = http.createServer(app)
const io = socket(httpApp)

const PORT = process.env.PORT || 5000

const db = mysql.createConnection({
    host: 'sql6.freemysqlhosting.net',
    database: 'sql6409077',
    user: 'sql6409077', 
    password: '35H1hqcj4F',
    port: 3306
})

app.get('/', (req, res) => {
    res.send('Welcome to Live Chat System API')
})

let userConnected = []

io.on('connection', (socket) => {
    console.log('User Connect With Id ' + socket.id)

    socket.on('user-join', ({name, room}) => {
        let userInRoom = userConnected.filter((value) => value.room === room)

        if(userInRoom.length >= 5){
            return socket.emit('total-user', userInRoom.length)
        }else{
            socket.emit('total-user', userInRoom.length)
        }
        
        userConnected.push({
            id: socket.id,
            name: name,
            room: room
        })

        userInRoom = userConnected.filter((value) => value.room === room)
        socket.join(room)

        db.query('SELECT * FROM chat_history WHERE room = ?', room, (err, result) => {
            try {
                if(err) throw err

                socket.emit('get-chat-history', result)
                io.in(room).emit('user-online', userInRoom)
                socket.to(room).emit('send-message-from-server', {from: 'Bot', message: name + ' Joined'})
                
            } catch (error) {
                console.log(error)
            }
        })
    })
    
    socket.on("send-chat", (data) => {
        let index = null

        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        let room = userConnected[index].room

        let dataToInsert = {
            socket_id: socket.id,
            name: data.name,
            room: room,
            message: data.message
        }

        db.query('INSERT INTO chat_history SET ?', dataToInsert, (err, result) => {
            try {
                if(err) throw err

                socket.to(room).emit('send-chat-back', {from: data.name, message: data.message})
                socket.emit('send-chat-back', {from: data.name, message: data.message})
            } catch (error) {
                console.log(error)
            }
        })
        

        
    });

    socket.on("typing-message", (data) => {
        let index = null

        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        let room = userConnected[index].room

        socket.to(room).emit('typing-message-back', {from: data.name, message: data.message})
    })

    socket.on('disconnect', () => {
        console.log('USER DISCONNECT')

        let index = null

        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        if(index !== null){
            var name = userConnected[index].name
            var room = userConnected[index].room
            userConnected.splice(index, 1)
        }

        socket.to(room).emit('send-message-from-server', {from: 'Bot', message: name + ' Left'})
    })
})

httpApp.listen(PORT, () => {
    console.log('Server Running on Port ' + PORT)
})