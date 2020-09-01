var admin = require("firebase-admin");
const moment = require('moment-timezone')

//intializing the firebase app
var serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://archery-hub.firebaseio.com"
});

let db = admin.firestore()


// auth function 
const auth = async function (req, res, next){

  try{
      const token = req.query.token
      const decodedtoken = await admin.auth().verifyIdToken(token)
      if(!decodedtoken) throw new Error()

      next()
  }catch(e) {
      res.status(401).send()
  }
}


//Add a new timeSlot
async function addTimeSlot(data, location) {
  console.log('here')
    try{
      //Create a batch
      let batch = db.batch()
      console.log(data, location)
      //Create new timeSlots
      const timeSlotRef = await db.collection('timeSlots')
      const availableDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

      
      for(let i =0 ; i < availableDays.length; i++){

        
        const day = availableDays[i]
        //delete the document with field = day
        const query = await timeSlotRef.where('day', '==', day).where('location', '==', location).get()
        if(!query.empty){
          
          const dayRef = query.docs[0].ref
          
          //delete all its subcollections
          const oldTimeslots = await dayRef.collection('time').listDocuments()
          oldTimeslots.forEach(oldtimeslot => {
            batch.delete(oldtimeslot)
          })
          
          //delete the main document
          batch.delete(dayRef)
        }
        if(!(data[day].timeslots.length === 0)){
          
          //if no timeSLot exists create a new one and add its time
          const timeSlotDocRef = await timeSlotRef.doc() 
          batch.create(timeSlotDocRef,
            {
              day:day,
              location: location,
              availableTime:oneDArray(data[day].timeslots),
              maximumReservations: (new Array(data[day].timeslots.length)).fill(data[day].maximumReservations)
            }
            )
            let timeRef = await timeSlotDocRef.collection('time')
            data[day].timeslots.forEach(async (time, index) => {
              const timedoc = timeRef.doc()
              batch.create(timedoc,{
                time,
                maximumReservations: data[day].maximumReservations
              })
            })
            
          }
          
      }  
        
        await batch.commit()
      console.log('Done')
      
    }catch (e) {
      throw(e)
    }
    
}

//Adding a reservation
async function addReservation(data, location){
  try{
    
    data.time = moment(new Date(data.time)).tz('Africa/Cairo').format();

    console.log(data.time)
    //Start a Transaction
    await db.runTransaction(async (transaction) => {

    //check if there is a reservation in the same
    const reservationCollectionRef = await db.collection('reservations')
    
    const query = await reservationCollectionRef.where('time', '==', data.time).where('location', '==', location).get()
    
    //See if the query result is empty or not
    if(!query.empty){
      
      const reservationRef = query.docs[0].ref

      //Check if the maximum Reservation equals the reservationNumber
      const reservation = (await transaction.get(reservationRef)).data()
      const {reservationNumber, maximumReservations} = reservation
      if(reservationNumber + data.numberOfPeople > maximumReservations){
        throw new Error()
      }
      return transaction.update(reservationRef, {numberOfReservations: admin.firestore.FieldValue.increment(data.numberOfPeople)})
    }
    else{
      
      //Get maximum reservations from timeSlots collection
      const day = moment(data.time).tz('Africa/Cairo').format('dddd').toLowerCase()
      const startHour = moment(data.time).tz('Africa/Cairo').format('HH:mm')
      const query = await db.collection('timeSlots').where('day', '==', day).where('location', '==', location).get()
      
      //if no timeSlot avaliable throw error
      if(query.empty){
        
        throw new Error()
      }

      //Otherwise get the maximumReservations of this time
      
      const timeSlotRef = query.docs[0]
      const trainingTimeRef = await timeSlotRef.ref.collection('time').where('time', 'array-contains', startHour.toString()).get()
      let maximumReservations = 0
      if(trainingTimeRef.empty){
        throw new Error()
      }
      trainingTimeRef.forEach( timeRef => {
        const time = timeRef.data()
        console.log(time.time[0])
        if(time.time[0] === startHour.toString()){
          maximumReservations = time.maximumReservations
        }
      })
      console.log(maximumReservations, data.numberOfPeople)
      if(maximumReservations < data.numberOfPeople){
        throw new Error()
      }
      return transaction.create(reservationCollectionRef.doc(),{
        time:data.time,
        numberOfReservations:data.numberOfPeople,
        maximumReservations,
        location
      })
    }
    
  })
  }catch(e) {
    console.log(e.message)
    throw(e)
  }
}

//Getting the ignoreDays and TimeSlots
async function getIgnoreDaysAndTimeSlots(location, numberOfPeople) {
  
  //Default ignoreDays and timeSlots
  const ignoreDays = {
    monday:false,
    sunday:false,
    tuesday:false,
    wednesday:false,
    thursday:false,
    friday:false,
    saturday:false
  }
  const timeSlots = {}
  //Get the time Slots which is available at the location
  const query = await db.collection('timeSlots').where('location', '==', location).get()
  
  //check if the query is empty
  if(query.empty){
    return {
      ignoreDays,
      timeslots: timeSlots
    }
  }
  //See the available days and time
  query.forEach(timeSlot => {
    const data = timeSlot.data()
    delete ignoreDays[data.day]
    timeSlots[data.day] = twoDimensionalarray(data.availableTime,data.maximumReservations, parseInt(numberOfPeople))
  })
  const availableDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  availableDays.forEach(day => {
    if(timeSlots[day] && timeSlots[day].length ==0){
      ignoreDays[day] = false
    }
  })
  return {
    ignoreDays,
    timeslots: timeSlots
  }
}

//Convert to two Dimensional array
function twoDimensionalarray(array, maximum, numberOfPeople){
  let result = []
  for(let i = 0 ,j=0; i< array.length; i=i+2,j++){
    if(maximum[j] >= numberOfPeople)
    result.push(array.slice(i,i+2))
  }
  return result
}

//convert to 1d array
function oneDArray(array){
  let result = []
  array.forEach(item => {
    result.push(item[0])
    result.push(item[1])
  })
  return result
}
//Get disabledTimeSlots
async function getDisabledTimeSlots(location,numberOfPeople) {

  //Get all the reservations in this location and time still didnt come
  const query = await db.collection('reservations').where('location', '==', location).where('time', '>=', moment(Date.now()).tz('Africa/Cairo').format()).get()


  //See if the query is empty then there are no previous reservations
  if(query.empty){
    
    return []
  }
  
  //See which reservations that cant be assigned to the number of people
  let result = []
  query.forEach(doc => {
    const reservation = doc.data()
    if((parseInt(reservation.numberOfReservations) + parseInt(numberOfPeople)) > reservation.maximumReservations){
      result.push({
        format:'MMMM Do YYYY, h:mm:ss A',
        startDate:moment(reservation.time).tz('Africa/Cairo').format('MMMM Do YYYY, h:mm:ss A')
      })
    }
  })
  return result

}
module.exports = {
  addTimeSlot,
  addReservation,
  getIgnoreDaysAndTimeSlots,
  getDisabledTimeSlots,
  auth
}