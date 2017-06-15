var express = require('express');
var router = express.Router();
var request = require('request');
var apiai = require('apiai');
const uuid = require('node-uuid');
const moment = require('moment');

var user = {};
var nlpServer = apiai(process.env.APIAI_TOKEN);

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
    const time = moment(data.result.parameters.date,"YYYY-MM-DD").endOf('day');
    const location = data.result.parameters.location;
    const lang = data.lang;

    const diff = -1 * moment().diff(time, 'days');
    let options = {method: 'GET'};

    if (diff => 0 && diff < 5 ) {
        options.url = `http://api.openweathermap.org/data/2.5/forecast/daily?q=${location}&cnt=5&units=metric&lang=fr&appid=${process.env.OPEN_WEATHER_MAP_API}`
    } else {
        console.log("la periode de temps n'est pas géré");
        return res.sendStatus(400);
    }
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = JSON.parse(body);
            if (body.cnt >= diff) {
                const result = body.list[diff];
                res.json({
                    "speech": `${result.weather[0].description} avec une température d'environ ${Math.floor(result.temp.day)}°C`,
                    "source": "weather-api-playbots-test",
                    "displayText": `${result.weather[0].description} avec une température d'environ ${Math.floor(result.temp.day)}°C`
                });
                console.log(result);
            }
        } else {
            console.error("Unable to get weather.");
            console.error(response);
            console.error(error);
        }
        res.sendStatus(200);
    });
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
