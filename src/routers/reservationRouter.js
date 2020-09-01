const express = require('express')
const router = express.Router()
const firestore = require('../firebase/firebase.js')

//Add new TimeSlot
router.post('/timeslots', firestore.auth,async (req, res) => {
    try{
        await firestore.addTimeSlot(req.body.days, req.body.location)
        res.send()
    }catch(e) {
        res.status(400).send(e.message)
    }
})

//Add reservation
router.post('/reservation/:location' , async (req, res) => {
    try{
        await firestore.addReservation(req.body, req.params.location)
        res.send()
    }catch(e){
        res.status(404).send({
            message:e.message
        })
    }
})

//Get Busy reservations
router.get('/reservations/:location' , async(req, res) => {

    try{
        
        const ignoreDaysTimeSlot = await firestore.getIgnoreDaysAndTimeSlots(req.params.location, req.query.numberOfPeople)
        const disabledTimeslots = await firestore.getDisabledTimeSlots(req.params.location, req.query.numberOfPeople)
        res.send({
            ...ignoreDaysTimeSlot,
            disabledTimeslots
        })
    }catch(e){
        res.status(500).send(e.message)
    }
})

module.exports = router