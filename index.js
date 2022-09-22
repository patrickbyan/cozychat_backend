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

// Initialize DB on FREESQLHOSTING
const {
    PORT,
    env,
    DB_HOST,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_PORT,
    LOCAL_DB_HOST,
    LOCAL_DB_NAME,
    LOCAL_DB_USER,
    LOCAL_DB_PASSWORD,
    LOCAL_DB_PORT
} = process.env

const PORT = process.env.PORT || 5000

const sqlProps = {
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    PORT: DB_PORT
}

if (env === 'production') {
    sqlProps.host = LOCAL_DB_HOST
    sqlProps.database = LOCAL_DB_NAME
    sqlProps.user = LOCAL_DB_USER
    sqlProps.password = LOCAL_DB_PASSWORD
    sqlProps.port = LOCAL_DB_PORT
}

const db = mysql.createConnection(sqlProps)


app.get('/', (req, res) => {
    res.send('Welcome to Live Chat System API')
})


let userConnected = []

io.on('connection', (socket) => {
    try {
        if (!socket.id) throw { message: 'Cannot Connect to Server' }

        console.log('User Connect With Id ' + socket.id)

        socket.on('user-join', ({ name, room }) => {
            let userInRoom = userConnected.filter((value) => value.room === room)

            socket.emit('total-user', userInRoom.length)

            if (userInRoom.length >= 5) {
                return 
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
                    if (err) throw err

                    socket.emit('get-chat-history', { error: false, result: result })
                    io.in(room).emit('user-online', userInRoom)
                    socket.to(room).emit('send-message-from-server', { from: 'Bot', message: name + ' Joined' })

                } catch (error) {
                    socket.emit('error-message', { error: true, message: 'Could Not Connect to Server', detail: error.sqlMessage })
                }
            })
        })

        socket.on("send-chat", (data) => {
            let index = null

            userConnected.forEach((value, idx) => {
                if (value.id === socket.id) {
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
                    if (err) throw err

                    socket.to(room).emit('send-chat-back', { from: data.name, message: data.message })
                    socket.emit('send-chat-back', { from: data.name, message: data.message })
                } catch (error) {
                    socket.emit('error-message', { error: true, message: 'Could Not Connect to Server', detail: error.sqlMessage })
                }
            })
        });

        socket.on("typing-message", (data) => {
            let index = null

            userConnected.forEach((value, idx) => {
                if (value.id === socket.id) {
                    index = idx
                }
            })

            let room = userConnected[index].room

            socket.to(room).emit('typing-message-back', { from: data.name, message: data.message })
        })

        socket.on('disconnect', () => {
            console.log('USER DISCONNECT')

            let index = null

            userConnected.forEach((value, idx) => {
                if (value.id === socket.id) {
                    index = idx
                }
            })

            if (index !== null) {
                var name = userConnected[index].name
                var room = userConnected[index].room
                userConnected.splice(index, 1)
            }

            socket.to(room).emit('send-message-from-server', { from: 'Bot', message: name + ' Left' })
        })
    } catch (error) {
        res.status(500).send({
            error: true,
            message: error.message
        })
    }
})

httpApp.listen(PORT, () => {
    console.log('Server Running on Port ' + PORT)
})