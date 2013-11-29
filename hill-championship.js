
var redis_url = require('redis-url');
var redistogo_url = process.env.REDISTOGO_URL || null;
var redis = redis_url.connect(redistogo_url);

Backbone = require('backbone')
_ = require('underscore')

RedAsm = require('./public/js/src/redasm')
var Mars = require('./public/js/src/mars')

var core = new Mars.MarsCore({
  'maxCycles': 50000,
})


var NUM_ROUNDS = 100;
var match_count = 0;

var done = function(results, elapsedTime) {

  if (results) {
    var scores = {}

    for (var r=0; r < results.length; r++) {
      // console.log("round #", r+1);

      for (var i=0; i < results[r].players.length; i++) {
        var player = results[r].players[i];
        // console.log("  ",player.username, player.score );

        if (!(player.username in scores)) {
          scores[player.username] = {
            'wins': 0,
            'losses': 0,
            'ties': 0,
            'score': 0,
          };
        }
        scores[player.username].score += player.score;
        if (player.score == 2) {
          scores[player.username].wins++
        }
        else if (player.score == 1) {
          scores[player.username].ties++
        }
        else if (player.score == 0) {
          scores[player.username].losses++
        }
      }
    }

    if (elapsedTime)
      console.log("  Duration: "+elapsedTime/1000+"s")
    console.log(scores);
    console.log("\n")
  }


  if (--match_count <= 0)
    process.exit();
}



var already_run = {}

redis.smembers("queuedScripts", function(err,scripts) {
  if (scripts.length == 0) {
    console.log("no queued scripts.");
    done()
  }


  match_count = (scripts.length)*(scripts.length-1);

  console.log("queued", scripts)
  console.log(match_count+" matches, "+NUM_ROUNDS+" rounds each.")

  var i,j;
  for (i = 0; i < scripts.length; i++) {
    for (j = 0; j < scripts.length; j++) {
        if (i == j) 
          continue;

        /* this inner loop needs to be in a closure for proper scoping */
        (function() {


          var iKey = scripts[i];
          var jKey = scripts[j];

          //alphabetize 
          if (jKey < iKey) {
            var tmp = jKey;
            jKey = iKey;
            iKey = tmp;
          }

          var match_key = "match:"+iKey+":"+jKey;

          redis.get(match_key, function(err,match){
            if (match)
              done();

            redis.get(iKey, function(err,iScript){
              redis.get(jKey, function(err,jScript){
                var results;

                if (already_run[match_key]) {
                  done();
                  return;
                }

                console.log(iKey+" vs. "+jKey);
                var startTime = Date.now();

                if (iScript && jScript) {
                  results = core.runBattle([JSON.parse(iScript), JSON.parse(jScript)], NUM_ROUNDS);
                }
                var endTime = Date.now();
                already_run[match_key] = true

                done(results, endTime - startTime);

              })
            });

          });

        })();

    }
  }

})


