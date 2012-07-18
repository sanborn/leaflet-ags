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