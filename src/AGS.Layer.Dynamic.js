L.AGS.Layer.Dynamic = L.ImageOverlay.extend({
  defaultParams: {
    format: 'png8',
    transparent: true,
    f: 'image',
    bboxSR: 102100
  },

  initialize: function(url, bounds, options) {
    this._url = url;
    this._bounds = L.latLngBounds(bounds);
    this._layerParams = L.Util.extend({}, this.defaultParams);

    for (var opt in options) {
      if (!this.options.hasOwnProperty(opt)) {
        this._layerParams[opt] = options[opt];
      }
    }

    delete this._layerParams.token;

    this._parseLayers();
    this._parseLayerDefs();

    L.Util.setOptions(this, options);
  },

  onAdd: function(map) {
    this._map = map;

    if (!this._image) {
      this._initImage();
    }

    map._panes.overlayPane.appendChild(this._image);

    map.on('viewreset', this._reset, this);
    map.on('moveend', this._updateImage, this);

    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }

    this._reset();
  },

  onRemove: function(map) {
    map.getPanes().overlayPane.removeChild(this._image);

    map.off('viewreset', this._reset, this);
    map.on('moveend', this._updateImage, this);

    if (map.options.zoomAnimation) {
      map.off('zoomanim', this._animateZoom, this);
    }
  },

  _parseLayers: function() {
    if (typeof this._layerParams.layers === 'undefined') {
      delete this._layerParams.layerOption;
      return;
    }

    var action = this._layerParams.layerOption || null,
        layers = this._layerParams.layers || null,
        verb = 'show',
        verbs = ['show', 'hide', 'include', 'exclude'];

    delete this._layerParams.layerOption;

    if (!action) {
      if (layers instanceof Array) {
        this._layerParams.layers = verb + ':' + layers.join(',');
      } else if (typeof layers === 'string') {
        var match = layers.match(':');

        if (match) {
          layers = layers.split(match[0]);
          if (Number(layers[1].split(',')[0])) {
            if (verbs.indexOf(layers[0]) != -1) {
              verb = layers[0];
            }
            
            layers = layers[1];
          }
        }
        this._layerParams.layers = verb + ':' + layers;
      }
    } else {
      if (verbs.indexOf(action) != -1) {
        verb = action;
      }

      this._layerParams.layers = verb + ':' + layers;
    }
  },

  _parseLayerDefs: function() {
    if (typeof this._layerParams.layerDefs === 'undefined') {
      return;
    }

    var layerDefs = this._layerParams.layerDefs;

    var defs = [];

    if (layerDefs instanceof Array) {
      var len = layerDefs.length;
      for (var i = 0; i < len; i++) {
        if (layerDefs[i]) {
          defs.push(i + ':' + layerDefs[i]);
        }
      }
    } else if (typeof layerDefs === 'object') {
      for (var layer in layerDefs) {
        defs.push(layer + ':' + layerDefs[layer]);
      }
    } else {
      delete this._layerParams.layerDefs;
      return;
    }
    this._layerParams.layerDefs = defs.join(';');
  },

  _initImage: function() {
    this._image = L.DomUtil.create('img', 'leaflet-image-layer');

    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
    } else {
      L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
    }

    this._updateOpacity();

    L.Util.extend(this._image, {
      galleryimg: 'no',
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.Util.bind(this._onImageLoad, this),
      src: this._getImageUrl()
    });
  },

  _getImageUrl: function() {
    var bounds = this._map.getBounds(),
        size = this._map.getSize(),
        ne = this._map.options.crs.project(bounds._northEast),
        sw = this._map.options.crs.project(bounds._southWest);

    this._layerParams.bbox = [sw.x, sw.y, ne.x, ne.y].join(',');
    this._layerParams.size = size.x + ',' + size.y;

    var url = this._url + '/export' + L.Util.getParamString(this._layerParams);

    if (typeof this.options.token !== 'undefined') url = url + '&token=' + this.options.token;

    return url;
  },

  _updateImage: function() {
    var topLeft = this._map.latLngToLayerPoint(this._map.getBounds().getNorthWest()),
        size = this._map.latLngToLayerPoint(this._map.getBounds().getSouthEast())._subtract(topLeft);

    this._image.style.display = 'none';
    this._image.src = this._getImageUrl();

    L.DomUtil.setPosition(this._image, topLeft);
    this._image.style.width = size.x + 'px';
    this._image.style.height = size.y + 'px';
  },

  _onImageLoad: function() {
    this._image.style.display = 'block';
  }
});