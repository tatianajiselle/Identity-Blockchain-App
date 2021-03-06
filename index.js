const express = require('express')
const ngrok = require('ngrok')
const bodyParser = require('body-parser')
const { Credentials }  = require("uport-credentials")
const decodeJWT = require('did-jwt').decodeJWT
const transports = require('uport-transports').transport
const message = require('uport-transports').message.util

const htmlTemplate = (qrImageUri, mobileUrl) => `<div><img src="${qrImageUri}" /></div><div><a href="${mobileUrl}">Click here if on mobile</a></div>`
const Time30Days = () => Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60
let endpoint = ''
const messageLogger = (message, title) => {
  const wrapTitle = title ? ` \n ${title} \n ${'-'.repeat(60)}` : ''
  const wrapMessage = `\n ${'-'.repeat(60)} ${wrapTitle} \n`
  console.log(wrapMessage)
  console.log(message)
}

const port = 3000
const app = express();
app.use(bodyParser.json({ type: '*/*' }))


const credentials = new Credentials({
  network: 'ropsten',
  did: process.env.DID,
  privateKey: process.env.PRIVATE_KEY
})

/**
 *  First creates a disclosure request to get the DID (id) of a user. Also request push notification permission so
 *  a push can be sent as soon as a response from this request is received. The DID is used to create the attestation
 *  below. And a pushToken is used to push that attestation to a user.
 */
app.get('/fillow', (req, res) => {
  credentials.createDisclosureRequest({
    requested: ['name', 'email', 'country', 'phone'],
    notifications: true,
    callbackUrl: 'http://c3fd8ee1.ngrok.io' + '/fillow-callback',
    vc: ['/ipfs/QmdHxuhNpXVNewpyUETJyyfefx1LoA7anbxmuc16QWg65G']
  }).then(requestToken => {
    const uri = message.paramsToQueryString(message.messageToURI(requestToken), {callback_type: 'post'})
    const qr =  transports.ui.getImageDataURI(uri)
    res.send(htmlTemplate(qr, uri))
  })
})

/**
 *  This function is called as the callback from the request above. We the get the DID here and use it to create
 *  an attestation. We also use the push token and public encryption key share in the respone to create a push
 *  transport so that we send the attestion to the user.
 */
app.post('/fillow-callback', (req, res) => {
  console.log("HERE IN THE CALLBACK")
  const jwt = req.body.access_token
  console.log(req.body)
  credentials.authenticateDisclosureResponse(jwt).then(creds => {
    const did = creds.did
    const pushToken = creds.pushToken
    const pubEncKey = creds.boxPub
    const push = transports.push.send(pushToken, pubEncKey)
    credentials.createVerification({
      sub: did,
      exp: Time30Days(),
      claim: {'ZVerified User' : {'Name' : creds.name, 'Can post listing' : 'yes', 'Id verified' : 'yes'} }
      // Note, the above is a complex claim. Also supported are simple claims:
      // claim: {'Key' : 'Value'}
    }).then(att => {
      messageLogger(att, 'Encoded Attestation Sent to User (Signed JWT)')
      messageLogger(decodeJWT(att), 'Decoded Attestation Payload of Above')
      return push(att)
    }).then(res => {
      messageLogger('Push notification with attestation sent, will recieve on client in a moment')
    })
  })
})


/**
 *  First creates a disclosure request to get the DID (id) of a user. Also request push notification permission so
 *  a push can be sent as soon as a response from this request is received. The DID is used to create the attestation
 *  below. And a pushToken is used to push that attestation to a user.
 */
app.get('/fonfido', (req, res) => {
  credentials.createDisclosureRequest({
    requested: ['name', 'email', 'country', 'phone'],
    notifications: true,
    callbackUrl: 'https://5bb54e5e.ngrok.io' + '/fonfido-callback',
    accountType: "none",
    vc: '/ipfs/QmWb3XmxwywQgQy4uzMvSU6V795jnogY7QELDYvWn8z22a'
  }).then(requestToken => {
    const uri = message.paramsToQueryString(message.messageToURI(requestToken), {callback_type: 'post'})
    const qr =  transports.ui.getImageDataURI(uri)
    res.send(htmlTemplate(qr, uri))
  })
})

/**
 *  This function is called as the callback from the request above. We the get the DID here and use it to create
 *  an attestation. We also use the push token and public encryption key share in the respone to create a push
 *  transport so that we send the attestion to the user.
 */
app.post('/fonfido-callback', (req, res) => {
  console.log("HERE IN THE CALLBACK")
  const jwt = req.body.access_token
  // console.log('jwt token:' , jwt)
  console.log(req.body)
  credentials.authenticateDisclosureResponse(jwt).then(creds => {
    const did = creds.did
    const pushToken = creds.pushToken
    const pubEncKey = creds.boxPub
    const push = transports.push.send(pushToken, pubEncKey)
    credentials.createVerification({
      sub: did,
      exp: Time30Days(),
      claim: {'Zillow Id verification' : {'Name' : creds.name, 'Can post listing' : 'yes', 'Nickname' : 'Fillow'} }
      // Note, the above is a complex claim. Also supported are simple claims:
      // claim: {'Key' : 'Value'}
    }).then(att => {
      messageLogger(att, 'Encoded Attestation Sent to User (Signed JWT)')
      messageLogger(decodeJWT(att), 'Decoded Attestation Payload of Above')
      return push(att)
    }).then(res => {
    })
  })
})

app.post('/fonfido-webhook', () => {
  return 'hello onfido';
})

const server = app.listen(port, () => {
  console.log('running on port:', port)
})
