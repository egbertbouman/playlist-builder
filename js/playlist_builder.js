playlist_builder = {};

(function(playlist_builder, $) {

    playlist_builder.jamendo_client = '9d9f42e3';
    playlist_builder.search_results = {};
    playlist_builder.whitelist = [];
    playlist_builder.playlists = {};
    playlist_builder.playlist_name = undefined;
    playlist_builder.playlist = new jPlayerPlaylist({
                                  jPlayer: '#player-core',
                                  cssSelectorAncestor: '#player-ui'
                                }, [],
                                {
                                  supplied: 'mp3',
                                  wmode: 'window'
                                });

    playlist_builder.add_playlists = function(playlists) {
        // Add playlists + add links to the dropdown menu 
        var skipped = [];
        for (var name in playlists) {
            if (name in this.playlists) {
                skipped.push(name);
                continue;
            }
            $('#playlist-menu').append('<li role="presentation"><a role="menuitem" tabindex="-1" href="#" onclick="playlist_builder.change_playlist(\'' + name + '\');">' + name + '</a></li>');
            this.playlists[name] = playlists[name];
        }
        // If no playlist was selected, select one now.
        if (this.playlist_name === undefined) {
            this.change_playlist(Object.keys(this.playlists)[0]);
        }
        this.save_cookie();
        return skipped;
    }

    playlist_builder.get_playlists = function() {
        // Store current playlist
        if (this.playlist_name !== undefined) {
            this.playlists[this.playlist_name] = this.playlist.playlist;
        }
        return this.playlists;
    }

    playlist_builder.load_cookie = function() {
        // Load cookie and add the playlists
        var cookie = $.cookie("playlists");
        var parsed_cookie = (cookie !== undefined) ? JSON.parse(cookie) : cookie;
        var add = parsed_cookie !== undefined && !$.isEmptyObject(parsed_cookie);
        if (add) {
            this.add_playlists(parsed_cookie);
        } 
        return add;
    }

    playlist_builder.save_cookie = function() {
        // Store playlists to cookie
        $.cookie("playlists", JSON.stringify(this.get_playlists()));
    }

    playlist_builder.import_json = function(json_string) {
        playlists = JSON.parse(json_string);
        var skipped = this.add_playlists(playlists);
        if (skipped.length > 0) {
            bootbox.alert('You already have playlist(s) with the following name(s): ' + skipped.join(', ') + '. Since playlist names have to be unique, these will not be imported.');
        }
    }

    playlist_builder.export_json = function() {
        // Download playlists as JSON file
        var json_playlists = JSON.stringify(this.get_playlists());
        var blob = new Blob([json_playlists], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "playlists.json");
    }

    playlist_builder.create_playlist = function(name, description) {
        // TODO: call API
        // TODO: check if name already exists
        $('#playlist-menu').append('<li role="presentation"><a role="menuitem" tabindex="-1" href="#" onclick="playlist_builder.change_playlist(\'' + name + '\');">' + name + '</a></li>');
        this.change_playlist(name);
        this.save_cookie();
    }

    playlist_builder.delete_playlist = function() {
        if (this.playlist_name !== undefined) {
            this.playlists[this.playlist_name] = this.playlist.playlist;
        }

        var keys = Object.keys(this.playlists);
        if (keys.length < 2) {
            bootbox.alert("You need to have multiple playlists in order to remove one.");
            return;
        }

        var index = keys.indexOf(this.playlist_name);
        index = (index < keys.length - 1) ? index + 1 : index - 1
        var to_delete = this.playlist_name;
        var to_show = keys[index];

        this.change_playlist(to_show);

        delete this.playlists[to_delete];
        $('#playlist-menu > li > a[onclick="playlist_builder.change_playlist(\'' + to_delete + '\');"]').parent().remove();

        this.save_cookie();
    }

    playlist_builder.change_playlist = function(name) {
        if (this.playlist_name !== undefined) {
            this.playlists[this.playlist_name] = this.playlist.playlist;
        }
        if (name in this.playlists) {
            this.playlist.setPlaylist(this.playlists[name]);
        }
        else {
            this.playlist.setPlaylist([]);
        }
        this.playlist_name = name;
        $('#playlist-menu-button').html('Playlist: ' + name + ' <span class="caret"></span>');
    }

    playlist_builder.search = function() {
        var self = this;
        var query = $("#search-query").val();
        var results = $("#search-results");
        $.getJSON("https://api.jamendo.com/v3.0/tracks/?client_id=" + this.jamendo_client + "&limit=200&include=musicinfo&namesearch=" + query + "&groupby=artist_id", function(data) {
            if (!self.check_jamendo_response(data)) {
                return;
            }
            data = self.filter_jamendo_response(data);
            results.empty();

            // If we do not have results, let the user know
            if (data['results'].length == 0) {
                results.append('No results found');
                return;
            }
            // If we do have results, show them
            $.each(data['results'], function(key, val) {

                self.search_results[val['id']] = {
                    title: val['name'],
                    artist: val['artist_name'],
                    mp3: val['audio'],
                    poster: val['image'],
                    musicinfo: val['musicinfo']
                };

                var item_html = '<li class="list-group-item shorten">';

                var tags_html = self.create_tags_popover(val['musicinfo']);

                item_html += '<div class="pull-right m-l btn-group">';
                item_html += '<a href="#" onclick="return false;" data-toggle="popover" data-placement="bottom" tabindex="0" data-trigger="focus" title="Tags" data-content="' + tags_html + '" class="m-r-sm"><span class="glyphicon glyphicon-info-sign"></span></a>';
                item_html += '<a href="#" onclick="playlist_builder.play_track(' + val['id'] + '); return false;" class="m-r-sm"><span class="glyphicon glyphicon-play"></span></a>';
                item_html += '<a href="#" onclick="playlist_builder.add_track(' + val['id'] + '); return false;" class="m-r-sm"><span class="glyphicon glyphicon-plus"></span></a>';

                item_html += '</div>';

                item_html += '<img src="' + val['image'] + '" alt="" class="img-thumbnail covert-art"';
                item_html += '<a href="javascript:;" class="jp-playlist-item" tabindex="0">' + val['name'] + ' - ' + val['artist_name'] + '</a>';

                item_html += '</li>';

                $(item_html).appendTo(results);
            });
          $("[data-toggle=popover]").popover({ html : true, container: 'body'});
        });
    }

    playlist_builder.add_track = function(jamendo_id) {
        if (jamendo_id in this.search_results) {
            this.playlist.add(this.search_results[jamendo_id]);
            this.save_cookie();
        }
        else {
            var self = this;
            $.getJSON("https://api.jamendo.com/v3.0/tracks/?client_id=" + self.jamendo_client + "&id=" + jamendo_id, function(data) {
                if (!self.check_jamendo_response(data)) {
                    return;
                }
                $.each(data['results'], function(key, val) {

                    self.playlist.add({
                        title: val['name'],
                        artist: val['artist_name'],
                        mp3: val['audio'],
                        poster: val['image'],
                        musicinfo: val['musicinfo']
                    });

                });
                self.save_cookie();
            });   
        }
    }

    playlist_builder.play_track = function(jamendo_id) {
        if (jamendo_id in this.search_results) {
            $(this.playlist.cssSelector.jPlayer).jPlayer("setMedia", {mp3: this.search_results[jamendo_id]['mp3']}).jPlayer("play");
        }
        else {
            var self = this;
            $.getJSON("https://api.jamendo.com/v3.0/tracks/?client_id=" + self.jamendo_client + "&id=" + jamendo_id, function(data) {
                if (!self.check_jamendo_response(data)) {
                    return;
                }
                $(self.playlist.cssSelector.jPlayer).jPlayer("setMedia", {mp3: data['results'][0]['audio']}).jPlayer("play");
            });   
        }
    }

    playlist_builder.check_jamendo_response = function(data) {
        var success = ('headers' in data && 'status' in data['headers'] && data['headers']['status'] === 'success');
        if (!success) {
            bootbox.alert('Failed to contact Jamendo server!')
        }
        return success;
    }

    playlist_builder.filter_jamendo_response = function(data) {
        if (this.whitelist.length == 0) {
            return data;
        }

        var i = data['results'].length;
        while (i--) {
            var item = data['results'][i];
            if (this.whitelist.indexOf(item['id']) < 0) {
                var index = data['results'].indexOf(item);
                data['results'].splice(index, 1);
            }
        }
        return data;
    }

    playlist_builder.create_tags_popover = function(musicinfo) {
        tags_html = "<div class='tags-container'>" +
                    "<table><tr><td>Genres:</td><td>";

        if (musicinfo['tags']['genres'].length == 0) {
            tags_html += "n/a";
        }

        musicinfo['tags']['genres'].forEach(function (tag) {
            tags_html += "<span class='label label-success'>" + tag + "</span>";
        });

        tags_html += "</td></tr><tr><td>Instruments:</td><td>";

        if (musicinfo['tags']['instruments'].length == 0) {
            tags_html += "n/a";
        }

        musicinfo['tags']['instruments'].forEach(function (tag) {
            tags_html += "<span class='label label-danger'>" + tag + "</span>";
        });

        tags_html += "</td></tr><tr><td>Other:</td><td>";

        if (musicinfo['tags']['vartags'].length == 0) {
            tags_html += "n/a";
        }

        musicinfo['tags']['vartags'].forEach(function (tag) {
            tags_html += "<span class='label label-primary'>" + tag + "</span>";
        });

        tags_html += "</td></tr></div>";

        return tags_html;
    }

})(playlist_builder, jQuery);
