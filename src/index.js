const express = require('express')
const reservationRouter = require('./routers/reservationRouter.js')
const cors = require('cors')

// Setting up our express sever
const app = express()
app.use(express.json())
app.use(cors({origin: '*'}));
app.use(reservationRouter)

const port = process.env.PORT || 3000;


app.listen(port, () => {
    console.log('Server is up')
})





