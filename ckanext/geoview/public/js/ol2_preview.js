// Openlayers preview module

(function() {

    if (window.Proj4js) {
        // add your projection definitions here
        // definitions can be found at http://spatialreference.org/ref/epsg/{xxxx}/proj4js/

        // warn : 31370 definition from spatialreference.org is wrong
        Proj4js.defs["EPSG:31370"] = "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.868628,52.297783,-103.723893,0.336570,-0.456955,1.842183,-1.2747 +units=m +no_defs";
    }

    var $_ = _ // keep pointer to underscore, as '_' will may be overridden by a closure variable when down the stack

    this.ckan.module('olpreview', function (jQuery, _) {

        ckan.geoview = ckan.geoview || {}

        OpenLayers.Control.CKANLayerSwitcher = OpenLayers.Class(OpenLayers.Control.LayerSwitcher,
            {
                /**
                 * Constructor: OpenLayers.Control.LayerSwitcher
                 *
                 * Parameters:
                 * options - {Object}
                 */
                initialize: function(options) {
                    OpenLayers.Control.LayerSwitcher.prototype.initialize.apply(this, arguments)
                    this.baselayers = options.baselayers
                },

                redraw: function () {
                    //if the state hasn't changed since last redraw, no need
                    // to do anything. Just return the existing div.
                    if (!this.checkRedraw()) {
                        return this.div;
                    }

                    //clear out previous layers
                    this.clearLayersArray("base");
                    this.clearLayersArray("data");

                    var containsOverlays = false;
                    var containsBaseLayers = false;

                    // Save state -- for checking layer if the map state changed.
                    // We save this before redrawing, because in the process of redrawing
                    // we will trigger more visibility changes, and we want to not redraw
                    // and enter an infinite loop.
                    this.layerStates = this.map.layers.map(function (layer) {
                        return {
                            'name': layer.name,
                            'visibility': layer.visibility,
                            'inRange': layer.inRange,
                            'id': layer.id
                        };
                    })

                    var layers = this.map.layers.slice().filter(function (layer) {
                        return layer.displayInLayerSwitcher
                    });
                    if (!this.ascending) {
                        layers.reverse();
                    }

                    for (var i = 0; i < layers.length; i++) {
                        var layer = layers[i];
                        var baseLayer = layer.isBaseLayer;

                        if (baseLayer) containsBaseLayers = true;
                        else containsOverlays = true;

                        // only check a baselayer if it is *the* baselayer, check data
                        //  layers if they are visible
                        var checked = (baseLayer) ? (layer == this.map.baseLayer) : layer.getVisibility();

                        // create input element
                        var inputElem = document.createElement("input"),
                        // The input shall have an id attribute so we can use
                        // labels to interact with them.
                            inputId = OpenLayers.Util.createUniqueID(this.id + "_input_");

                        inputElem.id = inputId;
                        inputElem.name = (baseLayer) ? this.id + "_baseLayers" : layer.name;
                        inputElem.type = (baseLayer) ? "radio" : "checkbox";
                        inputElem.value = layer.name;
                        inputElem.checked = checked;
                        inputElem.defaultChecked = checked;
                        inputElem.className = "olButton";
                        inputElem._layer = layer.id;
                        inputElem._layerSwitcher = this.id;
                        inputElem.disabled = !baseLayer && !layer.inRange;

                        // create span
                        var labelSpan = document.createElement("label");
                        // this isn't the DOM attribute 'for', but an arbitrary name we
                        // use to find the appropriate input element in <onButtonClick>
                        labelSpan["for"] = inputElem.id;
                        OpenLayers.Element.addClass(labelSpan, "labelSpan olButton");
                        labelSpan._layer = layer.id;
                        labelSpan._layerSwitcher = this.id;
                        if (!baseLayer && !layer.inRange) {
                            labelSpan.style.color = "gray";
                        }
                        labelSpan.innerHTML = layer.title || layer.name;
                        labelSpan.style.verticalAlign = (baseLayer) ? "bottom"
                            : "baseline";


                        var groupArray = (baseLayer) ? this.baseLayers
                            : this.dataLayers;
                        groupArray.push({
                            'layer': layer,
                            'inputElem': inputElem,
                            'labelSpan': labelSpan
                        });


                        var groupDiv = $((baseLayer) ? this.baseLayersDiv
                            : this.dataLayersDiv);
                        groupDiv.append($("<div></div>").append($(inputElem)).append($(labelSpan)));
                    }

                    // if no overlays, dont display the overlay label
                    this.dataLbl.style.display = (containsOverlays) ? "" : "none";

                    // if no baselayers, dont display the baselayer label
                    this.baseLbl.style.display = (containsBaseLayers) ? "" : "none";

                    // hide baselayers list if multiple basemaps config
                    if (this.baselayers && this.baselayers.length>1) {
                        this.baseLbl.style.display = "none";
                        this.baseLayersDiv.style.display = "none";
                    }

                    return this.div;
                }
            }
        );

        var esrirestExtractor = function(resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
            var parsedUrl = resource.url.split('#');
            var url = proxyServiceUrl || parsedUrl[0];

            var layerName = parsedUrl.length > 1 && parsedUrl[1];

            OL_HELPERS.withArcGisLayers(url, layerProcessor, layerName, parsedUrl[0]);
        }

        ckan.geoview.layerExtractors = {

            'kml': function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createKMLLayer(url));
            },
            'gml': function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createGMLLayer(url));
            },
            'geojson': function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createGeoJSONLayer(url));
            },
            'wfs': function(resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var parsedUrl = resource.url.split('#');
                var url = proxyServiceUrl || parsedUrl[0];

                var ftName = parsedUrl.length > 1 && parsedUrl[1];
                OL_HELPERS.withFeatureTypesLayers(url, layerProcessor, ftName, map, true /* useGET */);
            },
            'wms' : function(resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var parsedUrl = resource.url.split('#');
                // use the original URL for the getMap, as there's no need for a proxy for image requests
                var getMapUrl = parsedUrl[0];

                var url = proxyServiceUrl || getMapUrl;

                var layerName = parsedUrl.length > 1 && parsedUrl[1];
                OL_HELPERS.withWMSLayers(url, getMapUrl, layerProcessor, layerName, true /* useTiling*/ );
            },
            'wmts' : function(resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var parsedUrl = resource.url.split('#');

                var url = proxyServiceUrl || parsedUrl[0];

                var layerName = parsedUrl.length > 1 && parsedUrl[1];
                OL_HELPERS.withWMTSLayers(url, layerProcessor, layerName);
            },
            'esrigeojson': function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var url = proxyUrl || resource.url;
                layerProcessor(OL_HELPERS.createEsriGeoJSONLayer(url));
            },
            'arcgis_rest': esrirestExtractor ,
            'esri rest': esrirestExtractor ,
            'gft': function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {
                var tableId = OL_HELPERS.parseURL(resource.url).query.docid;
                layerProcessor(OL_HELPERS.createGFTLayer(tableId, ckan.geoview.gapi_key));
            }
        }

        var withLayers = function (resource, proxyUrl, proxyServiceUrl, layerProcessor, map) {

            var withLayers = ckan.geoview.layerExtractors[resource.format && resource.format.toLocaleLowerCase()];
            withLayers && withLayers(resource, proxyUrl, proxyServiceUrl, layerProcessor, map);
        }

        return {
            options: {
                i18n: {
                }
            },

            initialize: function () {
                jQuery.proxyAll(this, /_on/);
                this.el.ready(this._onReady);
            },

            addLayer: function (resourceLayer) {

                 resourceLayer.singleTile = true;
                if (ckan.geoview && ckan.geoview.feature_style) {
                    var styleMapJson = JSON.parse(ckan.geoview.feature_style)
                    resourceLayer.styleMap = new OpenLayers.StyleMap(styleMapJson)
                }

                if (this.options.ol_config.hide_overlays &&
                    this.options.ol_config.hide_overlays.toLowerCase() == "true") {
                    resourceLayer.setVisibility(false);
                }

                this.map.addLayer(resourceLayer)

                var bbox = resourceLayer.getDataExtent && resourceLayer.getDataExtent()
                if (bbox) {
                    if (this.map.getExtent()) this.map.getExtent().extend(bbox)
                    else this.map.zoomToExtent(bbox)
                }
                else {
                    var firstExtent = false
                    resourceLayer.events.register(
                        "loadend",
                        resourceLayer,
                        function (e) {
                            if (!firstExtent) {
                                var bbox = e && e.object && e.object.getDataExtent && e.object.getDataExtent()
                                if (bbox)
                                    if (this.map.getExtent()) this.map.getExtent().extend(bbox)
                                    else this.map.zoomToExtent(bbox)
                                else
                                    this.map.zoomToMaxExtent()
                                firstExtent = true
                            }
                        })
                }

            },

            _commonBaseLayer: function(mapConfig, callback, module) {
                /*
                Return an OpenLayers base layer to be used depending on CKAN wide settings

                TODO: factor out somewhere it can be reused by other modules.

                */

                var urls;
                var attribution;

                var isHttps = window.location.href.substring(0, 5).toLowerCase() === 'https';
                if (mapConfig.type == 'mapbox') {
                    // MapBox base map
                    if (!mapConfig['map_id'] || !mapConfig['access_token']) {
                      throw '[CKAN Map Widgets] You need to provide a map ID ([account].[handle]) and an access token when using a MapBox layer. ' +
                            'See http://www.mapbox.com/developers/api-overview/ for details';
                    }

                    urls = ['//a.tiles.mapbox.com/v4/' + mapConfig['map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['access_token'],
                                '//b.tiles.mapbox.com/v4/' + mapConfig['map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['access_token'],
                                '//c.tiles.mapbox.com/v4/' + mapConfig['map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['access_token'],
                                '//d.tiles.mapbox.com/v4/' + mapConfig['map_id'] + '/${z}/${x}/${y}.png?access_token=' + mapConfig['access_token'],
                    ];
                    attribution = '<a href="https://www.mapbox.com/about/maps/" target="_blank">&copy; Mapbox &copy; OpenStreetMap </a> <a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>';
                    var baseMapLayer = new OpenLayers.Layer.XYZ('MapBox', urls, {
                        sphericalMercator: true,
                        wrapDateLine: true,
                        attribution: attribution
                    });

                    callback (baseMapLayer);
                } else if (mapConfig.type == 'tms') {
                    // Custom XYZ layer
                    urls = mapConfig['url'];
                    if (!urls)
                        throw '[CKAN Map Widgets] TMS URL must be set when using TMS Map type';
                    var projection = mapConfig['srs'] ? new OpenLayers.Projection(mapConfig['srs']) : OL_HELPERS.Mercator // force SRS to 3857 if using OSM baselayer
                    var maxExtent = mapConfig['extent'] && eval(mapConfig['extent'])

                    var baseMapLayer = new OpenLayers.Layer.TMS('Base Layer', urls, {
                        //wrapDateLine: true,
                        projection: projection,
                        maxExtent: maxExtent,
                        attribution: mapConfig.attribution,
                        // take lower left corner as default origin
                        tileOrigin: new OpenLayers.LonLat(maxExtent[0], maxExtent[1]),
                        //units:"m",
                        layername:mapConfig['layername'],
                        type:'png',
                        resolutions: mapConfig['resolutions'] && eval(mapConfig['resolutions'])
                        //zoomOffset: 5
                    });

                    callback (baseMapLayer);
                }  else if (mapConfig.type == 'custom') {
                    // Custom XYZ layer
                    urls = mapConfig['url'];
                    if (!urls)
                        throw '[CKAN Map Widgets] Custom URL must be set when using Custom Map type';
                    if (urls.indexOf('${x}') === -1) {
                      urls = urls.replace('{x}', '${x}').replace('{y}', '${y}').replace('{z}', '${z}');
                    }
                    var baseMapLayer = new OpenLayers.Layer.XYZ('Base Layer', urls, {
                        sphericalMercator: true,
                        wrapDateLine: true,
                        attribution: mapConfig.attribution
                    });

                    callback (baseMapLayer);
                }  else if (mapConfig.type == 'wmts') {

                    OL_HELPERS.withWMTSLayers(
                        '/basemap_service/wmts',
                        function(layer) {
                            layer.isBaseLayer = true
                            layer.options.attribution = mapConfig.attribution
                            layer.maxExtent = layer.mlDescr.bounds.transform(OL_HELPERS.EPSG4326, layer.projection)

                            callback (layer);
                        },
                        mapConfig['layer'],
                        mapConfig['srs']
                    )

                } else if (mapConfig.type == 'wms') {
                    urls = mapConfig['url'];
                    if (!urls)
                        throw '[CKAN Map Widgets] WMS URL must be set when using WMS Map type';

                    var baseMapLayer = new OpenLayers.Layer.WMSLayer(
                        mapConfig['layer'],
                        urls,
                        {layers: mapConfig['layer'],
                            transparent: true},
                        {
                            title: 'Base Layer',
                            isBaseLayer: true,
                            singleTile: true,
                            visibility: true,
                            projection: mapConfig['srs'] ? new OpenLayers.Projection(mapConfig['srs']) : OL_HELPERS.Mercator, // force SRS to 3857 if using OSM baselayer
                            ratio: 1,
                            maxExtent: mapConfig['extent'] && eval(mapConfig['extent'])
                        }
                    )

                    callback (baseMapLayer);

                } else {
                    // Stamen base map
                    var urls = ['//stamen-tiles-a.a.ssl.fastly.net/terrain/${z}/${x}/${y}.png',
                                '//stamen-tiles-b.a.ssl.fastly.net/terrain/${z}/${x}/${y}.png',
                                '//stamen-tiles-c.a.ssl.fastly.net/terrain/${z}/${x}/${y}.png',
                                '//stamen-tiles-d.a.ssl.fastly.net/terrain/${z}/${x}/${y}.png'];
                    var attribution = 'Map tiles by <a href="http://stamen.com">Stamen Design</a> (<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>). Data by <a href="http://openstreetmap.org">OpenStreetMap</a> (<a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>)';
                    var baseMapLayer = new OpenLayers.Layer.OSM('Base Map', urls, {
                      attribution: attribution});

                    callback (baseMapLayer);
                }



            },

            _onReady: function () {

                var baseMapsConfig = this.options.basemapsConfig

                // gather options and config for this view
                var proxyUrl = this.options.proxy_url;
                var proxyServiceUrl = this.options.proxy_service_url;

                if (this.options.resourceView)
                    $_.extend(ckan.geoview, JSON.parse(this.options.resourceView));

                ckan.geoview.gapi_key = this.options.gapi_key;

                var clearBaseLayer = new OpenLayers.Layer.OSM("None", this.options.site_url + "img/blank.gif", {isBaseLayer: true, attribution: ''});

                var mapDiv = $("<div></div>").attr("id", "map").addClass("map")
                var info = $("<div></div>").attr("id", "info")
                mapDiv.append(info)

                $("#map-container").empty()
                $("#map-container").append(mapDiv)

                info.tooltip({
                    animation: false,
                    trigger: 'manual',
                    placement: "right",
                    html: true
                });

                var eventListeners
                if ((ckan.geoview && 'feature_hoveron' in ckan.geoview) ? ckan.geoview['feature_hoveron'] : this.options.ol_config.default_feature_hoveron)
                    eventListeners = {
                        featureover: function (e) {
                            e.feature.renderIntent = "select";
                            e.feature.layer.drawFeature(e.feature);
                            var pixel = event.xy
                            info.css({
                                left: (pixel.x + 10) + 'px',
                                top: (pixel.y - 15) + 'px'
                            });
                            info.currentFeature = e.feature
                            info.tooltip('hide')
                                .empty()
                            var tooltip = "<div>" + (e.feature.data.name || e.feature.fid) + "</div><table>";
                            for (var prop in e.feature.data) tooltip += "<tr><td>" + prop + "</td><td>" + e.feature.data[prop] + "</td></tr></div>"
                            tooltip += "</table>"
                            info.attr('data-original-title', tooltip)
                                .tooltip('fixTitle')
                                .tooltip('show');
                        },
                        featureout: function (e) {
                            e.feature.renderIntent = "default"
                            e.feature.layer.drawFeature(e.feature)
                            if (info.currentFeature == e.feature) {
                                info.tooltip('hide')
                                info.currentFeature = undefined
                            }

                        },
                        featureclick: function (e) {
                            //log("Map says: " + e.feature.id + " clicked on " + e.feature.layer.name);
                        }
                    }

                OpenLayers.ImgPath = this.options.site_url + 'js/vendor/openlayers2/img/';


                var createMapFun = function(baseMapLayer) {

                    this.map = new OpenLayers.Map(
                        {
                            div: "map",
                            theme: this.options.site_url + "js/vendor/openlayers2/theme/default/style.css",
                            layers: [baseMapLayer, clearBaseLayer],
                            maxExtent: baseMapLayer.getMaxExtent(),
                            eventListeners: eventListeners
                            //projection: OL_HELPERS.Mercator, // this is needed for WMS layers (most only accept 3857), but causes WFS to fail
                        });

                    layerSwitcher = new OpenLayers.Control.CKANLayerSwitcher(
                        {
                            'div':$('#data-preview>.layerswitcher')[0],
                            'baselayers':baseMapsConfig
                        })

                    this.map.addControl(layerSwitcher);

                    var bboxFrag;
                    var fragMap = OL_HELPERS.parseKVP((window.parent || window).location.hash && (window.parent || window).location.hash.substring(1));

                    var bbox = (fragMap.bbox && new OpenLayers.Bounds(fragMap.bbox.split(',')).transform(OL_HELPERS.EPSG4326, this.map.getProjectionObject()));
                    if (bbox) this.map.zoomToExtent(bbox);

                    var $map = this.map;
                    var mapChangeListener = function() {
                        var newBbox = $map.getExtent() && $map.getExtent().transform($map.getProjectionObject(), OL_HELPERS.EPSG4326).toString()

                        if (newBbox) {
                            var fragMap = OL_HELPERS.parseKVP((window.parent || window).location.hash && (window.parent || window).location.hash.substring(1));
                            fragMap['bbox'] = newBbox;

                            (window.parent || window).location.hash = OL_HELPERS.kvp2string(fragMap)
                        }
                    }

                    // listen to bbox changes to update URL fragment
                    this.map.events.register("moveend", this.map, mapChangeListener);

                    this.map.events.register("zoomend", this.map, mapChangeListener);

                    var $map = this.map;
                    var mapChangeListener = function() {
                        var newBbox = $map.getExtent() && $map.getExtent().transform($map.getProjectionObject(), OL_HELPERS.EPSG4326).toString()

                        if (newBbox) {
                            var fragMap = OL_HELPERS.parseKVP((window.parent || window).location.hash && (window.parent || window).location.hash.substring(1));
                            fragMap['bbox'] = newBbox;

                            (window.parent || window).location.hash = OL_HELPERS.kvp2string(fragMap)
                        }
                    }

                    // listen to bbox changes to update URL fragment
                    this.map.events.register("moveend", this.map, mapChangeListener);

                    this.map.events.register("zoomend", this.map, mapChangeListener);

                    var proxyUrl = this.options.proxy_url;
                    var proxyServiceUrl = this.options.proxy_service_url;

                    ckan.geoview.googleApiKey = this.options.gapi_key;

                    if ('api' in preload_resource) {
                        var api = JSON.parse( preload_resource.api);
                        preload_resource.format = 'WMS';
                        preload_resource.url = api.url + '#' + api.typename;
                    };

                    withLayers(preload_resource, proxyUrl, proxyServiceUrl, $_.bind(this.addLayer, this), this.map);

                    // Expand layer switcher by default
                    layerSwitcher.maximizeControl();
                }

                var $this = this;
                var switchBasemap = function(baseMapLayer) {
                    if (this.map.baseLayer != baseMapLayer) {
                        var currentExtent = this.map.getExtent();
                        var currentProjection = this.map.getProjectionObject()
                        this.map.maxExtent = baseMapLayer.getMaxExtent()
                        this.map.setBaseLayer(baseMapLayer)
                        var newExtent = currentExtent.transform(currentProjection, baseMapLayer.projection)
                        this.map.zoomToExtent(newExtent)
                        //$this.map.maxExtent = baseMapLayer.getMaxExtent()
                    }
                }

                // Choose base map based on CKAN wide config

                if (!baseMapsConfig) {
                    // deprecated - for backward comp, parse old config format into json config
                    var config = {
                        type: this.options.map_config['type']
                    }
                    var prefix = config.type+'.'
                    for (var fieldName in this.options.map_config) {
                        if (fieldName.startsWith(prefix)) config[fieldName.substring(prefix.length)] = this.options.map_config[fieldName]
                    }
                    baseMapsConfig = [config]
                }

                this._commonBaseLayer(
                    baseMapsConfig[0],
                    function(layer) {
                        baseMapsConfig[0].$ol_layer = layer
                        $_.bind(createMapFun,$this)(layer)
                    },
                    this);


                if (baseMapsConfig.length > 1) {

                    var selector = $("<select id='basemapSelector'/>")

                    $.each(baseMapsConfig, function (i, mapConfig) {
                        selector
                            .append(
                                $('<option/>', {value: i})
                                .text(mapConfig.title)
                            )
                            .change(function(e) {
                                var config = baseMapsConfig[this.selectedOptions[0].value]
                                if (config.$ol_layer) {
                                    $_.bind(switchBasemap, $this)(config.$ol_layer)
                                } else {
                                    $this._commonBaseLayer(
                                        config,
                                        function(layer) {
                                            config.$ol_layer = layer
                                            $this.map.addLayer(layer)
                                            $_.bind(switchBasemap, $this)(layer)
                                        }, this);
                                }
                            });
                    });
                    $(".layersDiv").prepend(selector)

                }
            }
        }
    });
})();
