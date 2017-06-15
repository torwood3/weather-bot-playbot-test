const request = require('request');
const apiai = require('apiai');
const uuid = require('node-uuid');

const APIAI_TOKEN = process.env.APIAI_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

exports.MessengerBot = class {
    constructor() {
        this.nlpServer = apiai(APIAI_TOKEN);
        this.userMap = new Map();
    }

    receivedMessage(event) {
        const senderID = event.sender.id;
        const recipientID = event.recipient.id;
        const timeOfMessage = event.timestamp;
        const message = event.message;

        console.log("Received message for user %d and page %d at %d with message:",
            senderID, recipientID, timeOfMessage);
        console.log(JSON.stringify(message));

        const messageText = message.text;
        const messageAttachments = message.attachments;

        if(!this.userMap.get(senderID))
            this.userMap.set(senderID, uuid.v4());

        if (messageText) {
            this.sendTextMessage(senderID, messageText);
        }
        console.log('Message type not handled');
    }

    callSendAPI(messageData) {
        request({
            uri: 'https://graph.facebook.com/v2.6/me/messages',
            qs: { access_token: PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: messageData
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                const recipientId = body.recipient_id;
                const messageId = body.message_id;

                console.log("Successfully sent message with id %s to recipient %s", messageId, recipientId);
            } else {
                console.error("Unable to send message.");
                console.error(response);
                console.error(error);
            }
        });
    }

    getResponse(messageText, senderID, done) {
        const nlpRequest = this.nlpServer.textRequest(messageText, {
            sessionId: this.userMap.get(senderID)
        });

        nlpRequest.on('response', function(response) {
            console.log(response.result.fulfillment.speech);
            done(response.result.fulfillment.speech);
        });

        nlpRequest.on('error', function(error) {
            console.log(error);
            done(null, error);
        });

        nlpRequest.end();
    }

    sendTextMessage(recipientId, messageText) {
        this.getResponse(messageText, recipientId, (responseText, err) => {
            if (err) {
                console.log(err);
            }

            const messageData = {
                recipient: {
                    id: recipientId
                },
                message: {
                    text: responseText
                }
            };
            this.callSendAPI(messageData);
        });
    }
}