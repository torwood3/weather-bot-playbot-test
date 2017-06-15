var express = require('express');
var router = express.Router();
var request = require('request');
var apiai = require('apiai');
var nlpServer = apiai(process.env.APIAI_TOKEN);
const uuid = require('node-uuid');
var user = {};

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === process.env.FB_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

router.post('/weather', function(req, res, next) {
    const data = req.body;
    const date = data.date;
    const location = data.location;

    console.log(data);
    console.log(location)
    //Check if date is well formed
    //if date is now
        //return
    //else if date is less than now
        //if less than 1months
            //return
        //else
            //ERROR too old for a free account
    //else
        //if less than 5 day

        //else if less than 16day

        //else
            //ERROR in too long time


});


router.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function(entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.message) {
                    receivedMessage(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know
        // you've successfully received the callback. Otherwise, the request
        // will time out and we will keep trying to resend.
        res.sendStatus(200);
    }
});

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageId = message.mid;

    var messageText = message.text;
    var messageAttachments = message.attachments;

    if(!user[senderID])
        user[senderID] = uuid.v4();

    getUserProfil(senderID, (userProfil, err) => {
        if(!err) console.log('No user Profil');

        if (messageText) {
            sendTextMessage(senderID, messageText);
        } else if (messageAttachments) {
            sendTextMessage(senderID, "Message with attachment received");
        } else {
            console.log('No message text');
        }
    });
}

function getUserProfil(userId, done) {
    request({
        uri: `https://graph.facebook.com/v2.6/${userId}?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
        method: 'GET'
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            done(body);
        } else {
            console.error("Unable to get user profil.");
            console.error(response);
            console.error(error);
            done(null, error);
        }
    });
}

function callSendAPI(messageData) {
    console.log('callSendAPI');
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}

function getResponse(messageText, senderID, done) {
    var request = nlpServer.textRequest(messageText, {
        sessionId: user[senderID]
    });

    request.on('response', function(response) {
        console.log(response);
        done("response of nlp")
    });

    request.on('error', function(error) {
        console.log(error);
        done(null, error);
    });

    request.end();
}

function sendTextMessage(recipientId, messageText) {
    console.log('sendTextMessage');

    getResponse(messageText, recipientId, (responseText, err) => {
        if(!err) return;

        const messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: responseText
            }
        };
        callSendAPI(messageData);
    });
}




module.exports = router;
