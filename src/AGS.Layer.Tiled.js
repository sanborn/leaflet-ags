L.AGS.Layer.Tiled = L.TileLayer.extend({
  getTileUrl: function(tilePoint, zoom) {
    var url = this._url + '/tile/{z}/{y}/{x}';

    if ('offset' in this.options) {
      zoom = zoom + this.options.offset;
    }

    url = url.replace('{s}', '')
             .replace('{z}', zoom)
             .replace('{x}', tilePoint.x)
             .replace('{y}', tilePoint.y);

    if ('type' in this.options) {
      return url + '?type=' + this.options.type;
    }

    if ('token' in this.options) {
      return url + '?token=' + this.options.token;
    }
    
    return url;
  }
});