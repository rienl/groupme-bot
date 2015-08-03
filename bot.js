var HTTPS = require('https');
var requests = require('request');
var cool = require('cool-ascii-faces');
var jf = require('jsonfile');

var moderatorGroups = [];
var pageIDS = [];
var motdIDs = [];

var postOptions = {
                    hostname: 'api.groupme.com',
                    path: '/v3/bots/post',
                    method: 'POST'
                  };

function get_json_url(url, callback) {
    var options = {
        uri : url,
        method : 'GET'
    };
    var res = '';
    requests(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            return callback(JSON.parse(body));
        } else {
            return callback(null);
        }
    });
}

function get_plain_url(url, callback) {
    var options = {
        uri : url,
        method : 'GET'
    };
    var res = '';
    requests(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            return callback(body);
        } else {
            return callback(null);
        }
    });
}

// Process the botmap JSON file
var group_bot_map = {};
get_json_url(process.env.BOTMAP_URL,
    function(botmap) {
        for (x in botmap) {
            bm = botmap[x];
            group_bot_map[bm.group] = bm.bot_id;
            if (bm.mods === true) {
                moderatorGroups.push(bm.group);
            }
            if (bm.motd === true) {
                motdIDs.push(bm.bot_id);
            }
            if (bm.page === true) {
                pageIDS.push(bm.bot_id);
            }
        }
    }
);


// Process the magics
var mappings = [];
var magic = jf.readFile("magic.json", function(err, obj) {
    // Process the eggs
    get_json_url(process.env.EGGS_URL,
        function(eggmap) {
            mappings = obj.concat(eggmap);
        }
    );
});


function respond() {
    var request = JSON.parse(this.req.chunks[0]);

    console.log(request);

    if (request.sender_type == 'bot' || request.system == true) {
        // Don't respond to bot messages or system messages
        return;
    }

    // Try all the things!
    page(request);
    motd(request);
    links(request);
    magics(request);

    this.res.writeHead(200);
    this.res.end();
}

function getMotd(callback) {
    get_plain_url(process.env.MOTD_URL, function(response) {
        return callback(response);
    });
}

function getLinks(callback) {
    get_plain_url(process.env.LINKS_URL, function(response) {
        return callback(response);
    });
}


function bot_for_group(request, callback) {
    if (request.group_id in group_bot_map) {
        return callback(group_bot_map[request.group_id]);
    } else {
        return callback(null);
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
    if (request.group_id in moderatorGroups) {
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
            bot_for_group(request, function(botID) {
                postMessage(botID, message);
            });
        });
    }
}


function links(request) {
    if (request.text.indexOf("!links") === 0) {
        getLinks(function(message) {
            bot_for_group(request, function(botID) {
                postMessage(botID, message);
            });
        });
    }
}


function magics(request) {
    for (e in mappings) {
        m = mappings[e];

        // Only allow certain users
        if ("users" in m) {
            if (m.users.indexOf(request.user_id) === -1) {
                continue;
            }
        }

        // Only allow certain groups (rooms)
        if ("groups" in m) {
            if (m.groups.indexOf(request.group_id) === -1) {
                continue;
            }
        }

        var doSend = false;

        if ("key" in m) {
            // ! commands
            if (request.text.toLowerCase().indexOf(m.key) === 0) {
                doSend = true;
            }
        } else if ("regex" in m) {
            // regex
            var r = new RegExp(m.regex);
            if (request.text.search(r) != -1) {
                doSend = true;
            }
        }


        if (doSend === true) {
            bot_for_group(request, function(botID) {
                if ("img" in m) {
                    postImage(botID, m.img);
                } else if ("text" in m) {
                    postMessage(botID, m.text);
                }
            });
            // Just process the first matched magic and ignore any other matches
            break;
        }
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

    botReq = HTTPS.request(postOptions, function(res) {
        if(res.statusCode == 202) {
            console.log('--------\n' + message + '\n\nSent as ' + botID + '\n--------');
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

function postImage(botID, url) {
    if (url == null) {
        console.log("Skipping sending of null url")
        return
    }
    if (botID == null) {
        console.log("Skipping sending of null botID")
        return
    }

    var body, botReq;
    body = {
        "bot_id" : botID,
        "text" : '',
        "attachments" : [
            {
                "type"  : "image",
                "url"   : url
            }
        ]
    };

    botReq = HTTPS.request(postOptions, function(res) {
        if(res.statusCode == 202) {
            console.log('--------\n' + url + '\n\nSent as ' + botID + '\n--------');
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
