// AGS.Layer.Tiled.Dynamic.js
// Scooter Wadsworth : Sanborn Map Company
// Modified: TileLayer.AGSDynamic.js by DTSAgile

L.AGS.Layer.Tiled.Dynamic = L.AGS.Layer.Tiled.extend({
  defaultParams: {
    format: 'png8',
    transparent: true,
    nocache: false,
    f: 'image',
    bboxSR: 102100
  },

  initialize: function(url, options) {
    this._url = url;
    this._layerParams = L.Util.extend({}, this.defaultParams);
    this._layerParams.width = this._layerParams.height = this.options.tileSize;

    for (var opt in options) {
      if (!this.options.hasOwnProperty(opt)) {
        this._layerParams[opt] = options[opt];
      }
    }

    delete this._layerParams.token;

    this.parseLayers();
    this.parseLayerDefs();

    L.Util.setOptions(this, options);
  },

  onAdd: function() {
    L.TileLayer.prototype.onAdd.call(this, map);
  },

  parseLayers: function() {
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

  parseLayerDefs: function() {
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

  getTileUrl: function(tilePoint, zoom) {
    var tileSize = this.options.tileSize,
        nwPoint = tilePoint.multiplyBy(tileSize),
        sePoint = nwPoint.add(new L.Point(tileSize, tileSize)),
        nwMap = this._map.unproject(nwPoint, this._zoom, true),
        seMap = this._map.unproject(sePoint, this._zoom, true),
        nw = this._map.options.crs.project(nwMap),
        se = this._map.options.crs.project(seMap),
        bbox = [nw.x, se.y, se.x, nw.y].join(',');

    this._layerParams.bbox = bbox;
    this._layerParams.size = this.options.tileSize + ',' + this.options.tileSize;

    if (this._layerParams.nocache) {
      this._layerParams.nocache = Math.random() * 10000000000000000;
    } else {
      delete this._layerParams.nocache;
    }

    var url = this._url + '/export' + L.Util.getParamString(this._layerParams);

    if (typeof this.options.type !== 'undefined') {
      url = url + '&type=' + this.options.type;
    }

    if (typeof this.options.token !== 'undefined') {
      url = url + '&token=' + this.options.token;
    }

    return url;
  }
});