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
    this._callback = callback;
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
        _t.parseResponse(response, geometry);
        delete window.parseResponse;
      };

      this.options.f = 'pjson';
      var script = document.createElement('script');
      script.id = 'getJsonP';
      script.src = url + L.Util.getParamString(this.options) + '&callback=parseResponse';
      document.body.appendChild(script);
    };

    var renderFeature = function(response, clickGeometry) { // filter and pass to callback if available
      var clickGeometry = clickGeometry.split(','),
          clickPoint = new L.LatLng(clickGeometry[1], clickGeometry[0]),
          map = _t._layer._map;

      if (response.results instanceof Array) {
        if (response.results.length == 1) {
          var attrs = response.results[0].attributes,
              geom = response.results[0].geometry,
              content = '';

          if (geom.hasOwnProperty('x') && geom.hasOwnProperty('y')) {
            var point = new L.LatLng(geom.y, geom.x),
                marker = new L.CircleMarker(point);
            map.addLayer(marker);
            setTimeout(function() {
              map.removeLayer(marker);
            }, 5000);
          } else if (geom.hasOwnProperty('rings')) {
            var vertices = [],
                rings = geom['rings'];

            for (var i = 0, len = rings[0].length; i < len; i++) {
              var ll = new L.LatLng(rings[0][i][1], rings[0][i][0]);
              vertices.push(ll);
            }

            var polygon = new L.Polygon(vertices);
            map.addLayer(polygon);
            setTimeout(function() {
              map.removeLayer(polygon);
            }, 5000);
          }

          for (var prop in attrs) {
            content += '<p style="font-weight:bold;display:inline;">' + prop + ':</p>&nbsp;<p style="display:inline;">' + attrs[prop] + '</p><br />';
          }
        } else if (response.results.length > 1) {
          var closestPoint = {
            point: null,
            dist: 1000000
          };
          
          for (var i = 0, len = response.results.length; i < len; i++) {
            console.log(response.results[i]);
            if (typeof response.results[i] !== 'undefined') {
              var geom = response.results[i].geometry,
                  attrs = response.results[i].attributes;

              if (geom.hasOwnProperty('x') && geom.hasOwnProperty('y')) {
                var point = new L.LatLng(geom.y, geom.x),
                    dist = clickPoint.distanceTo(point);

                if (dist < closestPoint.dist) {
                  closestPoint.point = point;
                  closestPoint.dist = dist;
                }
              } else if (geom.hasOwnProperty('rings')) {
                var vertices = [],
                    rings = geom['rings'];

                for (var j = 0, len = rings[0].length; j < len; j++) {
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
                  var polygon = new L.Polygon(vertices);
                  map.addLayer(polygon);

                  setTimeout(function() {
                    map.removeLayer(polygon);
                  }, 5000);
                }
              } else if (geom.hasOwnProperty('paths')) {
                // polyline
              }
            }

            if (closestPoint.point) {
              var marker = new L.CircleMarker(closestPoint.point);
              map.addLayer(marker);

              setTimeout(function() {
                map.removeLayer(marker);
              }, 5000);
            }
          }
        }
      }
    };

    var parseResponse = function(response, geometry) {
      if (typeof _t._callback !== 'undefined') {
        _t._callback(response, geometry);
        return;
      } else {
        response = JSON.parse(response);
        renderFeature(response, geometry);
      }
    };

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 400 || xhr.status == 0) {
          getJsonP(url, this.options);
        } else if (xhr.status == 200 || xhr.status == 302) {
          parseResponse(xhr.responseText, geometry);
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