'use strict';



const 
  bodyParser = require('body-parser'),
  config = require('config'),
  express = require('express'),
  https = require('https'),  
  request = require('request'),
  swapi = require('swapi-node');

//Configuraciones generales del proyecto
var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(express.static('public'));

//Se obtienen las constantes para conectar con webhook
const APP_SECRET = config.get('appSecret');
const VALIDATION_TOKEN =  config.get('validationToken');
const PAGE_ACCESS_TOKEN =  config.get('pageAccessToken'); 
const SERVER_URL =  config.get('serverURL');

// En caso de que no existan las constantes necesarias se termina la aplicación
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

app.get('/',function(req,res){
  res.send("ok");
  console.log("entra");
});

//Creamos webhook para validar la propiedad
app.get('/webhook',function(req,res){
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Error en validación");
    res.sendStatus(403);          
  }  
});


app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
      
      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
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

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s", 
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'quick reply':
        sendQuickReply(senderID);
      break;  
      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s", 
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    switch(quickReplyPayload){
        case 'people':
            let numeroAleatorio = Math.floor((Math.random() * 5) + 1);
            swapi.get('http://swapi.co/api/people/').then((result) => {
                sendTextMessage(senderID, result.results[numeroAleatorio].name);
            });
        break;
       
        default: 
            sendTextMessage(senderID, "Quick reply tapped");
    }
   
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {

      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;


      case 'quick reply':
        sendQuickReply(senderID);
        break;        

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}



function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}


/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "¿Qué personaje eres?¿De qué planeta? ¿Qué nave usarías?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Personaje",
          "payload":"people"
        },
        {
          "content_type":"text",
          "title":"Planeta",
          "payload":"planet"
        },
        {
          "content_type":"text",
          "title":"Nave",
          "payload":"starships"
        }
      ]
    }
  };

  callSendAPI(messageData);
}



/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;
  switch (payload){
       case 'hello':
            sendGifMessage(senderID);
            trackEvent(senderID,"gifHello");
        break;
        default:
            sendTextMessage(senderID,"I have a bad feeling about this")
  }
}

function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: "https://media.giphy.com/media/3o7abB06u9bNzA8lu8/giphy.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}
function trackEvent(senderID,eventName){
    request.post({ 
    url : "https://graph.facebook.com/"+APP_SECRET+"/activities",
    form: {
        event: 'CUSTOM_APP_EVENTS',
        custom_events: JSON.stringify([{
        _eventName: eventName
        }]),
        advertiser_tracking_enabled: 0,
        application_tracking_enabled: 0,
        extinfo: JSON.stringify(['mb1']),
        page_scoped_user_id: senderID
    }
    }, function(err,httpResponse,body){ 
    console.error(err);
    console.log(httpResponse.statusCode);
    console.log(body);
    });
}
//Start app
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;