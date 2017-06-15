const express = require('express');
const router = express.Router();
const moment = require('moment');

const MessengerBot = require('../bots/messengerBot');
const WeatherService = require('../services/weatherService');

const messengerBot = new MessengerBot();
const weatherService = new WeatherService();

const FB_TOKEN = process.env.FB_TOKEN;

router.get('/', function(req, res, next) {
  res.send('API ON !');
});

router.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === FB_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

router.post('/weather', function(req, res) {
    const data = req.body;
    const time = moment(data.result.parameters.date,"YYYY-MM-DD").endOf('day');
    const location = data.result.parameters.location;
    const lang = data.lang;

    weatherService.get(time, location, lang, (data, err) => {
        if (err) {
            if (err === parseInt(err, 10))
                res.sendStatus(err);
            else
                res.sendStatus(500);
            return;
        }
        res.json(data);
    });
});


router.post('/webhook', function (req, res) {
    var data = req.body;

    if (data.object === 'page') {
        data.entry.forEach(function(entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;
            entry.messaging.forEach(function(event) {
                if (event.message) {
                    messengerBot.receivedMessage(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });
        res.sendStatus(200);
    }
});

module.exports = router;
