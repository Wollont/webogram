;
(function initApplication() {
    // Prevent click-jacking
    try {
        if (window == window.top || window.chrome && chrome.app && chrome.app.window) {
            document.documentElement.style.display = 'block'
        } else {
            top.location = self.location
        }
    } catch (e) {
        console.error('CJ protection', e)
    }

    var classes = [
        Config.Navigator.osX ? 'osx' : 'non_osx',
        Config.Navigator.msie ? 'msie' : 'non_msie',
        Config.Navigator.retina ? 'is_2x' : 'is_1x'
    ]
    if (Config.Modes.ios_standalone) {
        classes.push('ios_standalone')
    }
    $(document.body).addClass(classes.join(' '))

    ConfigStorage.get('layout_selected', 'i18n_locale', function (params) {
        var layout = params[0]
        var locale = params[1]
        var defaultLocale = 'en-us'
        var bootReady = {
            dom: false,
            i18n_ng: false,
            i18n_messages: false,
            i18n_fallback: false
        }
        var checkReady = function checkReady() {
            var i
            var ready = true
            for (i in bootReady) {
                if (bootReady.hasOwnProperty(i) && bootReady[i] === false) {
                    ready = false
                    break
                }
            }
            if (ready) {
                bootReady.boot = false
                angular.bootstrap(document, ['myApp'])
            }
        }

        if (Config.Modes.force_mobile) {
            layout = 'mobile'
        } else if (Config.Modes.force_desktop) {
            layout = 'desktop'
        }

        switch (layout) {
            case 'mobile':
                Config.Mobile = true
                break
            case 'desktop':
                Config.Mobile = false
                break
            default:
                var width = $(window).width()
                Config.Mobile = Config.Navigator.mobile || width > 10 && width < 480
                break
        }
        $('head').append(
                '<link rel="stylesheet" href="css/' + (Config.Mobile ? 'mobile.css' : 'desktop.css') + '" />'
                )

        if (!locale) {
            locale = (navigator.language || '').toLowerCase()
            locale = Config.I18n.aliases[locale] || locale
        }
        for (var i = 0; i < Config.I18n.supported.length; i++) {
            if (Config.I18n.supported[i] == locale) {
                Config.I18n.locale = locale
                break
            }
        }
        bootReady.i18n_ng = Config.I18n.locale == defaultLocale // Already included

        $.getJSON('js/locales/' + Config.I18n.locale + '.json').success(function (json) {
            Config.I18n.messages = json
            bootReady.i18n_messages = true
            if (Config.I18n.locale == defaultLocale) { // No fallback, leave empty object
                bootReady.i18n_fallback = true
            }
            checkReady()
        })

        if (Config.I18n.locale != defaultLocale) {
            $.getJSON('js/locales/' + defaultLocale + '.json').success(function (json) {
                Config.I18n.fallback_messages = json
                bootReady.i18n_fallback = true
                checkReady()
            })
        }

        $(document).ready(function () {
            bootReady.dom = true
            if (!bootReady.i18n_ng) { // onDOMready because needs to be after angular
                $('<script>').appendTo('body')
                        .on('load', function () {
                            bootReady.i18n_ng = true
                            checkReady()
                        })
                        .attr('src', 'vendor/angular/i18n/angular-locale_' + Config.I18n.locale + '.js')
            } else {
                checkReady()
            }
        })
    })
})()

initMap = function (result) {
    var allTooltips = [];
    var allMarkers = [];

    if ($('#gg_map').length) {
        var center = new google.maps.LatLng(-25.363, 131.044);
        function distance(coords1, coords2) {

            function toRad(x) {
                return x * Math.PI / 180;
            }

            var dLat = toRad(coords2.lat() - coords1.lat());
            var dLon = toRad(coords2.lng() - coords1.lng());
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(coords1.lat())) *
                    Math.cos(toRad(coords2.lat())) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);

            return 12742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        function centerOnPosition(pos) {
            gpos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
            var marker = new google.maps.Marker({position: gpos, map: map, title: "You are here"});
            if (window.location.href.includes("map")) {

                var d = distance(gpos, center);

                if (true) {
                    b = new google.maps.LatLngBounds();
                    allMarkers.sort(function (a, b) {
                        return distance(gpos, a) - distance(gpos, b);
                    });
                    b.extend(gpos);
                    b.extend(allMarkers[0]);
                    map.fitBounds(b);
                    map.setCenter(gpos);
                    map.setZoom(map.getZoom() - 1);

                }
            }
        }

        function showError() {
        }

        function markers(item) {
            try {
                var lat = parseFloat(item.lat);
                var lon = parseFloat(item.lon);
            } catch (e) {
                return;
            }
            if (lat === 0 || lon === 0)
                return;

            var ll = new google.maps.LatLng(lat, lon);

            var marker = new google.maps.Marker({
                position: ll,
                icon: 'https://gpsgram.senseisoft.com/_map_pin.png',
                map: map
            });
            allMarkers.push(ll);
            google.maps.event.addListener(marker, 'click', function () {
                var params = {peerString: 'u'+item.tgId};
                angular.element(document.body).injector().get('$rootScope').$broadcast('history_focus', params);
            });
            if (++ext <= 3)
                bounds.extend(ll);
            bounds_all.extend(ll);
        }

        var map = new google.maps.Map(document.getElementById('gg_map'), {
            zoom: 10,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            center: center
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(centerOnPosition, showError);
        }
        var ext = 0;

        var bounds = new google.maps.LatLngBounds(),
                bounds_all = new google.maps.LatLngBounds();

        result.trackedUsers.forEach(function (item) {
            markers(item);
        });

        var populationOptions = {
            strokeOpacity: 0,
            strokeWeight: 0,
            fillColor: '#33bdcb',
            fillOpacity: 0.5,
            map: map,
            center: center,
            radius: 3000,
            visible: false
        },
                hotelCircle = new google.maps.Circle(populationOptions);

        google.maps.event.addListener(map, 'zoom_changed', function () {
            var p = Math.pow(2, (21 - map.getZoom()));
            hotelCircle.setRadius(p * 1128.497220 * 0.0027);
        });

    }
};