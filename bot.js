var HTTPS = require('https');
var requests = require('request');
var cool = require('cool-ascii-faces');

var moderatorsGroup = process.env.MODERATORS_GROUP_ID;
var motdIDs = process.env.MOTD_IDS.split(",");
var motdUrl = process.env.MOTD_URL;

var pageIDS = process.env.PAGE_IDS.split(",");

var botName = "H.P. Lovecraft"

var postOptions = {
                    hostname: 'api.groupme.com',
                    path: '/v3/bots/post',
                    method: 'POST'
                  };


var group_bot_map = {}

var mapping = process.env.GROUP_BOT_MAP.split(",")
for (x in mapping) {
    var s = mapping[x].split(';');
    group_bot_map[s[0]] = s[1];
}


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


function bot_for_group(request) {
    if (request.group_id in group_bot_map) {
        return group_bot_map[request.group_id];
    } else {
        return null;
    }
}


function postMotd() {
    getMotd(function(message) {
        for (i in motdIDs) {
            postMessage(motdIDs[i], message);
        }
    });
    this.res.writeHead(200);
    this.res.end();
}


function page(request) {
    if (request.group_id == moderatorsGroup) {
        if (request.text.indexOf("!page") === 0) {
            message = request.text.replace("!page", "");
            for (i in pageIDS) {
                postMessage(pageIDS[i], message);
            }
        }
    }
}


function motd(request) {
    if (request.text.indexOf("!motd") === 0) {
        getMotd(function(message) {
            postMessage(bot_for_group(request), message);
        });
    }
}


function postMessage(botID, message) {
    if (message == null) {
        console.log("Skipping sending of null message")
        return
    }
    if (botID == null) {
        console.log("Skipping sending of null botID")
        return
    }

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
