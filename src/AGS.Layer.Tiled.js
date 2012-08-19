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