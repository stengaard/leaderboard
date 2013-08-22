// Set up a collection to contain player information. On the server,
// it is backed by a MongoDB collection named "players".

Players = new Meteor.Collection("players");
Matches = new Meteor.Collection("matches");

function match(id){
    var m = Matches.findOne({_id: id});
    console.log(m);
    return m;
}

function datestr(d) {
    var m_names = new Array("January", "February", "March", "April", "May",
                            "June", "July", "August", "September", "October",
                            "November", "December");

    var curr_date = d.getDate();
    var curr_month = d.getMonth()+1;
    var curr_year = d.getFullYear();
    return curr_year + '-' + curr_month + '-' + curr_date;
}

function player(id) {
    var player = Players.findOne(id);
    if (player === undefined)
        return undefined
    player._matches = function() {
        var matches = Matches.find({$or : [
            {left_player : player._id},
            {right_player : player._id}
        ]});
        return matches;
    }
    player.matches = function() {
        return player._matches().fetch()
    }

    player.score = function() {
        losses = 0;
        wins = 0;
        player._matches().forEach(function(match){
            if (id == match.left_player){
                wins += match.left_score;
                losses += match.right_score;
            }else {
                wins += match.right_score;
                losses += match.left_score;
            }
        });
        return {value: (1.0*wins)/losses, wins: wins, defeats: losses}
    }
    return player;
}
function clear_db() {
    var tables = [Players, Matches];
    for (i=0; i < tables.length; i++){
        var table = tables[i]
        table.find({}).forEach(function(elem) {
            table.remove(elem);
        });
    }
}


if (Meteor.isClient) {
    Session.setDefault('selected_players', [])

    Template.leaderboard.players = function () {
        var p = [];
        Players.find({}).forEach(function(_p) {
            console.log(_p);
            p.push(player(_p._id));
        });
        p = p.sort(function(p1, p2){
            var s = p2.score().value - p1.score().value;
            return s;
        });
        return p;
    };

    Template.leaderboard.msg = function() {
        return Session.get('msg')
    }

    Template.leaderboard.any_selected_players = function() {
        return Session.get("selected_players").length > 0;
    }

    Template.leaderboard.one_selected_player = function() {
        return Session.get("selected_players").length == 1;
    }

    Template.leaderboard.two_selected_players = function() {
        return Session.get("selected_players").length == 2;
    }

    Template.leaderboard.first_player = function() {
        return player(Session.get("selected_players")[0]);
    }

    Template.leaderboard.selected_players = function () {
        return Players.find({_id: {$in : Session.get("selected_players")}}).fetch();
    };


    Template.leaderboard.events({
        'keypress #newguy': function (event) {
            if (event.charCode == 13) {
                var name = $('#newguy').val();
                if ( Players.find({name: name}).count() > 0 ) {
                    set_msg('error', 'There is already a user by name '+name);
                } else {
                    set_msg('info', 'Created user '+ name)
                    Players.insert({name: name});
                }
            }
        }
    });

    Template.player.player = function() {
        var p =  player(this._id);
        return p;
    }

    Template.player.selected = function () {
        var players =  Session.get("selected_players");
        return players.indexOf(this._id) !== -1 ? "selected" : "";
    };

    Template.player.events({
        'click': function () {
            var players = Session.get("selected_players");
            var idx = players.indexOf(this._id)
            if ( idx >= 0 ) {
                players.splice(idx, 1)
            } else {
                players.push(this._id);
            }
            if (players.length > 2) {
                players.shift();
            }
            Session.set("selected_players", players);
        }
    });

    function _session_player (idx) {
        return function() {
            var o = Players.findOne(Session.get("selected_players")[idx])
            return o
        }
    };
    Template.newmatch.left_player = _session_player(0)
    Template.newmatch.right_player = _session_player(1)


    function sets(side){
        var s = $('#'+side+'-sets').val();
        if ( s.length == 0){
            return NaN
        } else {
            return Number(s)
        }
    }

    function set_msg(lvl, msg){
        var old = Session.get('timeout');
        Session.set('msg', {text: msg, level: lvl});
        if ( old ) {
            Meteor.clearTimeOut(old);
        }
        Meteor.setTimeout(function() {
            Session.set('msg', '');
            Session.set('timeout', '');
        }, 5000);
    }


    Template.historicmatch.match = function() {
        var m = match(this._id);
        m.left_player = player(m.left_player);
        m.right_player = player(m.right_player);
        return m;
    }

    Template.newmatch.events({
        'keypress #left-sets, keypress #right-sets': function(event){
            //enter key pressed
            if (event.charCode == 13) {
                if ( ! isNaN( sets('left') ) && sets('left') >= 0){
                    if ( ! isNaN( sets('left') ) && sets('right') >= 0){
                        //create new match
                        Matches.insert({
                            left_player  : _session_player(0)()._id,
                            right_player : _session_player(1)()._id,
                            left_score   : sets('left'),
                            right_score  : sets('right'),
                            match_date   : datestr(new Date()),
                        });
                        Session.set('selected_players', []);
                        set_msg('info', 'Match saved');
                    } else {
                        $('#right-set').focus()
                        set_msg('error', 'Please enter a numerical, non-negative as the number of won sets value.')
                    }
                } else {
                    $('#left-set').focus()
                    set_msg('error', 'Please enter a numerical, non-negative as the number of won sets value.')
                }
            }
        }
    });

}

// On server startup, create some players if the database is empty.
if (Meteor.isServer) {
    function init_db() {
        var names = ["Prydende Præzi",
                     "Mugne Mørk",
                     "Krasbørstige Klemme",
                     "Tunge Tollund",
                     "Malurtslugtende Mads",
                     "Jade Jonna"];
        for (var i = 0; i < names.length; i++){
            Players.insert({name: names[i]});
        }

    }
    function random_data(){
        function choice(arr) {
            var idx = Math.floor((Math.random()*arr.length));
            var p = arr[idx];
            return p;
        }

        for (var i = 0; i < 20; i++){
            var p1 = Players.findOne({name: choice(names)})
            var p2 = Players.findOne({name: choice(names)})

            Matches.insert({
                left_player  : p1._id,
                right_player : p2._id,
                left_score   : Math.floor((Math.random()*10)+1),
                right_score  : Math.floor((Math.random()*10)+1),
                match_date   : datestr(new Date()),
            });
        }
    }

    Meteor.startup(function () {
        //clear_db();
        //init_db();
    });
}
