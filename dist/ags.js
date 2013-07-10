L.AGS = L.Class.extend({});
L.AGS.Layer = L.Class.extend({
  includes: L.Mixin.Events
});
L.AGS.Layer.Dynamic = L.ImageOverlay.extend({
  defaultParams: {
    format: 'png8',
    transparent: true,
    f: 'image',
    bboxSR: 102100,
    imageSR: 102100,
    layers: ''
  },

  initialize: function (url, bounds, options) {
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

  onAdd: function (map) {
    this._map = map;

    if (!this._image) {
      this._initImage();
    }

    map._panes.overlayPane.appendChild(this._image);

    map.on({
      'viewreset': this._reset,
      'moveend': this._update,
      'zoomend': this._zoomUpdate
    }, this);

    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }

    if (map.options.crs && map.options.crs.code) {
      var sr = map.options.crs.code.split(":")[1];
      this._layerParams.bboxSR = sr;
      this._layerParams.imageSR = sr;
    }

    this._reset();
    //this._update();
  },

  onRemove: function (map) {
    map.getPanes().overlayPane.removeChild(this._image);

    map.off({
      'viewreset': this._reset,
      'moveend': this._update
    }, this);

    if (map.options.zoomAnimation) {
      map.off('zoomanim', this._animateZoom, this);
    }
  },

  _parseLayers: function () {
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

  _parseLayerDefs: function () {
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

  _initImage: function () {
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

  _getImageUrl: function () {
    var bounds = this._map.getBounds(),
        size = this._map.getSize(),
        ne = this._map.options.crs.project(bounds._northEast),
        sw = this._map.options.crs.project(bounds._southWest);

    this._layerParams.bbox = [sw.x, sw.y, ne.x, ne.y].join(',');
    this._layerParams.size = size.x + ',' + size.y;

    var url = this._url + '/export' + L.Util.getParamString(this._layerParams);

    if (typeof this.options.token !== 'undefined')
      url = url + '&token=' + this.options.token;

    return url;
  },

  _update: function (e) {
    if (this._map._panTransition && this._map._panTransition._inProgress) return;

    var zoom = this._map.getZoom();
    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) return;

    this._newImage = L.DomUtil.create('img', 'leaflet-image-layer');

    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(this._newImage, 'leaflet-zoom-animated');
    } else {
      L.DomUtil.addClass(this._newImage, 'leaflet-zoom-hide');
    }

    this._updateOpacity();

    L.Util.extend(this._newImage, {
      galleryimg: 'no',
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.Util.bind(this._onNewImageLoad, this),
      src: this._getImageUrl()
    });
  },

  _zoomUpdate: function (e) {
    //console.log(e);
    //console.log(this._image);
    //console.log(this._newImage);
  },

  _onNewImageLoad: function () {
    var bounds = this._map.getBounds(),
        nw = L.latLng(bounds._northEast.lat, bounds._southWest.lng),
        se = L.latLng(bounds._southWest.lat, bounds._northEast.lng);

    var topLeft = this._map.latLngToLayerPoint(nw),
        size = this._map.latLngToLayerPoint(se)._subtract(topLeft);

    L.DomUtil.setPosition(this._newImage, topLeft);
    this._newImage.style.width = size.x + 'px';
    this._newImage.style.height = size.y + 'px';
    this._map._panes.overlayPane.appendChild(this._newImage);
    this._map._panes.overlayPane.removeChild(this._image);
    this._image = this._newImage;
    this._newImage = null;
  },

  _onImageLoad: function () {
    this.fire('load');
    //if (this._image.style.display == 'none') {
    //  this._image.style.display = 'block';
    //}
  },

  _reset: function () {
    return;
  }
});

L.agsDynamicLayer = function (url, bounds, options) {
  return new L.AGS.Layer.Dynamic(url, bounds, options);
};
L.AGS.Layer.Tiled = L.TileLayer.extend({
  getTileUrl: function(tilePoint) {
    this._adjustTilePoint(tilePoint);

    var url = this._url + '/tile/{z}/{y}/{x}',
        zoom = this._getZoomForUrl();

    //if ('offset' in this.options) {
    //  zoom = zoom + this.options.offset;
    //}

    url = url.replace('{s}', '')
             .replace('{z}', zoom)
             .replace('{x}', tilePoint.x)
             .replace('{y}', tilePoint.y);

    if ('token' in this.options) {
      return url + '?token=' + this.options.token;
    }
    
    return url;
  }
});

L.agsTileLayer = function(url, options) {
  return new L.AGS.Layer.Tiled(url, options);
};
// AGS.Layer.Tiled.Dynamic.js
// Scooter Wadsworth : Sanborn Map Company
// Modified: TileLayer.AGSDynamic.js by DTSAgile https://github.com/dtsagile/Leaflet/blob/master/src/layer/tile/TileLayer.AGSDynamic.js

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
L.AGS.Security = L.AGS.extend({
  token: {},
  options: {},

  initialize: function(url, options, callback) {
    L.Util.setOptions(this, options);
    this._url = url;
    this._callback = callback;

    if (typeof this.options.username !== 'undefined' && typeof this.options.password !== 'undefined') {
      this.fetchToken(this.options.username, this.options.password);
    } else {
      this.getUserInfo();
    }
  },

  getUserInfo: function(msg) {
    var _t = this;
    var container = document.createElement('div');
    container.className += 'esri_user_info';
    container.id = 'esri_user_info';
    document.body.appendChild(container);
    var form = document.createElement('form');
    container.appendChild(form);
    var login = document.createElement('input');
    login.id = 'esri_login';
    login.type = 'text';
    if (typeof this.options.username !== 'undefined') {
      login.value = this.options.username;
    }
    form.appendChild(login);
    var pass = document.createElement('input');
    pass.id = 'esri_pass';
    pass.type = 'password';
    form.appendChild(pass);
    var submit = document.createElement('input');
    submit.id = 'submit';
    submit.type = 'submit';
    form.appendChild(submit);
    var width = window.innerWidth || document.documentElement.clientWidth;
    var height = window.innerHeight || document.documentElement.clientHeight;
    container.style.left = (width / 2) - (container.offsetWidth / 2) + 'px';
    container.style.top = (height / 2) - (container.offsetHeight / 2) + 'px';
    container.style.visibility = 'visible';
    var bg;
    if ('getComputedStyle' in window) {
      bg = window.getComputedStyle(container, null).backgroundColor;
    } else {
      bg = container.currentStyle['backgroundColor'];
    }
    if (bg == 'transparent' || bg == 'rgba(0, 0, 0, 0)'){
      container.style.background = '#aaaaaa';
    }

    if ('addEventListener' in form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();

        var username = document.getElementById('esri_login').value,
            password = document.getElementById('esri_pass').value;

        container.style.display = 'none';
        document.body.removeChild(container);

        _t.fetchToken(username, password);
      }, false);
    } else {
      form.attachEvent('onSubmit', function(e) {
        e.preventDefault();

        var username = document.getElementById('esri_login').value,
            password = document.getElementById('esri_pass').value;

        container.style.display = 'none';
        document.body.removeChild(container);

        _t.fetchToken(username, password);
      });
    }
  },

  fetchToken: function(username, password) {
    var _t = this;
    this.options.username = username;

    var url = this._url + '/tokens',
        params = 'request=getToken&username=' + username + '&password=' + password + '&expiration=60';

    // &clientid=ip.x.x.x.x

    var getJsonP = function(url, params) {
      window.setToken = function(obj) { // messy; fix me
        var token;

        if (typeof obj === 'object' && obj.token) {
          token = obj.token;
        } else if (typeof obj === 'string') {
          token = obj;
        }

        var d = new Date();

        _t.token = { // TODO: allow for variable token duration
          value: token,
          expiration: +(d.setMinutes(d.getMinutes() + 59))
        };

        document.body.removeChild(document.getElementById('tokenJsonP'));

        delete window.setToken;

        if (typeof _t._callback !== 'undefined') {
          _t._callback();
        }
      };

      var params = '?' + params + '&f=pjson&callback=setToken';

      var script = document.createElement('script');
      script.id = 'tokenJsonP';
      script.src = url + params;
      document.body.appendChild(script);
      
      setTimeout(function() {
        if (typeof _t.token.value === 'undefined') {
          // assume incorrect username / password combo
          _t.getUserInfo('failed login');
        }
      }, 5000);
    };

    var setToken = function(obj) {
      var token;

      if (typeof obj === 'object' && obj.token) {
        token = obj.token;
      } else if (typeof obj === 'string') {
        token = obj;
      }
        
      var d = new Date();

      _t.token = {
        value: token,
        expiration: +(d.setMinutes(d.getMinutes() + 59))
      };

      var elem = document.getElementById('tokenJsonP');

      if (elem) {
        document.body.removeChild(elem);
      }

      if (typeof _t._callback !== 'undefined') {
        _t._callback();
      }
    };

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 400 || xhr.status == 0) { // bad request / CORS not enabled
          xhr.abort();
          getJsonP(url, params);
        } else if (xhr.status == 200 || xhr.status == 304) {
          setToken(xhr.responseText);
        } else if (xhr.status == 403) {
          xhr.abort();
          _t.getUserInfo('failed login');
        }
      }
    }

    var formData;

    if ('FormData' in window) {
      formData = new FormData();
      params = params.split('&');
      for (var i = 0; i < params.length; i++) {
        var keyValue = params[i].split('=');
        formData.append(keyValue[0], keyValue[1]);
      }
    } else {
      formData = params;
    }

    if ('XDomainRequest' in window) {
      var xdr = new XDomainRequest();
      xdr.onerror = function() {
        xdr.abort();
        getJsonP(url, params);
      };
      xdr.onload = function() {
        setToken(xdr.responseText);
      };
      xdr.open('POST', url, true);
      xdr.send(formData);
    } else {
      xhr.open('POST', url, true);
      
      if (typeof formData === 'string') {
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      }
      
      xhr.send(formData);
    }
  }
});
L.AGS.Tools = L.AGS.extend({});
L.AGS.Tools.Identify = L.AGS.Tools.extend({
  options: {
    f: 'json',
    sr: '4326',
    layers: 'top',
    returnGeometry: true,
    tolerance: 1
  },

  initialize: function(layer, options, callback) {
    this._layer = layer;

    if (typeof options === 'function') {
      this._callback = options;
      var options = {};
    } else {
      this._callback = callback;
    }
    
    L.Util.setOptions(this, options);
    this.parseLayerDefs();
    this.setMapExtent();
    this.setImageDisplay();
  },

  parseGeometry: function(geometry) {
    if (typeof this.options.geometryType === 'undefined') {
      if (typeof geometry === 'string') {
        var len = geometry.split(',').length;
        if (len == 2) {
          this.options.geometryType = 'esriGeometryPoint';
        } else if (len == 4) {
          this.options.geometryType = 'esriGeometryEnvelope';
        }
      } else if (geometry instanceof Array) {
        if (typeof geometry[1][0] === 'number') {
          this.options.geometryType = 'esriGeometryPolyline';
        } else if (geometry[1][0] instanceof Array) {
          this.options.geometryType = 'esriGeometryPolygon';
        }
      } else if (typeof geometry === 'object') {
        if (typeof geometry.x !== 'undefined') {
          this.options.geometryType = 'esriGeometryPoint';
        }
      }
    }

    this.options.geometry = geometry;
  },

  parseLayerDefs: function() {
    var defType = typeof this.options.layerDefs;

    if (defType !== 'undefined') {
      if (defType === 'object' && !(this.options.layerDefs instanceof Array)) {
        this.options.layerDefs = JSON.stringify(this.options.layerDefs);
      } else if (this.options.layerDefs instanceof Array) {
        var defs = {};

        for (var i = 0, len = this.options.layerDefs.length; i < len; i++) {
          if (this.options.layerDefs[i]) {
            defs[i] = this.options.layerDefs[i];
          }
        }

        this.options.layerDefs = JSON.stringify(defs);
      }
    }

    return;
  },

  setImageDisplay: function() {
    if (typeof this.options.imageDisplay === 'undefined') {
      var mapSize = this._layer._map.getSize();
      this.options.imageDisplay = mapSize.x + ',' + mapSize.y + ',96';
    }
    return;
  },

  setMapExtent: function() {
    if (typeof this.options.mapExtent === 'undefined') {
      var bounds = this._layer._map.getBounds();
      this.options.mapExtent = bounds._northEast.lng + ',' + bounds._southWest.lat + ',' + bounds._southWest.lng + ',' + bounds._northEast.lat;
    }
  },

  execute: function(geometry) {
    this.parseGeometry(geometry);

    var _t = this;

    var url = this._layer._url + '/identify';

    var getJsonP = function(url, params) {
      window.parseResponse = function(response) {
        document.body.removeChild(document.getElementById('getJsonP'));
        _t.findBestFeature(response, geometry);
        delete window.parseResponse;
      };

      this.options.f = 'pjson';
      var script = document.createElement('script');
      script.id = 'getJsonP';
      script.src = url + L.Util.getParamString(this.options) + '&callback=parseResponse';
      document.body.appendChild(script);
    };

    var findBestFeature = function(response, clickGeometry) {
      var clickGeometry = clickGeometry.split(','),
          clickPoint = new L.LatLng(clickGeometry[1], clickGeometry[0]),
          map = _t._layer._map;

      response = JSON.parse(response);

      if (response.results instanceof Array) {
        if (response.results.length == 1) {
          if (typeof _t._callback !== 'undefined') {
            _t._callback(response.results[0]);
          } // check for callback?
        } else if (response.results.length > 1) {
          var bestGeom = {
            type: null,
            dist: 1000000,
            index: null
          };

          for (var i = 0, len = response.results.length; i < len; i++) {
            if (typeof response.results[i] !== 'undefined') {
              var attrs = response.results[i].attributes,
                  geom = response.results[i].geometry;

              if (geom.hasOwnProperty('x') && geom.hasOwnProperty('y')) {
                var point = new L.LatLng(geom.y, geom.x),
                    dist = point.distanceTo(clickPoint);

                if (dist < bestGeom.dist) {
                  bestGeom.type = 'point';
                  bestGeom.dist = dist;
                  bestGeom.index = i;
                }
              } else if (geom.hasOwnPropety('rings')) {
                var vertices = [],
                    rings = geom.rings;
                
                for (var j = 0, len = rings.length; j < len; j++) {
                  vertices.push(new L.LatLng(rings[0][j][1], rings[0][j][0]));
                }

                var inPoly = false,
                    l = vertices.length - 1;

                for (var k = 0, len = vertices.length; k < len; k++) {
                  var vLat1 = vertices[k].lat,
                      vLng1 = vertices[k].lng,
                      vLat2 = vertices[l].lat,
                      vLng2 = vertices[l].lng,
                      pLat = clickPoint.lat,
                      pLng = clickPoint.lng;

                  if (vLng1 < pLng && vLng2 >= pLng || vLng2 < pLng && vLng1 >= pLng) {
                    if (vLat1 + (pLng - vLng1) / (vLng2 - vLng1) * (vLat2 - vLat1) < pLat) {
                      inPoly = !inPoly;
                    }
                  }

                  l = k;
                }

                if (inPoly) {
                  bestGeom.type = 'polygon';
                  bestGeom.index = i;
                  break;
                }
              }
            }
          }
          var result = response.results[bestGeom.index];

          if (typeof _t._callback !== 'undefined') {
            _t._callback(result);
          } // check for callback?
        }
      }
    };

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 400 || xhr.status == 0) {
          getJsonP(url, this.options);
        } else if (xhr.status == 200 || xhr.status == 302) {
          findBestFeature(xhr.responseText, geometry);
        }
      }
    };

    formData = L.Util.getParamString(this.options).split('?')[1];

    if ('XDomainRequest' in window) {
      var xdr = new XDomainRequest();
      xdr.onerror = function() {
        xdr.abort();
        getJsonP(url, this.options);
      };
      xdr.onload = function() {
        setToken(xdr.responseText);
      };
      xdr.open('POST', url, true);
      xdr.send(formData);
    } else {
      xhr.open('POST', url, true);
      
      if (typeof formData === 'string') {
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      }
      
      xhr.send(formData);
    }
  }
});