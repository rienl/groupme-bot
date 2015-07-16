var HTTPS = require('https');
var requests = require('request');
var cool = require('cool-ascii-faces');

var moderatorsGroup = process.env.MODERATORS_GROUP_ID;
var motdIDs = process.env.MOTD_IDS.split(",");
var motdUrl = process.env.MOTD_URL;

var pageIDS = process.env.PAGE_IDS.split(",");
var botIDS = process.env.BOT_IDS.split(",");

var botName = "H.P. Lovecraft"

var postOptions = {
                    hostname: 'api.groupme.com',
                    path: '/v3/bots/post',
                    method: 'POST'
                  };


function respond() {
    var request = JSON.parse(this.req.chunks[0]);

    console.log(request);

    if (request.id in botIDS || request.name == botName || request.system == true) {
        // Don't respond to bot messages or system messages
        return;
    }

    // Try all the things!
    page(request);
    motd(request);

    this.res.writeHead(200);
    this.res.end();
}

function getMotd(callback) {
    requests.get(motdUrl,
        function(error, response, body) {
            if (error == null && response.statusCode == 200) {
                callback(body);
            } else {
                callback(null);
            }
        }
    );
}


function postMotd() {
    getMotd(function(message) {
        if (message != null) {
            for (i in motdIDs) {
                postMessage(motdIDs[i], message);
            }
        }
    });
    this.res.writeHead(200);
    this.res.end();
}


function page(request) {
    if (request.group_id == moderatorsGroup) {
        if (request.text.indexOf("!page") > -1) {
            message = request.text.replace("!page", "");
            for (i in pageIDS) {
                postMessage(pageIDS[i], message);
            }
        }
    }
}


function motd(request) {
    if (request.text == "!motd") {
        getMotd(function(message) {
            if (message != null) {
                postMessage(motdIDs[i], message);
            }
        });
    }
}


function postMessage(botID, message) {
  var body, botReq;

  body = {
    "bot_id" : botID,
    "text" : message
  };

  console.log('--------\n' + message + '\n\nSent as ' + botID + '\n--------');

  botReq = HTTPS.request(postOptions, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });
  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}

exports.respond = respond;
exports.postMotd = postMotd;
