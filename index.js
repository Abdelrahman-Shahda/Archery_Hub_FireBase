const functions = require('firebase-functions');
const express = require('express')
const reservationRouter = require('./src/routers/reservationRouter.js')
const cors = require('cors')

// Setting up our express sever
const app = express()
app.use(cors({origin: 'https://archeryhub.web.app'}));
app.use(express.json())
app.use(reservationRouter)

app.get('/', (req, res) => {
    res.send('Gamed')
})

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.app = functions.https.onRequest(app);
